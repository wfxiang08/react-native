/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import <Foundation/Foundation.h>

#import "RCTAssert.h"
#import "RCTBridge.h"
#import "RCTConvert.h"
#import "RCTContextExecutor.h"
#import "RCTFrameUpdate.h"
#import "RCTJavaScriptLoader.h"
#import "RCTLog.h"
#import "RCTModuleData.h"
#import "RCTModuleMap.h"
#import "RCTBridgeMethod.h"
#import "RCTPerformanceLogger.h"
#import "RCTProfile.h"
#import "RCTRedBox.h"
#import "RCTSourceCode.h"
#import "RCTSparseArray.h"
#import "RCTUtils.h"

#define RCTAssertJSThread() \
  RCTAssert(![NSStringFromClass([_javaScriptExecutor class]) isEqualToString:@"RCTContextExecutor"] || \
              [[[NSThread currentThread] name] isEqualToString:@"com.facebook.React.JavaScript"], \
            @"This method must be called on JS thread")

NSString *const RCTEnqueueNotification = @"RCTEnqueueNotification";
NSString *const RCTDequeueNotification = @"RCTDequeueNotification";

/**
 * Must be kept in sync with `MessageQueue.js`.
 */
typedef NS_ENUM(NSUInteger, RCTBridgeFields) {
  RCTBridgeFieldRequestModuleIDs = 0,
  RCTBridgeFieldMethodIDs,
  RCTBridgeFieldParamss,
};

RCT_EXTERN NSArray *RCTGetModuleClasses(void);

//----------------------------------------------------------------------------------------------------------------------
@interface RCTBridge ()
// 内部接口重新声明(但是又不对外暴露)
+ (instancetype)currentBridge;
+ (void)setCurrentBridge:(RCTBridge *)bridge;

@end

//----------------------------------------------------------------------------------------------------------------------
@interface RCTBatchedBridge : RCTBridge

@property (nonatomic, weak) RCTBridge *parentBridge;

@end

//----------------------------------------------------------------------------------------------------------------------
@implementation RCTBatchedBridge {
  BOOL _loading;
  BOOL _valid;
  BOOL _wasBatchActive;
  __weak id<RCTJavaScriptExecutor> _javaScriptExecutor;
  NSMutableArray *_pendingCalls;
  NSMutableArray *_moduleDataByID;
  RCTModuleMap *_modulesByName;
  
  // 非常关键的东西?
  CADisplayLink *_jsDisplayLink;
  NSMutableSet *_frameUpdateObservers;
}

//
- (instancetype)initWithParentBridge:(RCTBridge *)bridge {
  RCTAssertMainThread();
  RCTAssertParam(bridge);

  if ((self = [super initWithBundleURL:bridge.bundleURL
                        moduleProvider:bridge.moduleProvider
                         launchOptions:bridge.launchOptions])) {

    _parentBridge = bridge;

    /**
     * Set Initial State
     */
    _valid = YES;
    _loading = YES;
    
    _pendingCalls = [NSMutableArray new];
    _moduleDataByID = [NSMutableArray new];
    _frameUpdateObservers = [NSMutableSet new];
    
    _jsDisplayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(_jsThreadUpdate:)];
    //
    // CADisplayLink 默认每s执行60次, 如果设置: frameInterval=2, 则每s执行30次....
    // _jsDisplayLink.frameInterval = 2;
    //

    // 一次只有一个RCTBridge, 并且也只有一个RCTBatchedBridge
    [RCTBridge setCurrentBridge:self];

    // BatchedBridge 创建时即开始加载JS
    [[NSNotificationCenter defaultCenter] postNotificationName:RCTJavaScriptWillStartLoadingNotification
                                                        object:self
                                                      userInfo:@{ @"bridge": self }];

    [self start];
  }
  return self;
}

