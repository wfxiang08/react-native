/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTTabBarItem.h"

#import "RCTConvert.h"
#import "RCTLog.h"
#import "UIView+React.h"

// Hacked by Wangfei(图片的属性需要进一步控制，例如: 如果缩放，不合理的缩放会产生很多问题)
@interface UITabBarItemEx:UITabBarItem
@end
@implementation UITabBarItemEx
-(void) setSelectedImage:(UIImage *)selectedImage {
    selectedImage = [selectedImage imageWithRenderingMode: UIImageRenderingModeAlwaysOriginal];
    [super setSelectedImage: selectedImage];
}

-(void) setImage:(UIImage *)image {
    image = [image imageWithRenderingMode: UIImageRenderingModeAlwaysOriginal];
    [super setImage: image];
}

@end

@implementation RCTTabBarItem

@synthesize barItem = _barItem;


// RCTTabBarItem 负责为TabBarViewController的controller提供tabBarItem
- (UITabBarItem *)barItem {
  if (!_barItem) {
    _barItem = [UITabBarItemEx new];
  }
  return _barItem;
}

//
// icon格式:
// 1. @{
//      json格式的数据
// }
// 2. NSString(系统图标)
//
- (void)setIcon:(id)icon {
  // 1. 系统的Icon
  static NSDictionary *systemIcons;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    systemIcons = @{
      @"bookmarks": @(UITabBarSystemItemBookmarks),
      @"contacts": @(UITabBarSystemItemContacts),
      @"downloads": @(UITabBarSystemItemDownloads),
      @"favorites": @(UITabBarSystemItemFavorites),
      @"featured": @(UITabBarSystemItemFeatured),
      @"history": @(UITabBarSystemItemHistory),
      @"more": @(UITabBarSystemItemMore),
      @"most-recent": @(UITabBarSystemItemMostRecent),
      @"most-viewed": @(UITabBarSystemItemMostViewed),
      @"recents": @(UITabBarSystemItemRecents),
      @"search": @(UITabBarSystemItemSearch),
      @"top-rated": @(UITabBarSystemItemTopRated),
    };
  });

  // Update icon
  BOOL wasSystemIcon = (systemIcons[_icon] != nil);
  _icon = [icon copy];

  // Check if string matches any custom images first
  // 如何加载图片呢?
  UIImage *image = [[RCTConvert UIImage:_icon] imageWithRenderingMode: UIImageRenderingModeAlwaysOriginal];
  
  UITabBarItem *oldItem = _barItem;

  if (image) {
    // Recreate barItem if previous item was a system icon. Calling self.barItem
    // creates a new instance if it wasn't set yet.
    if (wasSystemIcon) {
      _barItem = nil;
      self.barItem.image = image;
    } else {
      self.barItem.image = image;
      return;
    }
  } else if ([icon isKindOfClass:[NSString class]] && [icon length] > 0) {
    // Not a custom image, may be a system item?
    NSNumber *systemIcon = systemIcons[icon];
    if (!systemIcon) {
      RCTLogError(@"The tab bar icon '%@' did not match any known image or system icon", icon);
      return;
    }
    _barItem = [[UITabBarItem alloc] initWithTabBarSystemItem:systemIcon.integerValue tag:oldItem.tag];
  } else {
    self.barItem.image = nil;
  }

  // Reapply previous properties
  // 只能修改: image, selectedImage似乎不能修改
  _barItem.title = oldItem.title;
  _barItem.imageInsets = oldItem.imageInsets;
  _barItem.selectedImage = oldItem.selectedImage;
  _barItem.badgeValue = oldItem.badgeValue;
}

- (UIViewController *)reactViewController {
  return self.superview.reactViewController;
}

@end
