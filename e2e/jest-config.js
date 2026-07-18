const DetoxCircusEnvironment = require('detox/runners/jest/env');

const config = {
...DetoxCircusEnvironment,
  testEnvironment: 'node',
  testMatch: [
    '**/?(*.)(e2e).js?(x)'
  ],
  setupFiles: ['./e2e/setup.js'],
};

module.exports = config;