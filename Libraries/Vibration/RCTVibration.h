/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTBridgeModule.h"

// 只是一个Manager之类的对象，
// Manager负责方法的导出，接口的定制
// 其他的对象负责在功能上适配
//
@interface RCTVibration : NSObject <RCTBridgeModule>

@end
