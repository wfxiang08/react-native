/**
 * Copyright (c) 2015, Facebook, Inc.  All rights reserved.
 *
 * Facebook, Inc. ("Facebook") owns all right, title and interest, including
 * all intellectual property and other proprietary rights, in and to the React
 * Native CustomComponents software (the "Software").  Subject to your
 * compliance with these terms, you are hereby granted a non-exclusive,
 * worldwide, royalty-free copyright license to (1) use and copy the Software;
 * and (2) reproduce and distribute the Software as part of your own software
 * ("Your Software").  Facebook reserves all rights not expressly granted to
 * you in this license agreement.
 *
 * THE SOFTWARE AND DOCUMENTATION, IF ANY, ARE PROVIDED "AS IS" AND ANY EXPRESS
 * OR IMPLIED WARRANTIES (INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE) ARE DISCLAIMED.
 * IN NO EVENT SHALL FACEBOOK OR ITS AFFILIATES, OFFICERS, DIRECTORS OR
 * EMPLOYEES BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THE SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @providesModule ListViewDataSource
 * @typechecks
 * @flow
 */
'use strict';

var invariant = require('invariant');
var isEmpty = require('isEmpty');
var warning = require('warning');

//
// 从一个dataBlob中如何获取数据呢?
// 默认的实现是一个二维数组
//
function defaultGetRowData(
  dataBlob: any,
  sectionID: number | string,
  rowID: number | string
): any {
  return dataBlob[sectionID][rowID];
}

//
// 如何获取SectionHeaderData呢?
//
function defaultGetSectionHeaderData(
  dataBlob: any,
  sectionID: number | string
): any {
  return dataBlob[sectionID];
}

//
// 什么是Diff呢?
// 两个数据 --> bool
//
type differType = (data1: any, data2: any) => bool;

//
// ParamType的意义?
//
type ParamType = {
  rowHasChanged: differType;
  getRowData: ?typeof defaultGetRowData;
  sectionHeaderHasChanged: ?differType;
  getSectionHeaderData: ?typeof defaultGetSectionHeaderData;
}

/**
 * Provides efficient data processing and access to the
 * `ListView` component.  A `ListViewDataSource` is created with functions for
 * extracting data from the input blob, and comparing elements (with default
 * implementations for convenience).  The input blob can be as simple as an
 * array of strings, or an object with rows nested inside section objects.
 *
 * To update the data in the datasource, use `cloneWithRows` (or
 * `cloneWithRowsAndSections` if you care about sections).  The data in the
 * data source is immutable, so you can't modify it directly.  The clone methods
 * suck in the new data and compute a diff for each row so ListView knows
 * whether to re-render it or not.
 *
 * In this example, a component receives data in chunks, handled by
 * `_onDataArrived`, which concats the new data onto the old data and updates the
 * data source.  We use `concat` to create a new array - mutating `this._data`,
 * e.g. with `this._data.push(newRowData)`, would be an error. `_rowHasChanged`
 * understands the shape of the row data and knows how to efficiently compare
 * it.
 *
 * ```
 * getInitialState: function() {
 *   var ds = new ListViewDataSource({rowHasChanged: this._rowHasChanged});
 *   return {ds};
 * },
 * _onDataArrived(newData) {
 *   this._data = this._data.concat(newData);
 *   this.setState({
 *     ds: this.state.ds.cloneWithRows(this._data)
 *   });
 * }
 * ```
 */

class ListViewDataSource {

