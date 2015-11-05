/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTTabBar.h"

#import "RCTEventDispatcher.h"
#import "RCTLog.h"
#import "RCTTabBarItem.h"
#import "RCTUtils.h"
#import "RCTView.h"
#import "RCTViewControllerProtocol.h"
#import "RCTWrapperViewController.h"
#import "UIView+React.h"

//
// iOS的界面组成
// 1. 由一系列带有特定功能的界面组合而成
// 2. 这些views有的和viewController绑定，共同构成UIViewController
//
@interface RCTTabBar() <UITabBarControllerDelegate>

@end

@implementation RCTTabBar {
  BOOL _tabsChanged;
  UITabBarController *_tabController;
  NSMutableArray *_tabViews;
}

// TabBar和_tabController的关系?
- (instancetype)initWithFrame:(CGRect)frame {
  if ((self = [super initWithFrame:frame])) {
    _tabViews = [NSMutableArray new];
    
    // 内部包含一个全屏的View
    // UILayoutContainerView
    // UITransitionView
    // UIViewControllerWrapperView
    //
    // 由于UITabBarController的属性，因此在RCTTabBar上又自动增加了以上三个View
    _tabController = [UITabBarController new];
    _tabController.delegate = self;
    
    NSLog(@"ViewClass: %@", [_tabController.view class]);
    [self addSubview: _tabController.view]; // UIView
  }
  return self;
}

RCT_NOT_IMPLEMENTED(- (instancetype)initWithCoder:(NSCoder *)aDecoder)

- (UIViewController *)reactViewController {
  return _tabController;
}

- (void)dealloc {
  _tabController.delegate = nil;
}

- (NSArray *)reactSubviews {
  return _tabViews;
}

- (void)insertReactSubview:(UIView *)view atIndex:(NSInteger)atIndex {
  if (![view isKindOfClass:[RCTTabBarItem class]]) {
    RCTLogError(@"subview should be of type RCTTabBarItem");
    return;
  }
  
  // 添加tabs
  // 当时tabs没有直接加入Views中
  //
  [_tabViews insertObject:view atIndex:atIndex];
  _tabsChanged = YES;
}

- (void)removeReactSubview:(UIView *)subview {
  if (_tabViews.count == 0) {
    RCTLogError(@"should have at least one view to remove a subview");
    return;
  }
  [_tabViews removeObject:subview];
  _tabsChanged = YES;
}

- (void)layoutSubviews {
  [super layoutSubviews];
  [self reactAddControllerToClosestParent:_tabController];
  _tabController.view.frame = self.bounds;
}

- (void)reactBridgeDidFinishTransaction {
  // we can't hook up the VC hierarchy in 'init' because the subviews aren't
  // hooked up yet, so we do it on demand here whenever a transaction has finished
  [self reactAddControllerToClosestParent:_tabController];

  // 1. RCTTabBar
  // 和: RCTTabBarItem的关系
  if (_tabsChanged) {

    NSMutableArray *viewControllers = [NSMutableArray array];
    for (RCTTabBarItem *tab in [self reactSubviews]) {
      UIViewController *controller = tab.reactViewController;
      if (!controller) {
        controller = [[RCTWrapperViewController alloc] initWithContentView:tab];
      }
      [viewControllers addObject:controller];
    }
    
    // 2. 设置了: UITabBarController
    _tabController.viewControllers = viewControllers;
    _tabsChanged = NO;
  }

  // 3. RCTTabBarItem 如何处理呢?
  [[self reactSubviews] enumerateObjectsUsingBlock:
   ^(RCTTabBarItem *tab, NSUInteger index, __unused BOOL *stop) {

    // tabBarItem RCTTabBarItem#barItem 关联的途径
    UIViewController *controller = _tabController.viewControllers[index];
    controller.tabBarItem = tab.barItem;
     
     // RCTTabBarItem 选中了，则对应的Controller也就选中了
    if (tab.selected) {
      _tabController.selectedViewController = controller;
    }
  }];
}

- (UIColor *)barTintColor {
  return _tabController.tabBar.barTintColor;
}

- (void)setBarTintColor:(UIColor *)barTintColor {
  _tabController.tabBar.barTintColor = barTintColor;
}

- (UIColor *)tintColor {
  return _tabController.tabBar.tintColor;
}

- (void)setTintColor:(UIColor *)tintColor {
  _tabController.tabBar.tintColor = tintColor;
}

- (BOOL)translucent {
  return _tabController.tabBar.isTranslucent;
}

- (void)setTranslucent:(BOOL)translucent {
  _tabController.tabBar.translucent = translucent;
}

#pragma mark - UITabBarControllerDelegate

- (BOOL)tabBarController:(UITabBarController *)tabBarController shouldSelectViewController:(UIViewController *)viewController {
  NSUInteger index = [tabBarController.viewControllers indexOfObject:viewController];
  
  // 快要选择新的Tab时，回调: onPress
  RCTTabBarItem *tab = [self reactSubviews][index];
  if (tab.onPress) tab.onPress(nil);
  return NO;
}

@end
