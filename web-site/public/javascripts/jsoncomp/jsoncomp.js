/**
 *
 *
 * This file was taken from the jsoncomp NPM package:
 *
 * https://github.com/tcorral/JSONC
 *
 
MIT LICENSE

Copyright (c) 2013 Tomás Corral Casas

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

 */


/*global gzip, Base64*/
(function () {

  var root,
    JSONC = {},
    isNodeEnvironment,
    _nCode = -1,
    toString = {}.toString;

  /**
   * set the correct root depending from the environment.
   * @type {Object}
   * @private
   */
  root = this;
  /**
   * Check if JSONC is loaded in Node.js environment
   * @type {Boolean}
   * @private
   */
  isNodeEnvironment = typeof exports === 'object' && typeof module === 'object' && typeof module.exports === 'object' && typeof require === 'function';
  /**
   * Checks if the value exist in the array.
   * @param arr
   * @param v
   * @return {boolean}
   */
  function contains(arr, v) {
    var nIndex,
      nLen = arr.length;
    for (nIndex = 0; nIndex < nLen; nIndex++) {
      if (arr[nIndex][1] === v) {
        return true;
      }
    }
    return false;
  }

  /**
   * Removes duplicated values in an array
   * @param oldArray
   * @return {Array}
   */
  function unique(oldArray) {
    var nIndex,
      nLen = oldArray.length,
      aArr = [];
    for (nIndex = 0; nIndex < nLen; nIndex++) {
      if (!contains(aArr, oldArray[nIndex][1])) {
        aArr.push(oldArray[nIndex]);
      }
    }
    return aArr;
  }

  /**
   * Escapes a RegExp
   * @param text
   * @return {*}
   */
  function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  /**
   * Returns if the obj is an object or not.
   * @param obj
   * @return {boolean}
   * @private
   */
  function _isObject(obj) {
    return toString.call(obj) === '[object Object]';
  }

  /**
   * Returns if the obj is an array or not
   * @param obj
   * @return {boolean}
   * @private
   */
  function _isArray(obj) {
    return toString.call(obj) === '[object Array]';
  }

  /**
   * Converts a bidimensional array to object
   * @param aArr
   * @return {{}}
   * @private
   */
  function _biDimensionalArrayToObject(aArr) {
    var obj = {},
      nIndex,
      nLen = aArr.length,
      oItem;
    for (nIndex = 0; nIndex < nLen; nIndex++) {
      oItem = aArr[nIndex];
      obj[oItem[0]] = oItem[1];
    }
    return obj;
  }

  /**
   * Convert a number to their ascii code/s.
   * @param index
   * @param totalChar
   * @param offset
   * @return {Array}
   * @private
   */
  function _numberToKey(index, totalChar, offset) {
    var sKeys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=_!?()*',
      aArr = [],
      currentChar = index;
    totalChar = totalChar || sKeys.length;
    offset = offset || 0;
    while (currentChar >= totalChar) {
      aArr.push(sKeys.charCodeAt((currentChar % totalChar) + offset));
      currentChar = Math.floor(currentChar / totalChar - 1);
    }
    aArr.push(sKeys.charCodeAt(currentChar + offset));
    return aArr.reverse();
  }

  /**
   * Returns the string using an array of ASCII values
   * @param aKeys
   * @return {string}
   * @private
   */
  function _getSpecialKey(aKeys) {
    return String.fromCharCode.apply(String, aKeys);
  }

  /**
   * Traverse all the objects looking for keys and set an array with the new keys
   * @param json
   * @param aKeys
   * @return {*}
   * @private
   */
  function _getKeys(json, aKeys) {
    var aKey,
      sKey,
      oItem;

    for (sKey in json) {

      if (json.hasOwnProperty(sKey)) {
        oItem = json[sKey];
        if (_isObject(oItem) || _isArray(oItem)) {
          aKeys = aKeys.concat(unique(_getKeys(oItem, aKeys)));
        }
        if (isNaN(Number(sKey))) {
          if (!contains(aKeys, sKey)) {
            _nCode += 1;
            aKey = [];
            aKey.push(_getSpecialKey(_numberToKey(_nCode)), sKey);
            aKeys.push(aKey);
          }
        }
      }
    }
    return aKeys;
  }

  /**
   * Method to compress array objects
   * @private
   * @param json
   * @param aKeys
   */
  function _compressArray(json, aKeys) {
    var nIndex,
      nLenKeys;

    for (nIndex = 0, nLenKeys = json.length; nIndex < nLenKeys; nIndex++) {
      json[nIndex] = JSONC.compress(json[nIndex], aKeys);
    }
  }

  /**
   * Method to compress anything but array
   * @private
   * @param json
   * @param aKeys
   * @return {*}
   */
  function _compressOther(json, aKeys) {
    var oKeys,
      aKey,
      str,
      nLenKeys,
      nIndex,
      obj;
    aKeys = _getKeys(json, aKeys);
    aKeys = unique(aKeys);
    oKeys = _biDimensionalArrayToObject(aKeys);

    str = JSON.stringify(json);
    nLenKeys = aKeys.length;

    for (nIndex = 0; nIndex < nLenKeys; nIndex++) {
      aKey = aKeys[nIndex];
      str = str.replace(new RegExp(escapeRegExp('"' + aKey[1] + '"'), 'g'), '"' + aKey[0] + '"');
    }
    obj = JSON.parse(str);
    obj._ = oKeys;
    return obj;
  }

  /**
   * Method to decompress array objects
   * @private
   * @param json
   */
  function _decompressArray(json) {
    var nIndex, nLenKeys;

    for (nIndex = 0, nLenKeys = json.length; nIndex < nLenKeys; nIndex++) {
      json[nIndex] = JSONC.decompress(json[nIndex]);
    }
  }

  /**
   * Method to decompress anything but array
   * @private
   * @param jsonCopy
   * @return {*}
   */
  function _decompressOther(jsonCopy) {
    var oKeys, str, sKey;

    oKeys = JSON.parse(JSON.stringify(jsonCopy._));
    delete jsonCopy._;
    str = JSON.stringify(jsonCopy);
    for (sKey in oKeys) {
      if (oKeys.hasOwnProperty(sKey)) {
        str = str.replace(new RegExp('"' + sKey + '"', 'g'), '"' + oKeys[sKey] + '"');
      }
    }
    return str;
  }

  /**
   * Compress a RAW JSON
   * @param json
   * @param optKeys
   * @return {*}
   */
  JSONC.compress = function (json, optKeys) {
    if (!optKeys) {
      _nCode = -1;
    }
    var aKeys = optKeys || [],
      obj;

    if (_isArray(json)) {
      _compressArray(json, aKeys);
      obj = json;
    }
    else {
      obj = _compressOther(json, aKeys);
    }
    return obj;
  };
  /**
   * Use LZString to get the compressed string.
   * @param json
   * @param bCompress
   * @return {String}
   */
  JSONC.pack = function (json, bCompress) {
    var str = JSON.stringify((bCompress ? JSONC.compress(json) : json));
    return Base64.encode(String.fromCharCode.apply(String, gzip.zip(str,{level:9})));
  };
  /**
   * Decompress a compressed JSON
   * @param json
   * @return {*}
   */
  JSONC.decompress = function (json) {
    var str,
      jsonCopy = JSON.parse(JSON.stringify(json));
    if (_isArray(jsonCopy)) {
      _decompressArray(jsonCopy);
    }
    else {
      str = _decompressOther(jsonCopy);
    }
    return str ? JSON.parse(str) : jsonCopy;
  };
  function getArr(str) {
    var nIndex = 0,
      nLen = str.length,
      arr = [];
    for (; nIndex < nLen; nIndex++) {
      arr.push(str.charCodeAt(nIndex));
    }
    return arr;
  }

  /**
   * Returns the JSON object from the LZW string
   * @param gzipped
   * @param bDecompress
   * @return {Object}
   */
  JSONC.unpack = function (gzipped, bDecompress) {
    var aArr = getArr(Base64.decode(gzipped)),
      str = String.fromCharCode.apply(String, gzip.unzip(aArr,{level:9})),
      json = JSON.parse(str);
    return bDecompress ? JSONC.decompress(json) : json;
  };
  /*
   * Expose Hydra to be used in node.js, as AMD module or as global
   */
  root.JSONC = JSONC;
  if (isNodeEnvironment) {
    module.exports = JSONC;
  }
  else if (typeof define !== 'undefined') {
    define('jsoncomp', [], function () {
      return JSONC;
    });
  }
}.call(this));