  /**
   * You can provide custom extraction and `hasChanged` functions for section
   * headers and rows.  If absent, data will be extracted with the
   * `defaultGetRowData` and `defaultGetSectionHeaderData` functions.
   *
   * The default extractor expects data of one of the following forms:
   *
   *      { sectionID_1: { rowID_1: <rowData1>, ... }, ... }
   *
   *    or
   *
   *      { sectionID_1: [ <rowData1>, <rowData2>, ... ], ... }
   *
   *    or
   *
   *      [ [ <rowData1>, <rowData2>, ... ], ... ]
   *
   * The constructor takes in a params argument that can contain any of the
   * following:
   *
   * - getRowData(dataBlob, sectionID, rowID);
   * - getSectionHeaderData(dataBlob, sectionID);
   * - rowHasChanged(prevRowData, nextRowData);
   * - sectionHeaderHasChanged(prevSectionData, nextSectionData);
   */
  constructor(params: ParamType) {
    //
    // 所谓invariant是指这些必须保持不变，ASSERT(True)
    //
    invariant(
      params && typeof params.rowHasChanged === 'function',
      'Must provide a rowHasChanged function.'
    );

    // 首先确定ParamType中的函数设置OK
    this._rowHasChanged = params.rowHasChanged;
    this._getRowData = params.getRowData || defaultGetRowData;
    this._sectionHeaderHasChanged = params.sectionHeaderHasChanged;
    this._getSectionHeaderData = params.getSectionHeaderData || defaultGetSectionHeaderData;

    this._dataBlob = null;
    this._dirtyRows = [];
    this._dirtySections = [];
    this._cachedRowCount = 0;

    // These two private variables are accessed by outsiders because ListView
    // uses them to iterate over the data in this class.
    this.rowIdentities = [];
    this.sectionIdentities = [];
  }

  /**
   * Clones this `ListViewDataSource` with the specified `dataBlob` and
   * `rowIdentities`. The `dataBlob` is just an aribitrary blob of data. At
   * construction an extractor to get the interesting information was defined
   * (or the default was used).
   *
   * The `rowIdentities` is is a 2D array of identifiers for rows.
   * ie. [['a1', 'a2'], ['b1', 'b2', 'b3'], ...].  If not provided, it's
   * assumed that the keys of the section data are the row identities.
   *
   * Note: This function does NOT clone the data in this data source. It simply
   * passes the functions defined at construction to a new data source with
   * the data specified. If you wish to maintain the existing data you must
   * handle merging of old and new data separately and then pass that into
   * this function as the `dataBlob`.
   */
   cloneWithRows(
       dataBlob: Array<any> | {[key: string]: any},
       rowIdentities: ?Array<string>
   ): ListViewDataSource {

    // 似乎只有一个Section, 那么永远都不会有SectionHasChanged发生
    var rowIds = rowIdentities ? [rowIdentities] : null;
    if (!this._sectionHeaderHasChanged) {
      this._sectionHeaderHasChanged = () => false;
    }
    return this.cloneWithRowsAndSections({s1: dataBlob}, ['s1'], rowIds);
  }

  /**
   * This performs the same function as the `cloneWithRows` function but here
   * you also specify what your `sectionIdentities` are. If you don't care
   * about sections you should safely be able to use `cloneWithRows`.
   *
   * `sectionIdentities` is an array of identifiers for  sections.
   * ie. ['s1', 's2', ...].  If not provided, it's assumed that the
   * keys of dataBlob are the section identities.
   *
   * Note: this returns a new object!
   */
  cloneWithRowsAndSections(
      dataBlob: any,
      sectionIdentities: ?Array<string>,
      rowIdentities: ?Array<Array<string>>
  ): ListViewDataSource {
    invariant(
      typeof this._sectionHeaderHasChanged === 'function',
      'Must provide a sectionHeaderHasChanged function with section data.'
    );

    // dataBlob
    // sectionIdentities 的关系
    // 1. 构建新的dataSource
    var newSource = new ListViewDataSource({
      getRowData: this._getRowData,
      getSectionHeaderData: this._getSectionHeaderData,
      rowHasChanged: this._rowHasChanged,
      sectionHeaderHasChanged: this._sectionHeaderHasChanged,
    });

    // 2. 设置数据
    newSource._dataBlob = dataBlob;

    // 3. 如何获取 sectionIdenties(要么单独指定，要么为keys)
    if (sectionIdentities) {
      newSource.sectionIdentities = sectionIdentities;
    } else {
      newSource.sectionIdentities = Object.keys(dataBlob);
    }

    // 4. rowIdenties 要么单独指定
    //    要么
    if (rowIdentities) {
      newSource.rowIdentities = rowIdentities;
    } else {
      newSource.rowIdentities = [];
      newSource.sectionIdentities.forEach((sectionID) => {
        // 如果是dict, 好说
        // 如果是array, 则keys为下标
        newSource.rowIdentities.push(Object.keys(dataBlob[sectionID]));
      });
    }

    // 计算所有的Rows的数量
    newSource._cachedRowCount = countRows(newSource.rowIdentities);

    // 构建新的Source, 并且将现有的数据和新的数据进行对比，标记dirty
    newSource._calculateDirtyArrays(
      this._dataBlob,
      this.sectionIdentities,
      this.rowIdentities
    );

    return newSource;
  }

