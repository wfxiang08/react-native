/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTBridge.h"

#import <objc/runtime.h>

#import "RCTEventDispatcher.h"
#import "RCTKeyCommands.h"
#import "RCTLog.h"
#import "RCTPerformanceLogger.h"
#import "RCTUtils.h"

NSString *const RCTReloadNotification = @"RCTReloadNotification";
NSString *const RCTJavaScriptWillStartLoadingNotification = @"RCTJavaScriptWillStartLoadingNotification";
NSString *const RCTJavaScriptDidLoadNotification = @"RCTJavaScriptDidLoadNotification";
NSString *const RCTJavaScriptDidFailToLoadNotification = @"RCTJavaScriptDidFailToLoadNotification";
NSString *const RCTDidCreateNativeModules = @"RCTDidCreateNativeModules";

// 提前声明
@class RCTBatchedBridge;

//----------------------------------------------------------------------------------------------------------------------
@interface RCTBatchedBridge : RCTBridge <RCTInvalidating>

@property (nonatomic, weak) RCTBridge *parentBridge;

- (instancetype)initWithParentBridge:(RCTBridge *)bridge NS_DESIGNATED_INITIALIZER;

@end

//----------------------------------------------------------------------------------------------------------------------
@interface RCTBridge ()
// 内部引用的 batchedBridge
@property (nonatomic, strong) RCTBatchedBridge *batchedBridge;

@end

//----------------------------------------------------------------------------------------------------------------------
// 类似单例?
static NSMutableArray *RCTModuleClasses;

// 声明 & 实现
NSArray *RCTGetModuleClasses(void);
NSArray *RCTGetModuleClasses(void) {
  return RCTModuleClasses;
}

/**
 * Register the given class as a bridge module. All modules must be registered
 * prior to the first bridge initialization.
 */
void RCTRegisterModule(Class);
// 注册就是把ModuleClass添加到数组中
void RCTRegisterModule(Class moduleClass) {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    RCTModuleClasses = [NSMutableArray new];
  });

  RCTAssert([moduleClass conformsToProtocol:@protocol(RCTBridgeModule)],
            @"%@ does not conform to the RCTBridgeModule protocol",
            moduleClass);

  // Register module
  [RCTModuleClasses addObject:moduleClass];
}

/**
 * This function returns the module name for a given class.
 */
NSString *RCTBridgeModuleNameForClass(Class cls) {
#if RCT_DEV
  RCTAssert([cls conformsToProtocol:@protocol(RCTBridgeModule)], @"Bridge module classes must conform to RCTBridgeModule");
#endif

  // RCTBridgeModule
  // 要么自带 moduleName
  // 要么使用ClassName
  // 如果Name以RK开头，则RK统一替换为: RCT
  //
  NSString *name = [cls moduleName];
  if (name.length == 0) {
    name = NSStringFromClass(cls);
  }
  if ([name hasPrefix:@"RK"]) {
    name = [name stringByReplacingCharactersInRange:(NSRange){0,@"RK".length} withString:@"RCT"];
  }
  return name;
}

/**
 * Check if class has been registered
 */
BOOL RCTBridgeModuleClassIsRegistered(Class);
BOOL RCTBridgeModuleClassIsRegistered(Class cls) {
  // 为什么默认是 已经注册呢?
  return [objc_getAssociatedObject(cls, &RCTBridgeModuleClassIsRegistered) ?: @YES boolValue];
}

//----------------------------------------------------------------------------------------------------------------------
@implementation RCTBridge

dispatch_queue_t RCTJSThread;

+ (void)initialize {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{

    // Set up JS thread
    // 不太明白?
    RCTJSThread = (id)kCFNull;

#if RCT_DEBUG
    // 正常Release是如何工作的呢?
    // Set up module classes
    static unsigned int classCount;
    Class *classes = objc_copyClassList(&classCount);
    
    // 遍历所有的Class
    for (unsigned int i = 0; i < classCount; i++) {
      Class cls = classes[i];
      
      // 对于实现了协议: RCTBridgeModule 的class, 将它注册到 RCTModuleClasses 中
      Class superclass = cls;
      while (superclass) {
        if (class_conformsToProtocol(superclass, @protocol(RCTBridgeModule))) {
          
          if (![RCTModuleClasses containsObject:cls]) {
            RCTLogWarn(@"Class %@ was not exported. Did you forget to use "
                       "RCT_EXPORT_MODULE()?", cls);

            RCTRegisterModule(cls);
            // XXX: 为什么设置为NO呢? 奇怪
            objc_setAssociatedObject(cls, &RCTBridgeModuleClassIsRegistered,
                                     @NO, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
          }
          break;
        }
        
        // 继续沿着class hierarchy遍历
        superclass = class_getSuperclass(superclass);
      }
    }

    free(classes);

#endif

  });
}

