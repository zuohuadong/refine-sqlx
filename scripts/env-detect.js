// scripts/env-detect.js
const { detectRuntime } = require('../test/setup');
console.log(`[ci] 检测到运行时环境: ${detectRuntime()}`);
