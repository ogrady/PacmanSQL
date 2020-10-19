"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zip = exports.range = void 0;
// neat little trick I stole from https://stackoverflow.com/a/37417976
exports.range = (length) => Array(length).fill(undefined).map((element, index) => index);
// https://stackoverflow.com/a/22015930
exports.zip = (xs, ys) => xs.map((k, i) => [k, ys[i]]);
