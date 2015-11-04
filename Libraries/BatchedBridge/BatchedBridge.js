/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule BatchedBridge
 */
'use strict';

let MessageQueue = require('MessageQueue');

// __fbBatchedBridgeConfig 由OC或者Java 通过Bridge调用 _javaScriptExecutor, 将Native内部的信息传输过来
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let
let BatchedBridge = new MessageQueue(
  __fbBatchedBridgeConfig.remoteModuleConfig,
  __fbBatchedBridgeConfig.localModulesConfig,
);

module.exports = BatchedBridge;
