/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTWrapperViewController.h"

#import <UIKit/UIScrollView.h>

#import "RCTEventDispatcher.h"
#import "RCTNavItem.h"
#import "RCTUtils.h"
#import "RCTViewControllerProtocol.h"
#import "UIView+React.h"
#import "RCTAutoInsetsProtocol.h"

//----------------------------------------------------------------------------------------------------------------------
@implementation RCTWrapperViewController {
  UIView *_wrapperView;
  UIView *_contentView;
  RCTEventDispatcher *_eventDispatcher;
  CGFloat _previousTopLayoutLength;
  CGFloat _previousBottomLayoutLength;
}

@synthesize currentTopLayoutGuide = _currentTopLayoutGuide;
@synthesize currentBottomLayoutGuide = _currentBottomLayoutGuide;

- (instancetype)initWithContentView:(UIView *)contentView {
  RCTAssertParam(contentView);

  if ((self = [super initWithNibName:nil bundle:nil])) {
    _contentView = contentView;
    self.automaticallyAdjustsScrollViewInsets = NO;
  }
  return self;
}

// RCTNavItem居然也是一个ContentView
// 现在内心一片混乱
- (instancetype)initWithNavItem:(RCTNavItem *)navItem {
  if ((self = [self initWithContentView:navItem])) {
    _navItem = navItem;
  }
  return self;
}

RCT_NOT_IMPLEMENTED(- (instancetype)initWithNibName:(NSString *)nn bundle:(NSBundle *)nb)
RCT_NOT_IMPLEMENTED(- (instancetype)initWithCoder:(NSCoder *)aDecoder)

- (void)viewWillLayoutSubviews {
  [super viewWillLayoutSubviews];

  // 这个? 暂不懂
  _currentTopLayoutGuide = self.topLayoutGuide;
  _currentBottomLayoutGuide = self.bottomLayoutGuide;
}

//
// 递归访问所有的View, 并且调用它们的: refreshContentInset
//
static BOOL RCTFindScrollViewAndRefreshContentInsetInView(UIView *view) {
  if ([view conformsToProtocol:@protocol(RCTAutoInsetsProtocol)]) {
    [(id <RCTAutoInsetsProtocol>) view refreshContentInset];
    return YES;
  }
  for (UIView *subview in view.subviews) {
    if (RCTFindScrollViewAndRefreshContentInsetInView(subview)) {
      return YES;
    }
  }
  return NO;
}

- (void)viewDidLayoutSubviews {
  [super viewDidLayoutSubviews];

  // ???
  if (_previousTopLayoutLength != _currentTopLayoutGuide.length ||
      _previousBottomLayoutLength != _currentBottomLayoutGuide.length) {
    RCTFindScrollViewAndRefreshContentInsetInView(_contentView);
    _previousTopLayoutLength = _currentTopLayoutGuide.length;
    _previousBottomLayoutLength = _currentBottomLayoutGuide.length;
  }
}

//
// 什么是 ShadowView 呢?
// 没有定义，只有特征，高度为1的UIImageView
//
static UIView *RCTFindNavBarShadowViewInView(UIView *view) {
  if ([view isKindOfClass:[UIImageView class]] && view.bounds.size.height <= 1) {
    return view;
  }
  for (UIView *subview in view.subviews) {
    UIView *shadowView = RCTFindNavBarShadowViewInView(subview);
    if (shadowView) {
      return shadowView;
    }
  }
  return nil;
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];

  // TODO: find a way to make this less-tightly coupled to navigation controller
  // 如果有导航栏
  if ([self.parentViewController isKindOfClass:[UINavigationController class]]) {
    // 如何是吸纳: _navItem到navigationController的映射呢?
    [self.navigationController setNavigationBarHidden:_navItem.navigationBarHidden animated:animated];

    // 在View将会出现的时候，修改: UINavigationBar
    UINavigationBar *bar = self.navigationController.navigationBar;
    bar.barTintColor = _navItem.barTintColor; // 背景颜色
    bar.tintColor = _navItem.tintColor;       // 文字颜色
    bar.translucent = _navItem.translucent;   // 是否透明
    
    // 修改文字颜色
    bar.titleTextAttributes = _navItem.titleTextColor ? @{
      NSForegroundColorAttributeName: _navItem.titleTextColor
    } : nil;

    RCTFindNavBarShadowViewInView(bar).hidden = _navItem.shadowHidden;

    // 如何定制
    UINavigationItem *item = self.navigationItem;
    item.title = _navItem.title;
    item.backBarButtonItem = _navItem.backButtonItem;
    item.leftBarButtonItem = _navItem.leftButtonItem;
    item.rightBarButtonItem = _navItem.rightButtonItem;
  }
}

- (void)loadView {
  // Add a wrapper so that the wrapper view managed by the
  // UINavigationController doesn't end up resetting the frames for
  //`contentView` which is a react-managed view.
  _wrapperView = [[UIView alloc] initWithFrame:_contentView.bounds];
  [_wrapperView addSubview:_contentView];
  self.view = _wrapperView;
}

- (void)didMoveToParentViewController:(UIViewController *)parent {
  // There's no clear setter for navigation controllers, but did move to parent
  // view controller provides the desired effect. This is called after a pop
  // finishes, be it a swipe to go back or a standard tap on the back button
  [super didMoveToParentViewController:parent];
  
  // 找一个机会获取 navigationControllers
  if (parent == nil || [parent isKindOfClass:[UINavigationController class]]) {
    [self.navigationListener wrapperViewController:self
                     didMoveToNavigationController:(UINavigationController *)parent];
  }
}

@end
