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
 * @providesModule createExamplePage
 * @flow
 */
'use strict';

var React = require('react-native');
var {
  Platform,
} = React;
var ReactNative = require('ReactNative');
var UIExplorerBlock = require('./UIExplorerBlock');
var UIExplorerPage = require('./UIExplorerPage');

var invariant = require('invariant');

import type { Example, ExampleModule } from 'ExampleTypes';

var createExamplePage = function(title: ?string, exampleModule: ExampleModule)
  : ReactClass<any, any, any> {

  // exampleModule： 必须包含examples
  invariant(!!exampleModule.examples, 'The module must have examples');

  // 将examples这个数组变成一个renderable的界面
  // 定义一个renderable接口
  var ExamplePage = React.createClass({
    statics: {
      title: exampleModule.title,
      description: exampleModule.description,
    },

    getBlock: function(example: Example, i) {

      // 如果限定了platform, 则依据当前的platform进行过滤
      if (example.platform) {
        if (Platform.OS !== example.platform) {
          return;
        }
        example.title += ' (' + example.platform + ' only)';
      }

      // Hack warning: This is a hack because the www UI explorer requires
      // renderComponent to be called.
      var originalRender = React.render;
      var originalRenderComponent = React.renderComponent;
      var originalIOSRender = ReactNative.render;
      var originalIOSRenderComponent = ReactNative.renderComponent;
      var renderedComponent;

      // TODO remove typecasts when Flow bug #6560135 is fixed
      // and workaround is removed from react-native.js
      (React: Object).render =
      (React: Object).renderComponent =
      (ReactNative: Object).render =
      (ReactNative: Object).renderComponent =
        function(element, container) {
          renderedComponent = element;
        };

      // 得到: result
      var result = example.render(null);

      // 如果有view, 则需要设置: navigator属性
      if (result) {
        renderedComponent = React.cloneElement(result, {
          navigator: this.props.navigator,
        });
      }
      (React: Object).render = originalRender;
      (React: Object).renderComponent = originalRenderComponent;
      (ReactNative: Object).render = originalIOSRender;
      (ReactNative: Object).renderComponent = originalIOSRenderComponent;

      // 标题&描述
      return (
        <UIExplorerBlock
          key={i}
          title={example.title}
          description={example.description}>
          {renderedComponent}
        </UIExplorerBlock>
      );
    },

    render: function() {
      // 遍历所有的Blocks，生成UIExplorerBlock对象
      return (
        <UIExplorerPage title={"标题"}>
          {exampleModule.examples.map(this.getBlock)}
        </UIExplorerPage>
      );
    }
  });

  return ExamplePage;
};

module.exports = createExamplePage;
