/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import <Foundation/Foundation.h>

//
// 基本上就是: _modulesByName
// 其他的都是外壳，以及一些debug模式下的检查
//
@interface RCTModuleMap : NSDictionary

- (instancetype)initWithDictionary:(NSDictionary *)modulesByName NS_DESIGNATED_INITIALIZER;

@end