- (void)start {
  // http://my.oschina.net/jeans/blog/356852
  dispatch_queue_t bridgeQueue = dispatch_queue_create("com.facebook.react.RCTBridgeQueue", DISPATCH_QUEUE_CONCURRENT);
  
  // 派遣组
  // 和Lock相似
  dispatch_group_t initModulesAndLoadSource = dispatch_group_create();

  //
  // 1. Task 1: 记载JS(不管在什么线程中....)
  //
  dispatch_group_enter(initModulesAndLoadSource);

  __weak RCTBatchedBridge *weakSelf = self;
  __block NSData *sourceCode;
  [self loadSource:^(NSError *error, NSData *source) {
    if (error) {
      // 加载出错，在主线程中展示错误
      dispatch_async(dispatch_get_main_queue(), ^{
        [weakSelf stopLoadingWithError:error];
      });
    }

    sourceCode = source;
    dispatch_group_leave(initModulesAndLoadSource);
  }];

  //
  // Synchronously initialize all native modules
  //
  [self initModules];

  if (RCTProfileIsProfiling()) {
    // Depends on moduleDataByID being loaded
    RCTProfileHookModules(self);
  }

  // 2. Task 2: 在 bridgeQueue 中配置 Module相关的东西
  __block NSString *config;
  dispatch_group_enter(initModulesAndLoadSource);
  
  dispatch_async(bridgeQueue, ^{
    dispatch_group_t setupJSExecutorAndModuleConfig = dispatch_group_create();
    // 异步执行: setupExecutor
    //          moduleConfig之后，在通知: injectJSONConfiguration
    dispatch_group_async(setupJSExecutorAndModuleConfig, bridgeQueue, ^{
      [weakSelf setupExecutor];
    });

    dispatch_group_async(setupJSExecutorAndModuleConfig, bridgeQueue, ^{
      if (weakSelf.isValid) {
        RCTPerformanceLoggerStart(RCTPLNativeModulePrepareConfig);
        config = [weakSelf moduleConfig];
        RCTPerformanceLoggerEnd(RCTPLNativeModulePrepareConfig);
      }
    });

    dispatch_group_notify(setupJSExecutorAndModuleConfig, bridgeQueue, ^{
      // We're not waiting for this complete to leave the dispatch group, since
      // injectJSONConfiguration and executeSourceCode will schedule operations on the
      // same queue anyway.
      RCTPerformanceLoggerStart(RCTPLNativeModuleInjectConfig);

      //
      // module配置完毕之后，需要将Modules的信息导出到JS中
      // 添加对象:
      // global.__fbBatchedBridgeConfig
      // 不需要等待JS执行完毕
      //
      [weakSelf injectJSONConfiguration:config onComplete:^(NSError *error) {
        RCTPerformanceLoggerEnd(RCTPLNativeModuleInjectConfig);
        if (error) {
          dispatch_async(dispatch_get_main_queue(), ^{
            [weakSelf stopLoadingWithError:error];
          });
        }
      }];
      dispatch_group_leave(initModulesAndLoadSource);
    });
  });

  // 上面的事情执行完毕之后，会到主线程执行: sourceCode?
  dispatch_group_notify(initModulesAndLoadSource, dispatch_get_main_queue(), ^{
    RCTBatchedBridge *strongSelf = weakSelf;
    if (sourceCode && strongSelf.loading) {
      dispatch_async(bridgeQueue, ^{
        [weakSelf executeSourceCode:sourceCode];
      });
    }
  });
}

- (void)loadSource:(RCTSourceLoadBlock)_onSourceLoad {
  RCTPerformanceLoggerStart(RCTPLScriptDownload);
  int cookie = RCTProfileBeginAsyncEvent(0, @"JavaScript download", nil);

  RCTSourceLoadBlock onSourceLoad = ^(NSError *error, NSData *source) {
    RCTProfileEndAsyncEvent(0, @"init,download", cookie, @"JavaScript download", nil);
    RCTPerformanceLoggerEnd(RCTPLScriptDownload);

    // Only override the value of __DEV__ if running in debug mode, and if we
    // haven't explicitly overridden the packager dev setting in the bundleURL
    // 如果是Debug模式，强制开启 调试模式
    BOOL shouldOverrideDev = RCT_DEBUG && ([self.bundleURL isFileURL] || [self.bundleURL.absoluteString rangeOfString:@"dev="].location == NSNotFound);

    // Force JS __DEV__ value to match RCT_DEBUG
    if (shouldOverrideDev) {
      NSString *sourceString = [[NSString alloc] initWithData:source encoding:NSUTF8StringEncoding];
      NSRange range = [sourceString rangeOfString:@"\\b__DEV__\\s*?=\\s*?(!1|!0|false|true)"
                                          options:NSRegularExpressionSearch];

      RCTAssert(range.location != NSNotFound, @"It looks like the implementation"
                "of __DEV__ has changed. Update -[RCTBatchedBridge loadSource:].");

      NSString *valueString = [sourceString substringWithRange:range];
      if ([valueString rangeOfString:@"!1"].length) {
        valueString = [valueString stringByReplacingOccurrencesOfString:@"!1" withString:@"!0"];
      } else if ([valueString rangeOfString:@"false"].length) {
        valueString = [valueString stringByReplacingOccurrencesOfString:@"false" withString:@"true"];
      }
      source = [[sourceString stringByReplacingCharactersInRange:range withString:valueString]
                dataUsingEncoding:NSUTF8StringEncoding];
    }

    _onSourceLoad(error, source);
  };

  if ([self.delegate respondsToSelector:@selector(loadSourceForBridge:withBlock:)]) {
    [self.delegate loadSourceForBridge:_parentBridge withBlock:onSourceLoad];
  } else if (self.bundleURL) {
    // 主动加载JS
    [RCTJavaScriptLoader loadBundleAtURL:self.bundleURL onComplete:onSourceLoad];
  } else {
    // Allow testing without a script
    dispatch_async(dispatch_get_main_queue(), ^{
      [self didFinishLoading];
      [[NSNotificationCenter defaultCenter] postNotificationName:RCTJavaScriptDidLoadNotification
                                                          object:_parentBridge
                                                        userInfo:@{ @"bridge": self }];
    });
    onSourceLoad(nil, nil);
  }
}

