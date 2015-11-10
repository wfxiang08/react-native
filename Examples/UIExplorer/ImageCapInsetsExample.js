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
 * @providesModule ImageCapInsetsExample
 * @flow
 */
'use strict';

var React = require('react-native');
var {
  Image,
  StyleSheet,
  Text,
  View,
} = React;

var ImageCapInsetsExample = React.createClass({
  render: function() {
    // 布局:
    // 首先是一个View
    // 然后两个subViews
    //
    // capInsets: 就是九宫格图，图片的边边角角不会边，但是中间部分会被拉升
    return (
      <View>
        <View style={styles.background}>
          <Text>
            capInsets: none(capInset没有设置，图片被拉升，出现边角模糊)
          </Text>
          <Image
            source={require('image!story-background')}
            style={styles.storyBackground}
            capInsets={{left: 0, right: 0, bottom: 0, top: 0}}
          />
        </View>
        <View style={[styles.background, {paddingTop: 10, marginTop: 20}]}>
          <Text>
            capInsets: 15
          </Text>
          <Image
            source={require('image!story-background')}
            style={styles.storyBackground}
            capInsets={{left: 15, right: 15, bottom: 15, top: 15}}
          />
        </View>
      </View>
    );
  }
});

var styles = StyleSheet.create({
  background: {
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: "#990000",
  },
  horizontal: {
    flexDirection: 'row',
  },
  storyBackground: {
    width: 320,
    height: 250,
    borderWidth: 1,
    resizeMode: Image.resizeMode.stretch,
  },
  text: {
    fontSize: 13.5,
  }
});

module.exports = ImageCapInsetsExample;
