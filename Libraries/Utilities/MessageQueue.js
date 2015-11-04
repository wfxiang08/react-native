/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule MessageQueue
 */

/*eslint no-bitwise: 0*/

'use strict';

let BridgeProfiling = require('BridgeProfiling');
let ErrorUtils = require('ErrorUtils');
let JSTimersExecution = require('JSTimersExecution');
let ReactUpdates = require('ReactUpdates');

let invariant = require('invariant');
let keyMirror = require('keyMirror');
let stringifySafe = require('stringifySafe');

let MODULE_IDS = 0;
let METHOD_IDS = 1;
let PARAMS = 2;
let MIN_TIME_BETWEEN_FLUSHES_MS = 5;

let SPY_MODE = false;

// Constructs an enumeration with keys equal to their value.
// {
//    "remote": "remote",
//    "remoteAsync": "remoteAsync",
// }
let MethodTypes = keyMirror({
  remote: null,
  remoteAsync: null,
});

// 控制异常，保证代码执行过程可控
var guard = (fn) => {
  try {
    fn();
  } catch (error) {
    ErrorUtils.reportFatalError(error);
  }
};

class MessageQueue {

  constructor(remoteModules, localModules, customRequire) {
    this.RemoteModules = {};

    this._require = customRequire || require;
    this._queue = [[],[],[]];
    this._moduleTable = {};
    this._methodTable = {};
    this._callbacks = [];
    this._callbackID = 0;
    this._lastFlush = 0;

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
    // 创建Bounded Function
    [
      'invokeCallbackAndReturnFlushedQueue',
      'callFunctionReturnFlushedQueue',
      'flushedQueue',
    ].forEach((fn) => this[fn] = this[fn].bind(this));

    // let modulesConfig = remoteModules;
    let modulesConfig = this._genModulesConfig(remoteModules);

    this._genModules(modulesConfig);
    localModules && this._genLookupTables(
      this._genModulesConfig(localModules),this._moduleTable, this._methodTable
    );

    this._debugInfo = {};
    this._remoteModuleTable = {};
    this._remoteMethodTable = {};
    this._genLookupTables(
      modulesConfig, this._remoteModuleTable, this._remoteMethodTable
    );
  }

  /**
   * Public APIs
   * 1. 执行来自Native的调用，顺带执行setTimeout(func, 0)的函数
   * 2. 返回待交给Native执行的函数
   */
  callFunctionReturnFlushedQueue(module, method, args) {
    guard(() => {
      this.__callFunction(module, method, args);
      this.__callImmediates();
    });

    return this.flushedQueue();
  }

  /**
   * JS调用Native的函数，并且告知: Succ Callback, Fail Callback
   * 然后在Succ or Fail之后，Native回调JS, 顺便把JS的请求同步过来
   * @param cbID
   * @param args
   * @returns {*}
   */
  invokeCallbackAndReturnFlushedQueue(cbID, args) {
    guard(() => {
      this.__invokeCallback(cbID, args);
      this.__callImmediates();
    });

    return this.flushedQueue();
  }

  /**
   * 将JS中的所有的请求交给Native
   * @returns {*}
   */
  flushedQueue() {
    this.__callImmediates();

    let queue = this._queue;
    this._queue = [[],[],[]];
    return queue[0].length ? queue : null;
  }

  /**
   * "Private" methods
   */

  __callImmediates() {
    BridgeProfiling.profile('JSTimersExecution.callImmediates()');
    guard(() => JSTimersExecution.callImmediates());
    BridgeProfiling.profileEnd();
  }