//
// 如何初始化 Modules呢?
//
- (void)initModules {
  RCTAssertMainThread();
  RCTPerformanceLoggerStart(RCTPLNativeModuleInit);

  // Register passed-in module instances
  // moduleName <---> Module Class Instance(实例)
  NSMutableDictionary *preregisteredModules = [NSMutableDictionary new];

  NSArray *extraModules = nil;
  
  //
  // 1. self.delegate 一般为AppDelegate
  // 默认情况下: 没有extraModules
  //           如果我们自己扩展了一些Modules, 那么可以实现此Selector
  if (self.delegate) {
    if ([self.delegate respondsToSelector:@selector(extraModulesForBridge:)]) {
      extraModules = [self.delegate extraModulesForBridge:_parentBridge];
    }
  } else if (self.moduleProvider) {
    extraModules = self.moduleProvider();
  }

  for (id<RCTBridgeModule> module in extraModules) {
    preregisteredModules[RCTBridgeModuleNameForClass([module class])] = module;
  }

  // Instantiate modules
  _moduleDataByID = [NSMutableArray new];
  NSMutableDictionary *modulesByName = [preregisteredModules mutableCopy];

  //
  // 2. ExtraModules和系统预定义的Modules不应该重复
  //
  for (Class moduleClass in RCTGetModuleClasses()) {
     NSString *moduleName = RCTBridgeModuleNameForClass(moduleClass);

     // Check if module instance has already been registered for this name
     id<RCTBridgeModule> module = modulesByName[moduleName];

    if (module) {
       // Preregistered instances takes precedence, no questions asked
       if (!preregisteredModules[moduleName]) {
         // It's OK to have a name collision as long as the second instance is nil
         // 除非系统的module不能实例化
         RCTAssert([moduleClass new] == nil,
                   @"Attempted to register RCTBridgeModule class %@ for the name "
                   "'%@', but name was already registered by class %@", moduleClass,
                   moduleName, [modulesByName[moduleName] class]);
       }
     } else {
       // Module name hasn't been used before, so go ahead and instantiate
       module = [moduleClass new];
     }
     if (module) {
       modulesByName[moduleName] = module;
     }
  }

  //
  // 3. Store modules, 以及一个特殊的 Module(JavascriptExecutor)
  //
  _modulesByName = [[RCTModuleMap alloc] initWithDictionary:modulesByName];

  /**
   * The executor is a bridge module, wait for it to be created and set it before
   * any other module has access to the bridge
   */
  _javaScriptExecutor = _modulesByName[RCTBridgeModuleNameForClass(self.executorClass)];

  //
  // 所有的Module都共享一个 bridge
  //
  for (id<RCTBridgeModule> module in _modulesByName.allValues) {
    // Bridge must be set before moduleData is set up, as methodQueue
    // initialization requires it (View Managers get their queue by calling
    // self.bridge.uiManager.methodQueue)
    if ([module respondsToSelector:@selector(setBridge:)]) {
      module.bridge = self;
    }

    // ModuleData是做啥的?
    // 每一个Instance都有一个对应的ModuleData
    RCTModuleData *moduleData = [[RCTModuleData alloc] initWithExecutor:_javaScriptExecutor
                                                               moduleID:@(_moduleDataByID.count)
                                                               instance:module];
    [_moduleDataByID addObject:moduleData];
  }

  //
  // 4. NativeModules加载完毕
  //
  [[NSNotificationCenter defaultCenter] postNotificationName:RCTDidCreateNativeModules
                                                      object:self];
  RCTPerformanceLoggerEnd(RCTPLNativeModuleInit);
}

