'use strict';

// Drop-in, behaviour-identical replacement for the deprecated `boolean`
// package (boolean@3.2.0). Reproduces its two exported helpers exactly so it
// can be substituted transparently via a pnpm override. Zero dependencies.

const boolean = function (value) {
  switch (Object.prototype.toString.call(value)) {
    case '[object String]':
      return ['true', 't', 'yes', 'y', 'on', '1'].includes(value.trim().toLowerCase());
    case '[object Number]':
      return value.valueOf() === 1;
    case '[object Boolean]':
      return value.valueOf();
    default:
      return false;
  }
};

const isBooleanable = function (value) {
  switch (Object.prototype.toString.call(value)) {
    case '[object String]':
      return [
        'true', 't', 'yes', 'y', 'on', '1',
        'false', 'f', 'no', 'n', 'off', '0'
      ].includes(value.trim().toLowerCase());
    case '[object Number]':
      return [0, 1].includes(value.valueOf());
    case '[object Boolean]':
      return true;
    default:
      return false;
  }
};

exports.boolean = boolean;
exports.isBooleanable = isBooleanable;
