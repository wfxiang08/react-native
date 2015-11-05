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
  Image,
  StyleSheet,
  TabBarIOS,
  Text,
  View,
} = React;


var TabBarExample = React.createClass({
  statics: {
    title: '春雨医生',
    description: 'Tab-based navigation.',
  },

  displayName: 'TabBarExample',

  getInitialState: function() {
    return {
      selectedTab: 'redTab',
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
      </View>
    );
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
});

module.exports = TabBarExample;