- (void)setupExecutor {
  [_javaScriptExecutor setUp];
}

- (NSString *)moduleConfig {
  NSMutableArray *config = [NSMutableArray new];
  for (RCTModuleData *moduleData in _moduleDataByID) {
    [config addObject:moduleData.config];

    //
    // 注意: FrameUpdate
    //
    if ([moduleData.instance conformsToProtocol:@protocol(RCTFrameUpdateObserver)]) {
      [_frameUpdateObservers addObject:moduleData];

      id<RCTFrameUpdateObserver> observer = (id<RCTFrameUpdateObserver>)moduleData.instance;
      __weak typeof(self) weakSelf = self;
      __weak typeof(_javaScriptExecutor) weakJavaScriptExecutor = _javaScriptExecutor;

      observer.pauseCallback = ^{
        [weakJavaScriptExecutor executeBlockOnJavaScriptQueue:^{
          [weakSelf updateJSDisplayLinkState];
        }];
      };
    }
  }

  return RCTJSONStringify(@{
    @"remoteModuleConfig": config,
  }, NULL);
}

- (void)updateJSDisplayLinkState
{
  RCTAssertJSThread();

  BOOL pauseDisplayLink = YES;
  for (RCTModuleData *moduleData in _frameUpdateObservers) {
    id<RCTFrameUpdateObserver> observer = (id<RCTFrameUpdateObserver>)moduleData.instance;
    if (!observer.paused) {
      pauseDisplayLink = NO;
      break;
    }
  }
  _jsDisplayLink.paused = pauseDisplayLink;
}

//
// 添加全局变量: __fbBatchedBridgeConfig
//
- (void)injectJSONConfiguration:(NSString *)configJSON
                     onComplete:(void (^)(NSError *))onComplete {
  if (!self.valid) {
    return;
  }

  //
  // 1. 添加对象:
  // global.__fbBatchedBridgeConfig
  //
  [_javaScriptExecutor injectJSONText:configJSON
                  asGlobalObjectNamed:@"__fbBatchedBridgeConfig"
                             callback:onComplete];
}

- (void)executeSourceCode:(NSData *)sourceCode {
  if (!self.valid || !_javaScriptExecutor) {
    return;
  }

  RCTSourceCode *sourceCodeModule = self.modules[RCTBridgeModuleNameForClass([RCTSourceCode class])];
  sourceCodeModule.scriptURL = self.bundleURL;
  sourceCodeModule.scriptData = sourceCode;
  
  //
  // 1. 加载JS, 执行JS的所有的Callback
  //
  [self enqueueApplicationScript:sourceCode url:self.bundleURL onComplete:^(NSError *loadError) {
    if (!self.isValid) {
      return;
    }

    if (loadError) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [self stopLoadingWithError:loadError];
      });
      return;
    }

    // Register the display link to start sending js calls after everything is setup
    NSRunLoop *targetRunLoop = [_javaScriptExecutor isKindOfClass:[RCTContextExecutor class]] ? [NSRunLoop currentRunLoop] : [NSRunLoop mainRunLoop];
    [_jsDisplayLink addToRunLoop:targetRunLoop forMode:NSRunLoopCommonModes];

    // Perform the state update and notification on the main thread, so we can't run into
    // timing issues with RCTRootView
    dispatch_async(dispatch_get_main_queue(), ^{
      [self didFinishLoading];

      [[NSNotificationCenter defaultCenter] postNotificationName:RCTJavaScriptDidLoadNotification
                                                          object:_parentBridge
                                                        userInfo:@{ @"bridge": self }];
    });
  }];
}

- (void)didFinishLoading {
  _loading = NO;
  [_javaScriptExecutor executeBlockOnJavaScriptQueue:^{
    for (NSArray *call in _pendingCalls) {
      [self _actuallyInvokeAndProcessModule:call[0]
                                     method:call[1]
                                  arguments:call[2]];
    }
  }];
}

