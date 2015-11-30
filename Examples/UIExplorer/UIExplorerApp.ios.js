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
 * @providesModule UIExplorerApp
 * @flow
 */
'use strict';

var data={
  "message": "Hello"
}

var React = require('react-native');

var UIExplorerList = require('./UIExplorerList.ios');

var TabBarExample = require("./TabBarIOSExample")

// 从: React中导入 NavigatorIOS
var {
  AppRegistry,
  NavigatorIOS,
  StyleSheet,
} = React;

var UIExplorerApp = React.createClass({

  getInitialState: function() {
    return {
      openExternalExample: (null: ?React.Component),
    };
  },

  render: function() {
    // 这是什么逻辑呢?
    // 如果: onExternalExampleRequested 被调用，那么首页就会被刷新, 换成新的外部页面
    //      在返回的时候，首页重建，页面的scroll信息全部丢失!!!!
    if (this.state.openExternalExample) {
      console.log("openExternalExample");
      var Example = this.state.openExternalExample;
      return (
        <Example
          onExampleExit={() => {
            this.setState({ openExternalExample: null, });
          }}
        />
      );
    }

    // 首先: UIExplorerList 在 NavigatorIOS内部打开，肯定会有 props.navigator设置， 而且: 还有: onExternalExampleRequested 设置
    return (
      <NavigatorIOS
        style={styles.container}
        initialRoute={{
          title: '春雨医生改进版',
          component: UIExplorerList,
          //component: TabBarExample,
          passProps: {
            onExternalExampleRequested: (example) => {
              this.setState({ openExternalExample: example, });
            },
          }
        }}
        itemWrapperStyle={styles.itemWrapper}
        tintColor="#008888"
      />
    );
  }
});

var styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemWrapper: {
    backgroundColor: '#eaeaea',
  },
});

AppRegistry.registerComponent('UIExplorerApp', () => UIExplorerApp);
//AppRegistry.registerComponent('UIExplorerApp', () => TabBarExample);

module.exports = UIExplorerApp;
