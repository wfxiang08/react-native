/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTSettingsManager.h"

#import "RCTBridge.h"
#import "RCTConvert.h"
#import "RCTEventDispatcher.h"
#import "RCTUtils.h"

@implementation RCTSettingsManager
{
  BOOL _ignoringUpdates;
  NSUserDefaults *_defaults;
}

@synthesize bridge = _bridge;
// 1. 任何Module的标准实现
RCT_EXPORT_MODULE()

- (instancetype)init {
  // 默认的实现
  return [self initWithUserDefaults:[NSUserDefaults standardUserDefaults]];
}

- (instancetype)initWithUserDefaults:(NSUserDefaults *)defaults {
  if ((self = [super init])) {
    _defaults = defaults;
    // 在userDefaults被修改之后通知。。。
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(userDefaultsDidChange:)
                                                 name:NSUserDefaultsDidChangeNotification
                                               object:_defaults];
  }

  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)userDefaultsDidChange:(NSNotification *)note
{
  if (_ignoringUpdates) {
    return;
  }

  // 如何通过 _bridege来通知: settingsUpdated
  [_bridge.eventDispatcher sendDeviceEventWithName: @"settingsUpdated"
                                              body: RCTJSONClean([_defaults dictionaryRepresentation])];
}

- (NSDictionary *)constantsToExport {
  // Long Lived的对象，数据不会轻易改变，或者两边能同步改变
  return @{
    @"settings": RCTJSONClean([_defaults dictionaryRepresentation])
  };
}

/**
 * Set one or more values in the settings.
 * TODO: would it be useful to have a callback for when this has completed?
 */
RCT_EXPORT_METHOD(setValues:(NSDictionary *)values)
{
  // JS主动调用的，因此不进行Notification, 否则就会出现死循环
  _ignoringUpdates = YES;
  [values enumerateKeysAndObjectsUsingBlock:^(NSString *key, id json, BOOL *stop) {
    id plist = [RCTConvert NSPropertyList:json];
    if (plist) {
      [_defaults setObject:plist forKey:key];
    } else {
      [_defaults removeObjectForKey:key];
    }
  }];

  [_defaults synchronize];
  _ignoringUpdates = NO;
}

/**
 * Remove some values from the settings.
 */
RCT_EXPORT_METHOD(deleteValues:(NSStringArray *)keys)
{
  _ignoringUpdates = YES;
  for (NSString *key in keys) {
    [_defaults removeObjectForKey:key];
  }

  [_defaults synchronize];
  _ignoringUpdates = NO;
}

@end
