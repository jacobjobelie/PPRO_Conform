if (!Array.prototype.indexOf) { //eslint-disable-line
  Array.prototype.indexOf = function (b) { //eslint-disable-line
    var a = this.length >>> 0; var c = Number(arguments[1]) || 0; //eslint-disable-line
    c = (c < 0) ? Math.ceil(c) : Math.floor(c); if (c < 0) { c += a } for (; c < a; c++) { if (c in this && this[c] === b) { return c } } return -1 } }; //eslint-disable-line
if (Array.prototype.map === undefined) { //eslint-disable-line
  Array.prototype.map = function(fn) { //eslint-disable-line
    var rv = []; //eslint-disable-line
    for (var i = 0, l = this.length; i < l; i++) //eslint-disable-line
      rv.push(fn(this[i])); //eslint-disable-line
    return rv; //eslint-disable-line
  }; //eslint-disable-line
} //eslint-disable-line
if (!Array.prototype.forEach) { //eslint-disable-line
  Array.prototype.forEach = function forEach(callback, thisArg) {//eslint-disable-line
    if (typeof callback !== 'function') {//eslint-disable-line
      throw new TypeError(callback + ' is not a function');//eslint-disable-line
    }//eslint-disable-line
    var array = this;//eslint-disable-line
    thisArg = thisArg || this;//eslint-disable-line
    for (var i = 0, l = array.length; i !== l; ++i) {//eslint-disable-line
      callback.call(thisArg, array[i], i, array);//eslint-disable-line
    }//eslint-disable-line
  };//eslint-disable-line
}//eslint-disable-line

$._ext_UTILS = {
  itterate: function (array, length) {
    var items = [];
    for (var i = 0; i < length; i++) {
      items.push(array[i]);
    }
    return items;
  },
  unescapeQuotes: function (string) {
    return string.replace(/[ \\]/g, '').replace(/\\"/g, '"');
  },
  recurrsiveChildrenItterate: function (array, length) {
    var results = [];
    var _self = this;
    this.itterate(array, length)
      .forEach(function (child) {
        if (child.children) {
          var r = _self.recurrsiveChildrenItterate(child.children, child.children.numItems);
          results.push([].concat.apply([], r));
        } else {
          results.push(child);
        }
      });
    return [].concat.apply([], results);
  }
};
/**
 * Polyfill for Object.keys
 *
 * @see: https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/keys
 */
if (!Object.keys) {
  Object.keys = (function () {
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString');
    var dontEnums = [
      'toString',
      'toLocaleString',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'constructor'
    ];
    var dontEnumsLength = dontEnums.length;

    return function (obj) {
      if (typeof obj !== 'object' && typeof obj !== 'function' || obj === null) throw new TypeError('Object.keys called on non-object');

      var result = [];

      for (var prop in obj) {
        if (hasOwnProperty.call(obj, prop)) result.push(prop);
      }

      if (hasDontEnumBug) {
        for (var i = 0; i < dontEnumsLength; i++) {
          if (hasOwnProperty.call(obj, dontEnums[i])) result.push(dontEnums[i]);
        }
      }
      return result;
    };
  })();
}
