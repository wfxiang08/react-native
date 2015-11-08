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

var ScrollViewExample = require('./ScrollViewExample');


var React = require('react-native');
var {
  Image,
  PixelRatio,
  TouchableHighlight,
  StyleSheet,
  TabBarIOS,
  Text,
  View,
} = React;



var EmptyPage = React.createClass({

  render: function() {
    return (
      <View style={styles.emptyPage}>
        <Text style={styles.emptyPageText}>
          我们哈哈哈 {this.props.text}
        </Text>
      </View>
    );
  },

});


var TabBarExample = React.createClass({
  statics: {
    title: 'TabBarExample',
    description: 'Tab-based navigation.',
  },

  displayName: 'TabBarExample',

  getInitialState: function() {
    return {
      selectedTab: 'airTab',
      notifCount: 0,
      presses: 0,
    };
  },

  _renderContent: function(color: string, pageText: string, num?: number) {
    // num? 参数可有，可无，如果没有，则 {num}返回""
    return (
      <View style={[styles.tabContent, {backgroundColor: color}]}>
        <Text style={styles.tabText}>{pageText}</Text>
        <Text style={styles.tabText}>{num} re-renders of the {pageText}</Text>
        <Image source={require('image!btn_assistant_selected')} style={styles.imageDemo} />
        <Image source={require('image!btn_assistant_selected')} style={styles.imageDemo2} />
        <Image source={require('image!btn_assistant')} style={styles.imageDemo} />
        <Image source={require('image!btn_air_hospital_selected')} style={styles.imageDemo2} />
        <TouchableHighlight style={styles.wrapper} onPress={() => {
          // alert("Hello");
          //this.props.navigator.push({
          //    message: 'Came from jumping example',
          //  });

          this.props.navigator.push({
            message: "测试",
            component: EmptyPage,
            rightButtonTitle: '取消',
            onRightButtonPress: () => this.props.navigator.pop(),
            passProps: {
              text: 'This page has a right button in the nav bar',
            }
          });
          }
        }>
            <Text style={styles.tabText}>{pageText}</Text>
          </TouchableHighlight>

      </View>
    );
  },

  open_demo: function() {
    // onLongPress={this.open_demo()}
    alert("Hello");
    //this.props.navigator.push({
    //    title: "测试",
    //    component: ScrollViewExample,
    //});
  },
  // 4dd363 FF0000
  // badge={this.state.notifCount > 0 ? this.state.notifCount : undefined}
  // 模拟春雨的首页
  render: function() {
    return (
      <TabBarIOS
        selectedTab={this.state.selectedTab}
        translucent={false}
        tintColor="#4dd363"
        barTintColor="#f9f9f9">
        <TabBarIOS.Item
          title="空中医院"
          icon={require("image!btn_air_hospital_normal")}
          selectedIcon={require("image!btn_air_hospital_selected")}
          selected={this.state.selectedTab === 'airTab'}
          onPress={() => {
            // 动作之后，更新状态
            this.setState({
              selectedTab: 'airTab',
            });
          }}>
          {this._renderContent('#414A8C', '空中医院')}
        </TabBarIOS.Item>

        <TabBarIOS.Item
          title="我的服务"
          icon={require('image!btn_service_normal')}
          selectedIcon={require('image!btn_service_selected')}
          selected={this.state.selectedTab === 'serviceTab'}
          onPress={() => {
            this.setState({
              selectedTab: 'serviceTab',
              notifCount: this.state.notifCount + 1,
            });
          }}>
          {this._renderContent('#783E33', '我的服务', this.state.notifCount)}
        </TabBarIOS.Item>

        <TabBarIOS.Item
          title="健康助手"
          icon={require('image!btn_assistant')}
          selectedIcon={require('image!btn_assistant_selected')}
          selected={this.state.selectedTab === 'assitantTab'}
          onPress={() => {
            this.setState({
              selectedTab: 'assitantTab',
              presses: this.state.presses + 1
            });
          }}>
          {this._renderContent('#21551C', '健康助手', this.state.presses)}
        </TabBarIOS.Item>

        <TabBarIOS.Item
          title="新闻"
          icon={require('image!btn_news_normal')}
          selectedIcon={require('image!btn_news_selected')}
          selected={this.state.selectedTab === 'newsTab'}
          onPress={() => {
            this.setState({
              selectedTab: 'newsTab',
              presses: this.state.presses + 1
            });
          }}>
          {this._renderContent('#FF551C', '新闻', this.state.presses)}
        </TabBarIOS.Item>

        <TabBarIOS.Item
          title="个人中心"
          icon={require('image!btn_mine_normal')}
          selectedIcon={require('image!btn_mine_selected')}
          selected={this.state.selectedTab === 'userTab'}
          onPress={() => {
            this.setState({
              selectedTab: 'userTab',
              presses: this.state.presses + 1
            });
          }}>
          {this._renderContent('#FF551C', '个人中心', this.state.presses)}
        </TabBarIOS.Item>
      </TabBarIOS>
    );
  },

});

var styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    alignItems: 'center',
  },
  tabText: {
    color: 'white',
    margin: 50,
  },
  imageDemo: {
    height: 86,
    width: 98,
  },
  imageDemo2: {
    height: 43,
    width: 49,
  },
  emptyPage: {
    flex: 1,
    paddingTop: 64,
  },
  emptyPageText: {
    margin: 10,
  },
   logBox: {
    padding: 20,
    margin: 10,
    borderWidth: 1 / PixelRatio.get(),
    borderColor: '#f0f0f0',
    backgroundColor: '#f9f9f9',
  },
  eventLogBox: {
    padding: 10,
    margin: 10,
    height: 120,
    borderWidth: 1 / PixelRatio.get(),
    borderColor: '#f0f0f0',
    backgroundColor: '#f9f9f9',
  },
  textBlock: {
    fontWeight: '500',
    color: 'blue',
  },
    wrapper: {
    borderRadius: 8,
  },
  wrapperCustom: {
    borderRadius: 8,
    padding: 6,
  },
});


module.exports = TabBarExample;