- (void)stopLoadingWithError:(NSError *)error {
  RCTAssertMainThread();

  if (!self.isValid || !self.loading) {
    return;
  }

  _loading = NO;

  NSArray *stack = error.userInfo[@"stack"];
  if (stack) {
    [self.redBox showErrorMessage:error.localizedDescription withStack:stack];
  } else {
    [self.redBox showError:error];
  }
  RCTLogError(@"Error while loading: %@", error.localizedDescription);

  NSDictionary *userInfo = @{@"bridge": self, @"error": error};
  [[NSNotificationCenter defaultCenter] postNotificationName:RCTJavaScriptDidFailToLoadNotification
                                                      object:_parentBridge
                                                    userInfo:userInfo];
}

RCT_NOT_IMPLEMENTED(- (instancetype)initWithBundleURL:(__unused NSURL *)bundleURL
                    moduleProvider:(__unused RCTBridgeModuleProviderBlock)block
                    launchOptions:(__unused NSDictionary *)launchOptions)

/**
 * Prevent super from calling setUp (that'd create another batchedBridge)
 */
- (void)setUp {}
- (void)bindKeys {}

- (void)reload
{
  [_parentBridge reload];
}

//
// 默认为: RCTContextExecutor
// 但是如何是iOs6等，可能就是Webview了
//
- (Class)executorClass {
  return _parentBridge.executorClass ?: [RCTContextExecutor class];
}

- (void)setExecutorClass:(Class)executorClass
{
  RCTAssertMainThread();

  _parentBridge.executorClass = executorClass;
}

- (NSURL *)bundleURL
{
  return _parentBridge.bundleURL;
}

- (void)setBundleURL:(NSURL *)bundleURL
{
  _parentBridge.bundleURL = bundleURL;
}

- (id<RCTBridgeDelegate>)delegate
{
  return _parentBridge.delegate;
}

- (BOOL)isLoading
{
  return _loading;
}

- (BOOL)isValid
{
  return _valid;
}

- (NSDictionary *)modules {
  if (RCT_DEBUG && self.isValid && _modulesByName == nil) {
    RCTLogError(@"Bridge modules have not yet been initialized. You may be "
                "trying to access a module too early in the startup procedure.");
  }
  return _modulesByName;
}

#pragma mark - RCTInvalidating

- (void)invalidate {
  if (!self.valid) {
    return;
  }

  RCTAssertMainThread();

  _loading = NO;
  _valid = NO;
  
  // 1. 如果已经失效，则不再关注: invalidate
  if ([RCTBridge currentBridge] == self) {
    [RCTBridge setCurrentBridge:nil];
  }

  // 2. Invalidate modules
  dispatch_group_t group = dispatch_group_create();
  for (RCTModuleData *moduleData in _moduleDataByID) {
    // 除了JS Executor之外，其他的都统一调用 invalidate
    if (moduleData.instance == _javaScriptExecutor) {
      continue;
    }

    if ([moduleData.instance respondsToSelector:@selector(invalidate)]) {
      [moduleData dispatchBlock:^{
        [(id<RCTInvalidating>)moduleData.instance invalidate];
      } dispatchGroup:group];
    }
    moduleData.queue = nil;
  }

  // 3. 所有的modules invalidate之后怎么办?
  dispatch_group_notify(group, dispatch_get_main_queue(), ^{
    [_javaScriptExecutor executeBlockOnJavaScriptQueue:^{
      [_jsDisplayLink invalidate];
      _jsDisplayLink = nil;

      [_javaScriptExecutor invalidate];
      _javaScriptExecutor = nil;

      if (RCTProfileIsProfiling()) {
        RCTProfileUnhookModules(self);
      }
      _moduleDataByID = nil;
      _modulesByName = nil;
      _frameUpdateObservers = nil;

    }];
  });
}

- (void)logMessage:(NSString *)message level:(NSString *)level {
  // 如果开启Log, 则通过调用JS输出日志
  // 也可以在XCode中输出日志
  if (RCT_DEBUG) {
    [_javaScriptExecutor executeJSCall:@"RCTLog"
                                method:@"logIfNoNativeHook"
                             arguments:@[level, message]
                              callback:^(__unused id json, __unused NSError *error) {}];
  }
}