  __nativeCall(module, method, params, onFail, onSucc) {
    // 如何调用Native呢?
    if (onFail || onSucc) {

      // 1. 控制_debugInfo的大小
      // eventually delete old debug info(TODO: 感觉有问题)
      (this._callbackID > (1 << 5)) && (this._debugInfo[this._callbackID >> 5] = null);
      this._debugInfo[this._callbackID >> 1] = [module, method];

      // 2. 构建编码化的参数, 回调函数通过: callbackId来处理
      onFail && params.push(this._callbackID);
      this._callbacks[this._callbackID++] = onFail;
      onSucc && params.push(this._callbackID);
      this._callbacks[this._callbackID++] = onSucc;
    }

    // 3. 将函数调用信息放在_queue中
    this._queue[MODULE_IDS].push(module);
    this._queue[METHOD_IDS].push(method);
    this._queue[PARAMS].push(params);

    var now = new Date().getTime();
    // 如果支持JS直接调用Native, 则每隔一段时间直接调用Native
    if (global.nativeFlushQueueImmediate && now - this._lastFlush >= MIN_TIME_BETWEEN_FLUSHES_MS) {
      // 如何FlushQueue呢?
      // 5ms Flush一次
      // 似乎是Native主动向JS暴露的接口
      global.nativeFlushQueueImmediate(this._queue);
      this._queue = [[],[],[]];
      this._lastFlush = now;
    }


    if (__DEV__ && SPY_MODE && isFinite(module)) {
      console.log('JS->N : ' + this._remoteModuleTable[module] + '.' +
        this._remoteMethodTable[module][method] + '(' + JSON.stringify(params) + ')');
    }
  }

  __callFunction(module, method, args) {
    // 执行JS自己的方法
    // Profiling
    BridgeProfiling.profile(() => `${module}.${method}(${stringifySafe(args)})`);

    this._lastFlush = new Date().getTime();

    // module有效，则读取method等信息
    if (isFinite(module)) {
      method = this._methodTable[module][method];
      module = this._moduleTable[module];
    }
    if (__DEV__ && SPY_MODE) {
      console.log('N->JS : ' + module + '.' + method + '(' + JSON.stringify(args) + ')');
    }
    module = this._require(module);
    module[method].apply(module, args);

    BridgeProfiling.profileEnd();
  }

  __invokeCallback(cbID, args) {
    BridgeProfiling.profile(
      () => `MessageQueue.invokeCallback(${cbID}, ${stringifySafe(args)})`);
    this._lastFlush = new Date().getTime();
    let callback = this._callbacks[cbID];
    if (!callback || __DEV__) {
      let debug = this._debugInfo[cbID >> 1];
      let module = debug && this._remoteModuleTable[debug[0]];
      let method = debug && this._remoteMethodTable[debug[0]][debug[1]];
      invariant(
        callback,
        `Callback with id ${cbID}: ${module}.${method}() not found`
      );
      if (callback && SPY_MODE) {
        console.log('N->JS : <callback for ' + module + '.' + method + '>(' + JSON.stringify(args) + ')');
      }
    }
    this._callbacks[cbID & ~1] = null;
    this._callbacks[cbID |  1] = null;
    callback.apply(null, args);
    BridgeProfiling.profileEnd();
  }

  /**
   * Private helper methods
   */

  /**
   * Converts the old, object-based module structure to the new
   * array-based structure. TODO (t8823865) Removed this
   * function once Android has been updated.
   */
  _genModulesConfig(modules /* array or object */) {
    // 如果已经处理好，则跳过
    if (Array.isArray(modules)) {
      return modules;

    } else {
      // 基本上不用考虑
      let moduleArray = [];
      let moduleNames = Object.keys(modules);
      for (var i = 0, l = moduleNames.length; i < l; i++) {
        let moduleName = moduleNames[i];
        let moduleConfig = modules[moduleName];
        let module = [moduleName];
        if (moduleConfig.constants) {
          module.push(moduleConfig.constants);
        }
        let methodsConfig = moduleConfig.methods;
        if (methodsConfig) {
          let methods = [];
          let asyncMethods = [];
          let methodNames = Object.keys(methodsConfig);
          for (var j = 0, ll = methodNames.length; j < ll; j++) {
            let methodName = methodNames[j];
            let methodConfig = methodsConfig[methodName];
            methods[methodConfig.methodID] = methodName;
            if (methodConfig.type === MethodTypes.remoteAsync) {
              asyncMethods.push(methodConfig.methodID);
            }
          }
          if (methods.length) {
            module.push(methods);
            if (asyncMethods.length) {
              module.push(asyncMethods);
            }
          }
        }
        moduleArray[moduleConfig.moduleID] = module;
      }
      return moduleArray;
    }
  }

