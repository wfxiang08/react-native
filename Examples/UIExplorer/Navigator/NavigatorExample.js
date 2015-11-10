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
*/
'use strict';

var React = require('react-native');
var {
  Navigator,
  PixelRatio,
  ScrollView,
  StyleSheet,
  Text,
  TouchableHighlight,
  TouchableOpacity,
} = React;
var BreadcrumbNavSample = require('./BreadcrumbNavSample');
var NavigationBarSample = require('./NavigationBarSample');
var JumpingNavSample = require('./JumpingNavSample');

class NavButton extends React.Component {
  render() {
    // onPress: 只是传递一个Handler, 而不是一个func call
    return (
      <TouchableHighlight
        style={styles.button}
        underlayColor="#B5B5B5"
        onPress={this.props.onPress}>
        <Text style={styles.buttonText}>{this.props.text}</Text>
      </TouchableHighlight>
    );
  }
}

class NavMenu extends React.Component {
  render() {
    return (
      <ScrollView style={styles.scene}>
        <Text style={styles.messageText}>NavigatorExample: {this.props.message}</Text>

        <NavButton
          onPress={() => {
            this.props.navigator.push({
              message: 'Swipe right to dismiss',
              sceneConfig: Navigator.SceneConfigs.FloatFromRight,
            });
          }}
          text="从右边往左边弹出"
        />
        <NavButton
          onPress={() => {
            this.props.navigator.push({
              message: 'Swipe down to dismiss',
              sceneConfig: Navigator.SceneConfigs.FloatFromBottom,
            });
          }}
          text="Float in from bottom"
        />
        <NavButton
          onPress={() => {
            this.props.navigator.pop();
          }}
          text="Pop"
        />
        <NavButton
          onPress={() => {
            this.props.navigator.popToTop();
          }}
          text="Pop to top"
        />
        <NavButton
          onPress={() => {
            // 这个Example和下面一个有什么差别呢?
            this.props.navigator.push({ id: 'navbar' });
          }}
          text="Navbar Example"
        />
        <NavButton
          onPress={() => {
            this.props.navigator.push({ id: 'jumping' });
          }}
          text="Jumping Example"
        />
        <NavButton
          onPress={() => {
            this.props.navigator.push({ id: 'breadcrumbs' });
          }}
          text="Breadcrumbs Example"
        />
        <NavButton
          onPress={() => {
            this.props.onExampleExit();
          }}
          text="Exit <Navigator> Example"
        />
      </ScrollView>
    );
  }
}

var NavigationBarRouteMapper = {
  onExampleExit: null,
  LeftButton: function(route, navigator, index, navState) {
    console.log("index: " + index);

    if (index === 0) {
      return (<TouchableOpacity
        onPress={() => {this.onExampleExit && this.onExampleExit()}}
        style={styles.navBarLeftButton}>
        <Text style={[styles.navBarText, styles.navBarButtonText]}>
          &lt;
        </Text>
      </TouchableOpacity>)
    }

    var previousRoute = navState.routeStack[index - 1];
    return (
      <TouchableOpacity
        onPress={() => navigator.pop()}
        style={styles.navBarLeftButton}>
        <Text style={[styles.navBarText, styles.navBarButtonText]}>
          {previousRoute.title}&lt;
        </Text>
      </TouchableOpacity>
    );
  },

  RightButton: function(route, navigator, index, navState) {
    return (
      <TouchableOpacity
        onPress={() => alert("知道了")}
        style={styles.navBarRightButton}>
        <Text style={[styles.navBarText, styles.navBarButtonText]}>
          Next
        </Text>
      </TouchableOpacity>
    );
  },

  Title: function(route, navigator, index, navState) {
    return (
      <Text style={[styles.navBarText, styles.navBarTitleText]}>
        {route.title} [{index}]
      </Text>
    );
  },

};

// 如何将部分参数传递给: NavigationBarRouteMapper 呢?
function NavigationBarRouteMapperFactor(onExampleExit) {
  NavigationBarRouteMapper.onExampleExit = onExampleExit;
  return NavigationBarRouteMapper;
}

var TabBarExample = React.createClass({

  statics: {
    title: '<Navigator>',
    description: 'JS-implemented navigation',
  },

  renderScene: function(route, nav) {
    switch (route.id) {
      // 其他情况下，暂时Sample
      case 'navbar':
        return <NavigationBarSample navigator={nav} />;
      case 'breadcrumbs':
        return <BreadcrumbNavSample navigator={nav} />;
      case 'jumping':
        return <JumpingNavSample navigator={nav} />;

      default:
        // NavMenu倒是非常普通，没有什么特色，就是一个ScrollView内部
        return (
          <NavMenu
            message={route.message}
            navigator={nav}
            onExampleExit={this.props.onExampleExit}
          />
        );
    }
  },

  render: function() {
    // 新的首页有新的Navigator
    // Navigator完全通过JS来实现?
    return (
      <Navigator
        ref={this._setNavigatorRef}
        style={styles.container}
        initialRoute={{ message: 'First Scene', }}

        renderScene={this.renderScene}

        configureScene={(route) => {
          // Navigator当前的Configure
          if (route.sceneConfig) {
            return route.sceneConfig;
          }
          return Navigator.SceneConfigs.FloatFromBottom;
        }}

        navigationBar={
          <Navigator.NavigationBar
            routeMapper={NavigationBarRouteMapperFactor(this.props.onExampleExit)}
            style={styles.navBar}
          />
        }
      />
    );
  },


  componentWillUnmount: function() {
    this._listeners && this._listeners.forEach(listener => listener.remove());
  },

  _setNavigatorRef: function(navigator) {
    //
    if (navigator !== this._navigator) {
      this._navigator = navigator;

      if (navigator) {
        var callback = (event) => {
          console.log(
            `TabBarExample: event ${event.type}`,
            {
              route: JSON.stringify(event.data.route),
              target: event.target,
              type: event.type,
            }
          );
        };
        // Observe focus change events from the owner.
        this._listeners = [
          navigator.navigationContext.addListener('willfocus', callback),
          navigator.navigationContext.addListener('didfocus', callback),
        ];
      }
    }
  },
});

var styles = StyleSheet.create({
  messageText: {
    fontSize: 17,
    fontWeight: '500',
    padding: 15,
    //marginTop: 50,
    //marginLeft: 15,
    borderColor:'red',
    borderWidth: 0.5,
  },
  container: {
    flex: 1,
  },
  navBar: {
    backgroundColor: 'white',
  },
  navBarText: {
    fontSize: 16,
    marginVertical: 10,
  },
  navBarLeftButton: {
    paddingLeft: 10,
  },
  navBarRightButton: {
    paddingRight: 10,
  },

  button: {
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1 / PixelRatio.get(),
    borderBottomColor: '#CDCDCD',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '500',
  },
  scene: {
    flex: 1,
    paddingTop: 64,
    backgroundColor: '#EAEAEA',
  }
});

// external 这个是什么意思?
// 会替换原来的首页
TabBarExample.external = true;

module.exports = TabBarExample;
