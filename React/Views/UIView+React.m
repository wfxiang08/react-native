/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "UIView+React.h"

#import <objc/runtime.h>

#import "RCTAssert.h"
#import "RCTLog.h"

@implementation UIView (React)

// 对应的React组件都应该有Tag
- (NSNumber *)reactTag {
  return objc_getAssociatedObject(self, _cmd);
}

- (void)setReactTag:(NSNumber *)reactTag {
  objc_setAssociatedObject(self, @selector(reactTag), reactTag, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}

- (BOOL)isReactRootView {
  return RCTIsReactRootView(self.reactTag);
}

- (NSNumber *)reactTagAtPoint:(CGPoint)point {
  UIView *view = [self hitTest:point withEvent:nil];
  while (view && !view.reactTag) {
    view = view.superview;
  }
  return view.reactTag;
}

- (void)insertReactSubview:(UIView *)subview atIndex:(NSInteger)atIndex {
  [self insertSubview:subview atIndex:atIndex];
}

- (void)removeReactSubview:(UIView *)subview {
  RCTAssert(subview.superview == self, @"%@ is a not a subview of %@", subview, self);
  [subview removeFromSuperview];
}

- (NSArray *)reactSubviews {
  return self.subviews;
}

- (UIView *)reactSuperview {
  return self.superview;
}

- (void)reactSetFrame:(CGRect)frame {
  // These frames are in terms of anchorPoint = topLeft, but internally the
  // views are anchorPoint = center for easier scale and rotation animations.
  // Convert the frame so it works with anchorPoint = center.
  CGPoint position = {CGRectGetMidX(frame), CGRectGetMidY(frame)};
  CGRect bounds = {CGPointZero, frame.size};

  // Avoid crashes due to nan coords
  if (isnan(position.x) || isnan(position.y) ||
      isnan(bounds.origin.x) || isnan(bounds.origin.y) ||
      isnan(bounds.size.width) || isnan(bounds.size.height)) {
    RCTLogError(@"Invalid layout for (%@)%@. position: %@. bounds: %@",
                self.reactTag, self, NSStringFromCGPoint(position), NSStringFromCGRect(bounds));
    return;
  }

  self.center = position;
  self.bounds = bounds;
}

- (void)reactSetInheritedBackgroundColor:(UIColor *)inheritedBackgroundColor {
  self.backgroundColor = inheritedBackgroundColor;
}

//
// 所有的UIView都可能返回对应的UIViewController
// UIView --> UIView --> UIViewController --> ... UIView ---> UIViewController ....
//
- (UIViewController *)reactViewController {
  id responder = [self nextResponder];
  while (responder) {
    if ([responder isKindOfClass:[UIViewController class]]) {
      return responder;
    }
    
    // View --> UIViewController
    // View --> superview
    // UIViewController --> superview of UIViewController#view
    //
    responder = [responder nextResponder];
  }
  return nil;
}

- (void)reactAddControllerToClosestParent:(UIViewController *)controller {
  // 如果controller没有归属，则可以操作
  if (!controller.parentViewController) {
    // 找到当前的SuperView
    UIView *parentView = (UIView *)self.reactSuperview;
    while (parentView) {
      // 似乎一般的UIView就到此为止
      if (parentView.reactViewController) {
        [parentView.reactViewController addChildViewController:controller];
        [controller didMoveToParentViewController:parentView.reactViewController];
        break;
      }
      
      //
      parentView = (UIView *)parentView.reactSuperview;
    }
    return;
  }
}

/**
 * Responder overrides - to be deprecated.
 */
- (void)reactWillMakeFirstResponder {};
- (void)reactDidMakeFirstResponder {};
- (BOOL)reactRespondsToTouch:(__unused UITouch *)touch {
  return YES;
}

@end