static RCTBridge *RCTCurrentBridgeInstance = nil;

/**
 * The last current active bridge instance. This is set automatically whenever
 * the bridge is accessed. It can be useful for static functions or singletons
 * that need to access the bridge for purposes such as logging, but should not
 * be relied upon to return any particular instance, due to race conditions.
 */
+ (instancetype)currentBridge {
  return RCTCurrentBridgeInstance;
}

+ (void)setCurrentBridge:(RCTBridge *)currentBridge {
  RCTCurrentBridgeInstance = currentBridge;
}

- (instancetype)initWithDelegate:(id<RCTBridgeDelegate>)delegate
                   launchOptions:(NSDictionary *)launchOptions {
  RCTAssertMainThread();

  if ((self = [super init])) {
    RCTPerformanceLoggerStart(RCTPLTTI);
    
    _delegate = delegate;
    _launchOptions = [launchOptions copy];

    [self setUp];
    [self bindKeys];
  }
  return self;
}

- (instancetype)initWithBundleURL:(NSURL *)bundleURL
                   moduleProvider:(RCTBridgeModuleProviderBlock)block
                    launchOptions:(NSDictionary *)launchOptions {
  RCTAssertMainThread();

  if ((self = [super init])) {
    RCTPerformanceLoggerStart(RCTPLTTI);

    _bundleURL = bundleURL;
    _moduleProvider = block;
    _launchOptions = [launchOptions copy];
    [self setUp];
    [self bindKeys];
  }
  return self;
}

RCT_NOT_IMPLEMENTED(- (instancetype)init)

- (void)dealloc {
  /**
   * This runs only on the main thread, but crashes the subclass
   * RCTAssertMainThread();
   */
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  [self invalidate];
}

- (void)bindKeys {
  RCTAssertMainThread();

  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(reload)
                                               name:RCTReloadNotification
                                             object:nil];

#if TARGET_IPHONE_SIMULATOR
  // 在iOs模拟器上监控: Cmd + R 快捷键
  // 用于处理: reload
  RCTKeyCommands *commands = [RCTKeyCommands sharedInstance];

  // reload in current mode
  [commands registerKeyCommandWithInput:@"r"
                          modifierFlags:UIKeyModifierCommand
                                 action:^(__unused UIKeyCommand *command) {
                                    // 在两个地方回发送 RCTReloadNotification
                                    // 1. 模拟器: Cmd + R
                                    // 2. redBox 重新加载
                                    [[NSNotificationCenter defaultCenter] postNotificationName:RCTReloadNotification
                                                                                        object:nil
                                                                                      userInfo:nil];
                                 }];

#endif
}

- (RCTEventDispatcher *)eventDispatcher {
  return self.modules[RCTBridgeModuleNameForClass([RCTEventDispatcher class])];
}

- (void)reload {
  /**
   * AnyThread
   */
  dispatch_async(dispatch_get_main_queue(), ^{
    // 确保最终的在main_queue中执行
    [self invalidate];
    [self setUp];
  });
}

- (void)setUp {
  RCTAssertMainThread();
  // 0. PreCondition
  // 状态都Clear干净了
  
  // 1. 获取URL
  _bundleURL = [self.delegate sourceURLForBridge:self] ?: _bundleURL;
  
  // 2. 重建Bridge
  // _batchedBridge==NULL
  _batchedBridge = [[RCTBatchedBridge alloc] initWithParentBridge:self];
}

- (BOOL)isLoading {
  return _batchedBridge.loading;
}

- (BOOL)isValid {
  return _batchedBridge.valid;
}

- (void)invalidate {
  RCTAssertMainThread();
  
  // 情况状态
  [_batchedBridge invalidate];
  _batchedBridge = nil;
}

// 通过JS处理 log
- (void)logMessage:(NSString *)message level:(NSString *)level {
  [_batchedBridge logMessage:message level:level];
}

- (NSDictionary *)modules {
  return _batchedBridge.modules;
}

#define RCT_INNER_BRIDGE_ONLY(...) \
- (void)__VA_ARGS__ \
{ \
  RCTLogMustFix(@"Called method \"%@\" on top level bridge. This method should \
              only be called from bridge instance in a bridge module", @(__func__)); \
}

- (void)enqueueJSCall:(NSString *)moduleDotMethod args:(NSArray *)args {
  [self.batchedBridge enqueueJSCall:moduleDotMethod args:args];
}

// ???
RCT_INNER_BRIDGE_ONLY(_invokeAndProcessModule:(__unused NSString *)module
                      method:(__unused NSString *)method
                      arguments:(__unused NSArray *)args);
@end