  _genLookupTables(modulesConfig, moduleTable, methodTable) {
    modulesConfig.forEach((module, moduleID) => {
      if (!module) {
        return;
      }

      let moduleName, methods;
      if (moduleHasConstants(module)) {
        [moduleName, , methods] = module;
      } else {
        [moduleName, methods] = module;
      }

      moduleTable[moduleID] = moduleName;
      methodTable[moduleID] = Object.assign({}, methods);
    });
  }

  _genModules(remoteModules) {
    // 将remoteModules转换成为: this.RemoteModules
    remoteModules.forEach((module, moduleID) => {
      if (!module) {
        return;
      }

      let moduleName, constants, methods, asyncMethods;

      // destruct array
      // 判断标志: constants不是数组
      if (moduleHasConstants(module)) {
        [moduleName, constants, methods, asyncMethods] = module;
      } else {
        [moduleName, methods, asyncMethods] = module;
      }

      // moduleName --> {moduleId, contants, methods, asyncMethods}
      // dict的简化写法
      const moduleConfig = {moduleID, constants, methods, asyncMethods};
      this.RemoteModules[moduleName] = this._genModule({}, moduleConfig);
    });
  }

  _genModule(module, moduleConfig) {
    const {moduleID, constants, methods = [], asyncMethods = []} = moduleConfig;

    methods.forEach((methodName, methodID) => {
      const methodType = arrayContains(asyncMethods, methodID) ? MethodTypes.remoteAsync : MethodTypes.remote;
      module[methodName] = this._genMethod(moduleID, methodID, methodType);
    });
    Object.assign(module, constants);

    return module;
  }

  _genMethod(module, method, type) {
    // 如何使得一个Native的信息，例如: [NotificationManager, setApplicationBadgeNum, 1] 变成可执行的代码
    // 1. remoteAsync 方法，在本地就是一个Promise
    // 2. remote 同步方法，"直接调用"remote
    let fn = null;
    let self = this;
    // 异步，或者同步
    if (type === MethodTypes.remoteAsync) {
      // 如果是异步的，那么返回一个Promise
      fn = function(...args) {
        return new Promise((resolve, reject) => {
          self.__nativeCall(module, method, args, resolve, (errorData) => {
            var error = createErrorFromErrorData(errorData);
            reject(error);
          });
        });
      };
    } else {
      fn = function(...args) {
        let lastArg = args.length > 0 ? args[args.length - 1] : null;
        let secondLastArg = args.length > 1 ? args[args.length - 2] : null;

        let hasSuccCB = typeof lastArg === 'function';
        let hasErrorCB = typeof secondLastArg === 'function';

        // 如果有错误的callback, 那么必须有成功的callback
        hasErrorCB && invariant(
          hasSuccCB,
          'Cannot have a non-function arg after a function arg.'
        );

        let numCBs = hasSuccCB + hasErrorCB;
        let onSucc = hasSuccCB ? lastArg : null;
        let onFail = hasErrorCB ? secondLastArg : null;

        args = args.slice(0, args.length - numCBs);

        // 将参数从 args标准化为:
        // module, method, args, onFail, onSucc等标准的语法
        return self.__nativeCall(module, method, args, onFail, onSucc);
      };
    }
    fn.type = type;
    return fn;
  }

}

// 这种带有类型的语法是哪来的?
function moduleHasConstants(moduleArray: Array<Object|Array<>>): boolean {
  return !Array.isArray(moduleArray[1]);
}

function arrayContains<T>(array: Array<T>, value: T): boolean {
  return array.indexOf(value) !== -1;
}

function createErrorFromErrorData(errorData: {message: string}): Error {
  var {
    message,
    ...extraErrorInfo,
  } = errorData;
  var error = new Error(message);
  error.framesToPop = 1;
  return Object.assign(error, extraErrorInfo);
}

module.exports = MessageQueue;
