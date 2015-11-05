/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTAppState.h"

#import "RCTAssert.h"
#import "RCTBridge.h"
#import "RCTEventDispatcher.h"
#import "RCTUtils.h"

static NSString *RCTCurrentAppBackgroundState() {
  // App的状态转换成为字符串
  static NSDictionary *states;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    states = @{
      @(UIApplicationStateActive): @"active",
      @(UIApplicationStateBackground): @"background",
      @(UIApplicationStateInactive): @"inactive"
    };
  });

  if (RCTRunningInAppExtension()) {
    return @"extension";
  }

  return states[@(RCTSharedApplication().applicationState)] ?: @"unknown";
}

@implementation RCTAppState {
  NSString *_lastKnownState;
}

@synthesize bridge = _bridge;

RCT_EXPORT_MODULE()

#pragma mark - Lifecycle

- (instancetype)init {
  if ((self = [super init])) {

    _lastKnownState = RCTCurrentAppBackgroundState();

    // 观察App的各种状态
    for (NSString *name in @[UIApplicationDidBecomeActiveNotification,
                             UIApplicationDidEnterBackgroundNotification,
                             UIApplicationDidFinishLaunchingNotification]) {
      [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleAppStateDidChange)
                                                   name:name
                                                 object:nil];
    }

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleMemoryWarning)
                                                 name:UIApplicationDidReceiveMemoryWarningNotification
                                               object:nil];
    
    // 在selector中将当前观察的状态返回
  }
  return self;
}

// 接受具体的通知
// 然后再转发给....
- (void)handleMemoryWarning {
  [_bridge.eventDispatcher sendDeviceEventWithName:@"memoryWarning"
                                              body:nil];
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

#pragma mark - App Notification Methods

- (void)handleAppStateDidChange {
  NSString *newState = RCTCurrentAppBackgroundState();
  
  // 记录当前的状态，如果状态发生改变，则通过JS发送状态变化信息
  if (![newState isEqualToString:_lastKnownState]) {
    _lastKnownState = newState;
    [_bridge.eventDispatcher sendDeviceEventWithName:@"appStateDidChange"
                                                body:@{@"app_state": _lastKnownState}];
  }
}

#pragma mark - Public API

/**
 * Get the current background/foreground state of the app
 */
RCT_EXPORT_METHOD(getCurrentAppState:(RCTResponseSenderBlock)callback
                  error:(__unused RCTResponseSenderBlock)error) {
  // 这种接口是如何映射的呢?
  callback(@[@{@"app_state": _lastKnownState}]);
}

@end
