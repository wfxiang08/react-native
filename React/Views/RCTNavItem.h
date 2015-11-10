/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import <UIKit/UIKit.h>

#import "RCTComponent.h"

// 这个是如何工作的呢?
// 应该就是我们所看到的NavigationBar了
// RCTNavItem 作为一个 UIView 作用?
//
@interface RCTNavItem : UIView

@property (nonatomic, copy) NSString *title;

// Left Button
@property (nonatomic, strong) UIImage *leftButtonIcon;
@property (nonatomic, copy) NSString *leftButtonTitle;

// Right Button
@property (nonatomic, strong) UIImage *rightButtonIcon;
@property (nonatomic, copy) NSString *rightButtonTitle;

// Back Button
@property (nonatomic, strong) UIImage *backButtonIcon;
@property (nonatomic, copy) NSString *backButtonTitle;

// 属性
@property (nonatomic, assign) BOOL navigationBarHidden;
@property (nonatomic, assign) BOOL shadowHidden;

@property (nonatomic, strong) UIColor *tintColor;
@property (nonatomic, strong) UIColor *barTintColor;
@property (nonatomic, strong) UIColor *titleTextColor;
@property (nonatomic, assign) BOOL translucent;

// 对应的原生的实现
@property (nonatomic, readonly) UIBarButtonItem *backButtonItem;
@property (nonatomic, readonly) UIBarButtonItem *leftButtonItem;
@property (nonatomic, readonly) UIBarButtonItem *rightButtonItem;

// Callback
@property (nonatomic, copy) RCTBubblingEventBlock onNavLeftButtonTap;
@property (nonatomic, copy) RCTBubblingEventBlock onNavRightButtonTap;

@end