#pragma mark - RCTBridge methods

/**
 * Public. Can be invoked from any thread.
 */
- (void)enqueueJSCall:(NSString *)moduleDotMethod args:(NSArray *)args {
  // 参数调用的格式:
  // 字符串0, 字符串1, ..., 参数数组
  // moduleDotMethod 注意参数的格式
  NSArray *ids = [moduleDotMethod componentsSeparatedByString:@"."];

  [self _invokeAndProcessModule:@"BatchedBridge"
                         method:@"callFunctionReturnFlushedQueue"
                      arguments:@[ids[0], ids[1], args ?: @[]]];
}

/**
 * Private hack to support `setTimeout(fn, 0)`
 * 异步执行
 */
- (void)_immediatelyCallTimer:(NSNumber *)timer {
  RCTAssertJSThread();

  dispatch_block_t block = ^{
    [self _actuallyInvokeAndProcessModule:@"BatchedBridge"
                                   method:@"callFunctionReturnFlushedQueue"
                                arguments:@[@"JSTimersExecution", @"callTimers", @[@[timer]]]];
  };

  // “优先”异步执行block？
  if ([_javaScriptExecutor respondsToSelector:@selector(executeAsyncBlockOnJavaScriptQueue:)]) {
    [_javaScriptExecutor executeAsyncBlockOnJavaScriptQueue:block];
  } else {
    [_javaScriptExecutor executeBlockOnJavaScriptQueue:block];
  }
}

- (void)enqueueApplicationScript:(NSData *)script
                             url:(NSURL *)url
                      onComplete:(RCTJavaScriptCompleteBlock)onComplete {
  RCTAssert(onComplete != nil, @"onComplete block passed in should be non-nil");

  RCTProfileBeginFlowEvent();
  // 加载完毕新的脚本，然后flushedQueue, 批量执行脚本
  [_javaScriptExecutor executeApplicationScript:script sourceURL:url onComplete:^(NSError *scriptLoadError) {
    RCTProfileEndFlowEvent();
    RCTAssertJSThread();

    if (scriptLoadError) {
      onComplete(scriptLoadError);
      return;
    }

    RCTProfileBeginEvent(0, @"FetchApplicationScriptCallbacks", nil);

    [_javaScriptExecutor executeJSCall:@"BatchedBridge"
                                method:@"flushedQueue"
                             arguments:@[]
                              callback:^(id json, NSError *error) {
       RCTProfileEndEvent(0, @"js_call,init", @{
         @"json": RCTNullIfNil(json),
         @"error": RCTNullIfNil(error),
       });
                              
       [self handleBuffer:json batchEnded:YES];

       onComplete(error);
     }];
  }];
}

#pragma mark - Payload Generation

/**
 * Called by enqueueJSCall from any thread, or from _immediatelyCallTimer,
 * on the JS thread, but only in non-batched mode.
 */
- (void)_invokeAndProcessModule:(NSString *)module method:(NSString *)method arguments:(NSArray *)args {
  /**
   * AnyThread
   */

  RCTProfileBeginFlowEvent();

  __weak RCTBatchedBridge *weakSelf = self;
  [_javaScriptExecutor executeBlockOnJavaScriptQueue:^{
    RCTProfileEndFlowEvent();
    RCTProfileBeginEvent(0, @"enqueue_call", nil);

    RCTBatchedBridge *strongSelf = weakSelf;
    if (!strongSelf || !strongSelf.valid) {
      return;
    }

    // 调用JS函数
    // 或延迟调用JS函数
    if (strongSelf.loading) {
      [strongSelf->_pendingCalls addObject:@[module, method, args]];
    } else {
      [strongSelf _actuallyInvokeAndProcessModule:module method:method arguments:args];
    }
  }];
}

- (void)_actuallyInvokeAndProcessModule:(NSString *)module
                                 method:(NSString *)method
                              arguments:(NSArray *)args {
  RCTAssertJSThread();

  [[NSNotificationCenter defaultCenter] postNotificationName:RCTEnqueueNotification object:nil userInfo:nil];

  RCTJavaScriptCallback processResponse = ^(id json, NSError *error) {
    // 如果出错，则显示 红盒子（redBox)
    if (error) {
      [self.redBox showError:error];
    }

    if (!self.isValid) {
      return;
    }
    
    // JS处理完毕
    [[NSNotificationCenter defaultCenter] postNotificationName:RCTDequeueNotification object:nil userInfo:nil];
    
    // handleBuffer如何处理?
    [self handleBuffer:json batchEnded:YES];
  };

  [_javaScriptExecutor executeJSCall:module
                              method:method
                           arguments:args
                            callback:processResponse];
}

