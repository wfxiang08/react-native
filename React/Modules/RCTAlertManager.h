/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import <UIKit/UIKit.h>

#import "RCTBridgeModule.h"
#import "RCTInvalidating.h"

//
// 如何定义一个RCTBridgeModule呢?
// BridgeModule是一个固定的对象，调用他们的方法时，一般像调用一个工厂方法，创建一个实例，然后做某件事情
@interface RCTAlertManager : NSObject <RCTBridgeModule, RCTInvalidating>

@end
