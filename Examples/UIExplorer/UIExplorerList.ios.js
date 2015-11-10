/**
 * The examples provided by Facebook are for non-commercial testing and
 * evaluation purposes only.
 *
 * Facebook reserves all rights not expressly granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON INFRINGEMENT. IN NO EVENT SHALL
 * FACEBOOK BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
 * AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * @flow
 */
'use strict';

var React = require('react-native');
var {
  AppRegistry,
  Settings,
  SnapshotViewIOS,
  StyleSheet,
} = React;

import type { NavigationContext } from 'NavigationContext';

var UIExplorerListBase = require('./UIExplorerListBase');

// 1. 导入相关的Components
var COMPONENTS = [
  require('./ActivityIndicatorIOSExample'),
  require('./DatePickerIOSExample'),
  require('./ImageExample'),
  require('./LayoutEventsExample'),
  require('./ListViewExample'),
  require('./ListViewGridLayoutExample'),
  require('./ListViewPagingExample'),
  require('./MapViewExample'),
  require('./ModalExample'),

  require('./Navigator/NavigatorExample'), // 如何使用JS实现一个Navigator呢?
  require('./NavigatorIOSColorsExample'), // 用于展示如何设置 Navigation的样式
  require('./NavigatorIOSExample'),

  require('./PickerIOSExample'),
  require('./ProgressViewIOSExample'),
  require('./ScrollViewExample'),
  require('./SegmentedControlIOSExample'),
  require('./SliderIOSExample'),
  require('./SwitchIOSExample'),
  require('./TabBarIOSExample'),
  require('./TextExample.ios'),
  require('./TextInputExample.ios'),
  require('./TouchableExample'),
  require('./TransparentHitTestExample'),
  require('./ViewExample'),
  require('./WebViewExample'),
];


// 2. APIs和Components的区别?
var APIS = [
  require('./AccessibilityIOSExample'),
  require('./ActionSheetIOSExample'),
  require('./AdSupportIOSExample'),
  require('./AlertIOSExample'),
  require('./AnimatedExample'),
  require('./AnimatedGratuitousApp/AnExApp'),
  require('./AppStateIOSExample'),
  require('./AsyncStorageExample'),
  require('./BorderExample'),
  require('./CameraRollExample.ios'),
  require('./GeolocationExample'),
  require('./LayoutExample'),
  require('./NetInfoExample'),
  require('./PanResponderExample'),
  require('./PointerEventsExample'),
  require('./PushNotificationIOSExample'),
  require('./StatusBarIOSExample'),
  require('./TimerExample'),
  require('./VibrationIOSExample'),
  require('./XHRExample.ios'),
  require('./ImageEditingExample'),
];

// Register suitable examples for snapshot tests
COMPONENTS.concat(APIS).forEach((Example) => {
  // 注册Component
  // 正常的Component必须有自己的displayName
  if (Example.displayName) {

    var Snapshotter = React.createClass({
      render: function() {
        var Renderable = UIExplorerListBase.makeRenderable(Example);
        return (
          <SnapshotViewIOS>
            <Renderable />
          </SnapshotViewIOS>
        );
      },
    });

    AppRegistry.registerComponent(Example.displayName, () => Snapshotter);
  }
});

// type的意义
type Props = {
  // 定义了props的接口:
  // navigator的push的参数: route
  navigator: {
    navigationContext: NavigationContext,
    push: (route: {title: string, component: ReactClass<any,any,any>}) => void,
  },
  onExternalExampleRequested: Function,
};

//
// Settings是什么概念呢?
//
class UIExplorerList extends React.Component {
  props: Props;

  render() {
    return (
      <UIExplorerListBase
        components={COMPONENTS}
        apis={APIS}
        searchText={Settings.get('searchText')}
        renderAdditionalView={this.renderAdditionalView.bind(this)}
        search={this.search.bind(this)}
        onPressRow={this.onPressRow.bind(this)}
      />
    );
  }

  renderAdditionalView(renderRow: Function, renderTextInput: Function): React.Component {
    return renderTextInput(styles.searchTextInput);
  }

  search(text: mixed) {
    Settings.set({searchText: text});
  }

  _openExample(example: any) {
    // 这个如何理解?
    // 暂不考虑
    if (example.external) {
      this.props.onExternalExampleRequested(example);
      return;
    }
    //
    // 如何打开example呢?
    // 例如: ActivityIndicatorIOSExample 到底是什么东西呢?
    // Component是什么东西，什么时候才能直接作为Navigator的参数呢?
    //
    var Component = UIExplorerListBase.makeRenderable(example);

    // 如何打开一个新的界面
    // 直接通过pops.navigator.push来完成
    this.props.navigator.push({
      title: Component.title,
      component: Component,
    });
  }
  // 用法:
  // this.onPressRow.bind(this)
  //
  onPressRow(example: any) {
    this._openExample(example);
  }
}

var styles = StyleSheet.create({
  searchTextInput: {
    height: 30,
  },
});


// exports的作用:
//  var UIExplorerList = require('./UIExplorerList.ios');
module.exports = UIExplorerList;