#pragma mark - Payload Processing

- (void)handleBuffer:(id)buffer batchEnded:(BOOL)batchEnded {
  RCTAssertJSThread();

  if (buffer != nil && buffer != (id)kCFNull) {
    _wasBatchActive = YES;
    [self handleBuffer:buffer];
  }

  if (batchEnded) {
    if (_wasBatchActive) {
      [self batchDidComplete];
    }

    _wasBatchActive = NO;
  }
}

- (void)handleBuffer:(id)buffer {
  // 1. 确保返回的数据位: Array
  NSArray *requestsArray = [RCTConvert NSArray:buffer];

#if RCT_DEBUG

  if (![buffer isKindOfClass:[NSArray class]]) {
    RCTLogError(@"Buffer must be an instance of NSArray, got %@", NSStringFromClass([buffer class]));
    return;
  }

  for (NSUInteger fieldIndex = RCTBridgeFieldRequestModuleIDs; fieldIndex <= RCTBridgeFieldParamss; fieldIndex++) {
    id field = requestsArray[fieldIndex];
    if (![field isKindOfClass:[NSArray class]]) {
      RCTLogError(@"Field at index %zd in buffer must be an instance of NSArray, got %@", fieldIndex, NSStringFromClass([field class]));
      return;
    }
  }

#endif

  // 2. Array包含3个元素，每个元素都是一个队列
  NSArray *moduleIDs = requestsArray[RCTBridgeFieldRequestModuleIDs];
  NSArray *methodIDs = requestsArray[RCTBridgeFieldMethodIDs];
  NSArray *paramsArrays = requestsArray[RCTBridgeFieldParamss];

  NSUInteger numRequests = moduleIDs.count;

  if (RCT_DEBUG && (numRequests != methodIDs.count || numRequests != paramsArrays.count)) {
    RCTLogError(@"Invalid data message - all must be length: %zd", numRequests);
    return;
  }

  
  // 基于Map的HashTable
  NSMapTable *buckets = [[NSMapTable alloc] initWithKeyOptions:NSPointerFunctionsStrongMemory
                                                  valueOptions:NSPointerFunctionsStrongMemory
                                                      capacity:_moduleDataByID.count];

  // 如何执行代码呢?
  for (NSUInteger i = 0; i < numRequests; i++) {
    // 1. 首先获得Module
    RCTModuleData *moduleData = _moduleDataByID[[moduleIDs[i] integerValue]];
    if (RCT_DEBUG) {
      // verify that class has been registered
      (void)_modulesByName[moduleData.name];
    }
    
    // 2.
    id queue = [moduleData queue];
    NSMutableOrderedSet *set = [buckets objectForKey:queue];
    if (!set) {
      set = [NSMutableOrderedSet new];
      [buckets setObject:set forKey:queue];
    }

    // 将任务分配到不同的queue中，保持已有的顺序; 同时保证唯一
    [set addObject:@(i)];
  }

  // 然后按照queue一个一个地处理（其实就是任务分发，各个queue是并行的）
  for (id queue in buckets) {
    RCTProfileBeginFlowEvent();

    dispatch_block_t block = ^{
      RCTProfileEndFlowEvent();
      RCTProfileBeginEvent(0, RCTCurrentThreadName(), nil);

      NSOrderedSet *calls = [buckets objectForKey:queue];
      @autoreleasepool {
        for (NSNumber *indexObj in calls) {
          NSUInteger index = indexObj.unsignedIntegerValue;
          [self _handleRequestNumber:index
                            moduleID:[moduleIDs[index] integerValue]
                            methodID:[methodIDs[index] integerValue]
                              params:paramsArrays[index]];
        }
      }

      RCTProfileEndEvent(0, @"objc_call,dispatch_async", @{
        @"calls": @(calls.count),
      });
    };
    
    // JSThread直接执行
    if (queue == RCTJSThread) {
      [_javaScriptExecutor executeBlockOnJavaScriptQueue:block];
    } else if (queue) {
      // 其他的thread异步执行
      dispatch_async(queue, block);
    }
  }
}

