"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.choice = exports.zip = exports.range = void 0;
// neat little trick I stole from https://stackoverflow.com/a/37417976
const range = (length) => Array(length).fill(undefined).map((element, index) => index);
exports.range = range;
// https://stackoverflow.com/a/22015930
const zip = (xs, ys) => xs.map((k, i) => [k, ys[i]]);
exports.zip = zip;
// https://stackoverflow.com/a/4550514
const choice = (xs) => xs[Math.floor(Math.random() * xs.length)];
exports.choice = choice;