  getRowCount(): number {
    return this._cachedRowCount;
  }

  /**
   * Returns if the row is dirtied and needs to be rerendered
   */
  rowShouldUpdate(sectionIndex: number, rowIndex: number): bool {
    var needsUpdate = this._dirtyRows[sectionIndex][rowIndex];
    warning(needsUpdate !== undefined,
      'missing dirtyBit for section, row: ' + sectionIndex + ', ' + rowIndex);
    return needsUpdate;
  }

  /**
   * Gets the data required to render the row.
   */
  getRowData(sectionIndex: number, rowIndex: number): any {
    //
    // sectionIndex, rowIndex可能会因为数据的添加删除而发生变化；但是 sectionID, rowID则可能更多地是和数据保持一致
    // sectionID， rowID 是什么概念呢?
    //
    var sectionID = this.sectionIdentities[sectionIndex];
    var rowID = this.rowIdentities[sectionIndex][rowIndex];
    warning(
      sectionID !== undefined && rowID !== undefined,
      'rendering invalid section, row: ' + sectionIndex + ', ' + rowIndex
    );
    return this._getRowData(this._dataBlob, sectionID, rowID);
  }

  /**
   * Gets the rowID at index provided if the dataSource arrays were flattened,
   * or null of out of range indexes.
   */
  getRowIDForFlatIndex(index: number): ?string {
    // rowID是什么概念呢?
    var accessIndex = index;
    for (var ii = 0; ii < this.sectionIdentities.length; ii++) {
      if (accessIndex >= this.rowIdentities[ii].length) {
        accessIndex -= this.rowIdentities[ii].length;
      } else {
        return this.rowIdentities[ii][accessIndex];
      }
    }
    return null;
  }

  /**
   * Gets the sectionID at index provided if the dataSource arrays were flattened,
   * or null for out of range indexes.
   */
  getSectionIDForFlatIndex(index: number): ?string {
    var accessIndex = index;
    for (var ii = 0; ii < this.sectionIdentities.length; ii++) {
      if (accessIndex >= this.rowIdentities[ii].length) {
        accessIndex -= this.rowIdentities[ii].length;
      } else {
        return this.sectionIdentities[ii];
      }
    }
    return null;
  }

  /**
   * Returns an array containing the number of rows in each section
   */
  getSectionLengths(): Array<number> {
    var results = [];
    for (var ii = 0; ii < this.sectionIdentities.length; ii++) {
      results.push(this.rowIdentities[ii].length);
    }
    return results;
  }

  /**
   * Returns if the section header is dirtied and needs to be rerendered
   */
  sectionHeaderShouldUpdate(sectionIndex: number): bool {
    var needsUpdate = this._dirtySections[sectionIndex];
    warning(needsUpdate !== undefined,
      'missing dirtyBit for section: ' + sectionIndex);
    return needsUpdate;
  }

  /**
   * Gets the data required to render the section header
   */
  getSectionHeaderData(sectionIndex: number): any {
    if (!this._getSectionHeaderData) {
      return null;
    }
    var sectionID = this.sectionIdentities[sectionIndex];
    warning(sectionID !== undefined,
      'renderSection called on invalid section: ' + sectionIndex);
    return this._getSectionHeaderData(this._dataBlob, sectionID);
  }

  /**
   * Private members and methods.
   * 定义私有的变量
   */
  _getRowData: typeof defaultGetRowData;
  _getSectionHeaderData: typeof defaultGetSectionHeaderData;
  _rowHasChanged: differType;
  _sectionHeaderHasChanged: ?differType;

