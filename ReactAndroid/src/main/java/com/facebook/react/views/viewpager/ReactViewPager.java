/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

package com.facebook.react.views.viewpager;

import java.util.ArrayList;
import java.util.List;

import android.os.SystemClock;
import android.support.v4.view.PagerAdapter;
import android.support.v4.view.ViewPager;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;

import com.facebook.react.bridge.ReactContext;
import com.facebook.react.uimanager.UIManagerModule;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.uimanager.events.NativeGestureUtil;

/**
 * Wrapper view for {@link ViewPager}. It's forwarding calls to {@link ViewGroup#addView} to add
 * views to custom {@link PagerAdapter} instance which is used by {@link NativeViewHierarchyManager}
 * to add children nodes according to react views hierarchy.
 */
class ReactViewPager extends ViewPager {

  private class Adapter extends PagerAdapter {

    private List<View> mViews = new ArrayList<>();

    void addView(View child, int index) {
      mViews.add(index, child);
      notifyDataSetChanged();
      // This will prevent view pager from detaching views for pages that are not currently selected
      // We need to do that since {@link ViewPager} relies on layout passes to position those views
      // in a right way (also thanks to {@link ReactViewPagerManager#needsCustomLayoutForChildren}
      // returning {@code true}). Currently we only call {@link View#measure} and
      // {@link View#layout} after CSSLayout step.

      // TODO(7323049): Remove this workaround once we figure out a way to re-layout some views on
      // request
      setOffscreenPageLimit(mViews.size());
    }

    @Override
    public int getCount() {
      return mViews.size();
    }

    // ViewPager就像一个TableView/Listview
    @Override
    public Object instantiateItem(ViewGroup container, int position) {
      View view = mViews.get(position);
      // 默认的View是FillContent/FillContent
      container.addView(view, 0, generateDefaultLayoutParams());
      return view;
    }

    @Override
    public void destroyItem(ViewGroup container, int position, Object object) {
      // ??? 什么时候DestoryItem呢?
      View view = mViews.get(position);
      container.removeView(view);
    }

    @Override
    public boolean isViewFromObject(View view, Object object) {
      return view == object;
    }
  }

  private class PageChangeListener implements OnPageChangeListener {

    @Override
    public void onPageScrolled(int position, float positionOffset, int positionOffsetPixels) {
      // PageScrolled 滑动到什么地方了?
      // Scroll导致的变化，肯定不是JS做的
      mEventDispatcher.dispatchEvent(
          new PageScrollEvent(getId(), SystemClock.uptimeMillis(), position, positionOffset));
    }

    @Override
    public void onPageSelected(int position) {
      // 哪个元素被选中了
      // PageSelected 存在两种情况:
      // Java代码直接操作，通过Js设置selectedPage, 如果是后者，则不需要再次通知JS(否则形成死循环)
      if (!mIsCurrentItemFromJs) {
        mEventDispatcher.dispatchEvent(
            new PageSelectedEvent(getId(), SystemClock.uptimeMillis(), position));
      }
    }

    @Override
    public void onPageScrollStateChanged(int state) {
      // don't send events
    }
  }

  private final EventDispatcher mEventDispatcher;
  private boolean mIsCurrentItemFromJs;

  public ReactViewPager(ReactContext reactContext) {
    super(reactContext);
    // 获取EventDispatcher
    // 自定义的ReactContext的设计原则?
    //
    mEventDispatcher = reactContext.getNativeModule(UIManagerModule.class).getEventDispatcher();
    mIsCurrentItemFromJs = false;

    // 使用自定义的控件
    setOnPageChangeListener(new PageChangeListener());
    setAdapter(new Adapter());
  }

  // ViewPager 如何扩展呢?
  // Adapter
  // onInterceptTouchEvent 等
  //
  @Override
  public Adapter getAdapter() {
    // 类型转换
    // 被Override的方法的返回值类型可以稍微不一样
    return (Adapter) super.getAdapter();
  }

  @Override
  public boolean onInterceptTouchEvent(MotionEvent ev) {
    if (super.onInterceptTouchEvent(ev)) {
      // 截获Event之后，再通知JS端
      NativeGestureUtil.notifyNativeGestureStarted(this, ev);
      return true;
    }
    return false;
  }

  void addViewToAdapter(View child, int index) {
    getAdapter().addView(child, index);
  }

  void setCurrentItemFromJs(int item) {
    mIsCurrentItemFromJs = true;
    setCurrentItem(item);
    mIsCurrentItemFromJs = false;
  }
}