- (void)batchDidComplete
{
  // TODO: batchDidComplete is only used by RCTUIManager - can we eliminate this special case?
  //
  // DOM Tree等修改是批量进行的，一口气改完，然后再Render
  //
  for (RCTModuleData *moduleData in _moduleDataByID) {
    if ([moduleData.instance respondsToSelector:@selector(batchDidComplete)]) {
      [moduleData dispatchBlock:^{
        [moduleData.instance batchDidComplete];
      }];
    }
  }
}

- (BOOL)_handleRequestNumber:(NSUInteger)i
                    moduleID:(NSUInteger)moduleID
                    methodID:(NSUInteger)methodID
                      params:(NSArray *)params {
  if (!self.isValid) {
    return NO;
  }

  if (RCT_DEBUG && ![params isKindOfClass:[NSArray class]]) {
    RCTLogError(@"Invalid module/method/params tuple for request #%zd", i);
    return NO;
  }

  RCTProfileBeginEvent(0, @"Invoke callback", nil);

  RCTModuleData *moduleData = _moduleDataByID[moduleID];
  if (RCT_DEBUG && !moduleData) {
    RCTLogError(@"No module found for id '%zd'", moduleID);
    return NO;
  }

  id<RCTBridgeMethod> method = moduleData.methods[methodID];
  if (RCT_DEBUG && !method) {
    RCTLogError(@"Unknown methodID: %zd for module: %zd (%@)", methodID, moduleID, moduleData.name);
    return NO;
  }

  // OC如何执行JS的调用呢?
  // 获取moduleData, method, 以及params
  // 接下来反序列化等等
  //
  @try {
    [method invokeWithBridge:self module:moduleData.instance arguments:params];
  }
  @catch (NSException *exception) {
    RCTLogError(@"Exception thrown while invoking %@ on target %@ with params %@: %@", method.JSMethodName, moduleData.name, params, exception);
    if (!RCT_DEBUG && [exception.name rangeOfString:@"Unhandled JS Exception"].location != NSNotFound) {
      @throw exception;
    }
  }

  NSMutableDictionary *args = [method.profileArgs mutableCopy];
  [args setValue:method.JSMethodName forKey:@"method"];
  [args setValue:RCTJSONStringify(RCTNullIfNil(params), NULL) forKey:@"args"];

  RCTProfileEndEvent(0, @"objc_call", args);

  return YES;
}

//
- (void)_jsThreadUpdate:(CADisplayLink *)displayLink {
  RCTAssertJSThread();
  RCTProfileBeginEvent(0, @"DispatchFrameUpdate", nil);

  // 1. 构建一个FrameUpdate数据结构
  RCTFrameUpdate *frameUpdate = [[RCTFrameUpdate alloc] initWithDisplayLink:displayLink];
  
  for (RCTModuleData *moduleData in _frameUpdateObservers) {
    id<RCTFrameUpdateObserver> observer = (id<RCTFrameUpdateObserver>)moduleData.instance;
    
    // 如果paused, 那么不再通知
    if (!observer.paused) {
      // 如果不使用DEV, 那么后面的name也不需要了
      RCT_IF_DEV(NSString *name = [NSString stringWithFormat:@"[%@ didUpdateFrame:%f]", observer, displayLink.timestamp];)
      RCTProfileBeginFlowEvent();

      [moduleData dispatchBlock:^{
        RCTProfileEndFlowEvent();
        RCTProfileBeginEvent(0, name, nil);
        
        [observer didUpdateFrame:frameUpdate];
        
        RCTProfileEndEvent(0, @"objc_call,fps", nil);
      }];
    }
  }

  [self updateJSDisplayLinkState];


  RCTProfileImmediateEvent(0, @"JS Thread Tick", 'g');

  RCTProfileEndEvent(0, @"objc_call", nil);
}

- (void)startProfiling {
  RCTAssertMainThread();

  [_javaScriptExecutor executeBlockOnJavaScriptQueue:^{
    RCTProfileInit(self);
  }];
}

- (void)stopProfiling:(void (^)(NSData *))callback {
  RCTAssertMainThread();

  [_javaScriptExecutor executeBlockOnJavaScriptQueue:^{
    NSString *log = RCTProfileEnd(self);
    NSData *logData = [log dataUsingEncoding:NSUTF8StringEncoding];
    callback(logData);
  }];
}

@end
