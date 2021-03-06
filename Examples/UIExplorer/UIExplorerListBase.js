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
  ListView,
  PixelRatio,
  StyleSheet,
  Text,
  TextInput,
  TouchableHighlight,
  View,
} = React;

var createExamplePage = require('./createExamplePage');

// 这是什么意思呢?
var ds = new ListView.DataSource({
  rowHasChanged: (r1, r2) => r1 !== r2,
  sectionHeaderHasChanged: (h1, h2) => h1 !== h2,
});

// 变量名后面有Class名字，是通过Facebook flow来实现的
class UIExplorerListBase extends React.Component {
  constructor(props: any) {
    super(props);

    this.state = {
      // Section的Key, Values
      dataSource: ds.cloneWithRowsAndSections({
        components: [],
        apis: [],
      }),
      searchText: this.props.searchText,
    };
  }

  componentDidMount(): void {
    // 在DOM添加完毕之后，获取有效的数据
    this.search(this.state.searchText);
  }

  render() {
    // 在ListView之前添加额外的东西
    var topView = this.props.renderAdditionalView &&
      this.props.renderAdditionalView(this.renderRow.bind(this), this.renderTextInput.bind(this));

    //
    // 通过一般的 ListView来展示界面
    //
    return (
      <View style={styles.listContainer}>
        {topView}
        <ListView
          style={styles.list}
          dataSource={this.state.dataSource}
          renderRow={this.renderRow.bind(this)}
          renderSectionHeader={this._renderSectionHeader}
          keyboardShouldPersistTaps={true}
          automaticallyAdjustContentInsets={false}
          keyboardDismissMode="on-drag"
        />
      </View>
    );
  }

  renderTextInput(searchTextInputStyle: any) {
    return (
      <View style={styles.searchRow}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="always"
          onChangeText={this.search.bind(this)}
          placeholder="Search..."
          style={[styles.searchTextInput, searchTextInputStyle]}
          testID="explorer_search"
          value={this.state.searchText}
        />
      </View>
    );
  }

  _renderSectionHeader(data: any, section: string) {
    // 将section大写输出
    // data 是什么东西呢?
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}>
          {section.toUpperCase()}
        </Text>
      </View>
    );
  }

  renderRow(example: any, i: number) {
    return (
      <View key={i}>
        <TouchableHighlight onPress={() => this.onPressRow(example)}>
          <View style={styles.row}>
            <Text style={styles.rowTitleText}>
              {example.title}
            </Text>
            <Text style={styles.rowDetailText}>
              {example.description}
            </Text>
          </View>
        </TouchableHighlight>
        <View style={styles.separator} />
      </View>
    );
  }

  search(text: mixed): void {

    this.props.search && this.props.search(text);

    // 如果进行筛选呢?
    var regex = new RegExp(text, 'i');
    var filter = (component) => regex.test(component.title);

    // 筛选之后的Filter
    this.setState({
      dataSource: ds.cloneWithRowsAndSections({
        components: this.props.components.filter(filter),
        apis: this.props.apis.filter(filter),
      }),
      searchText: text,
    });
  }

  onPressRow(example: any): void {
    // 如果有callback, 则Callback
    this.props.onPressRow && this.props.onPressRow(example);
  }

  static makeRenderable(example: any): ReactClass<any, any, any> {
    // 如果没有examples属性，那说明: example本身就是一个View, 可以直接Render
    //      如果有呢，则需要进行wrap
    return example.examples ? createExamplePage("标题", example) : example;
  }
}

var styles = StyleSheet.create({
  listContainer: {
    flex: 1,
  },
  list: {
    backgroundColor: '#eeeeee',
  },
  sectionHeader: {
    padding: 5,
    //height: 50,
  },
  group: {
    backgroundColor: 'white',
  },
  sectionHeaderTitle: {
    fontWeight: '500', // 'bold'
    fontSize: 11,
  },
  row: {
    backgroundColor: 'white',
    justifyContent: 'center', // https://facebook.github.io/react-native/docs/flexbox.html#proptypes
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  // 高度居然可以为非整数,  / PixelRatio.get()
  separator: {
    height: 1/2,
    backgroundColor: '#bb0000',
    marginLeft: 5,
  },

  rowTitleText: {
    fontSize: 17,
    fontWeight: '500',
  },
  rowDetailText: {
    fontSize: 15,
    color: '#669966',
    lineHeight: 20,
  },

  searchRow: {
    backgroundColor: '#eeeeee',
    paddingTop: 75,
    paddingLeft: 10,
    paddingRight: 10,
    paddingBottom: 10,
  },
  searchTextInput: {
    backgroundColor: 'white',
    borderColor: '#cccccc',
    borderRadius: 3,
    borderWidth: 1,
    paddingLeft: 8,
  },
});

module.exports = UIExplorerListBase;