  _dataBlob: any;
  _dirtyRows: Array<Array<bool>>;
  _dirtySections: Array<bool>;
  _cachedRowCount: number;

  // These two 'protected' variables are accessed by ListView to iterate over
  // the data in this class.
  rowIdentities: Array<Array<string>>;
  sectionIdentities: Array<string>;

  _calculateDirtyArrays(
    prevDataBlob: any,
    prevSectionIDs: Array<string>,
    prevRowIDs: Array<Array<string>>
  ): void {
    // 工作模式:
    // 1. 构建新的DataSource, 并且新的DataSource已经有了新的数据
    // 2. 现有的数据, 通过参数传入和新的Datasource中的数据进行比较，然后计算出Diff
    //

    // 1. 为就的数据建立Hash(SectionHash, RowHash)
    // construct a hashmap of the existing (old) id arrays
    var prevSectionsHash = keyedDictionaryFromArray(prevSectionIDs);
    var prevRowsHash = {};
    for (var ii = 0; ii < prevRowIDs.length; ii++) {
      var sectionID = prevSectionIDs[ii];
      warning(
        !prevRowsHash[sectionID],
        'SectionID appears more than once: ' + sectionID
      );
      prevRowsHash[sectionID] = keyedDictionaryFromArray(prevRowIDs[ii]);
    }

    // compare the 2 identity array and get the dirtied rows
    this._dirtySections = [];
    this._dirtyRows = [];

    var dirty;
    // 2. 遍历新的数据
    for (var sIndex = 0; sIndex < this.sectionIdentities.length; sIndex++) {
      var sectionID = this.sectionIdentities[sIndex];
      // dirty if the sectionHeader is new or _sectionHasChanged is true
      // 1. 如果新的数据存在，但是就的数据不存在，那么认为是Dirty
      //    新的数据不存在，但是旧的数据存在，那么也认为是Dirty
      dirty = !prevSectionsHash[sectionID];

      var sectionHeaderHasChanged = this._sectionHeaderHasChanged;
      // 2. 如果sectionId存在，则通过sectionHeaderHasChanged来判断
      if (!dirty && sectionHeaderHasChanged) {
        dirty = sectionHeaderHasChanged(
          this._getSectionHeaderData(prevDataBlob, sectionID),
          this._getSectionHeaderData(this._dataBlob, sectionID)
        );
      }

      // 记录sections的变化
      this._dirtySections.push(!!dirty);

      this._dirtyRows[sIndex] = [];
      for (var rIndex = 0; rIndex < this.rowIdentities[sIndex].length; rIndex++) {
        var rowID = this.rowIdentities[sIndex][rIndex];
        // dirty if the section is new, row is new or _rowHasChanged is true
        // Row什么情况下认为变化了
        // 对应的Section为新的; 或者对应的RowId为新的; 或者内容变化了
        // 注意: RowId最好不要使用Index, 否则容易出现问题
        dirty =
          !prevSectionsHash[sectionID] ||
          !prevRowsHash[sectionID][rowID] ||
          this._rowHasChanged(
            this._getRowData(prevDataBlob, sectionID, rowID),
            this._getRowData(this._dataBlob, sectionID, rowID)
          );
        this._dirtyRows[sIndex].push(!!dirty);
      }
    }
    // 新的sectionId不存在，但是在旧的数据中存在，那么如何处理呢?
  }
}

//
// 二维数组: 统计所有二维数组的长度之和
//
function countRows(allRowIDs) {
  var totalRows = 0;
  for (var sectionIdx = 0; sectionIdx < allRowIDs.length; sectionIdx++) {
    var rowIDs = allRowIDs[sectionIdx];
    totalRows += rowIDs.length;
  }
  return totalRows;
}

//
// 将Array变成Dictionary
//      item --> true
//
function keyedDictionaryFromArray(arr) {
  if (isEmpty(arr)) {
    return {};
  }
  var result = {};
  for (var ii = 0; ii < arr.length; ii++) {
    var key = arr[ii];
    warning(!result[key], 'Value appears more than once in array: ' + key);
    result[key] = true;
  }
  return result;
}


module.exports = ListViewDataSource;
