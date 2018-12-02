/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-env jest */

const assert = require('assert');
const devtoolsLog = require('../fixtures/traces/progressive-app-m60.devtools.log.json');
const LoadSimulator = require('../../computed/load-simulator.js');

describe('Simulator artifact', () => {
  it('returns a simulator for "provided" throttling', async () => {
    const settings = {throttlingMethod: 'provided'};
    const context = {settings, computedCache: new Map()};
    const simulator = await LoadSimulator.request({
      devtoolsLog,
      settings,
    }, context);

    assert.equal(Math.round(simulator._rtt), 3);
    assert.equal(Math.round(simulator._throughput / 1024), 1590);
    assert.equal(simulator._cpuSlowdownMultiplier, 1);
    assert.equal(simulator._layoutTaskMultiplier, 1);
  });

  it('returns a simulator for "devtools" throttling', async () => {
    const throttling = {requestLatencyMs: 375, downloadThroughputKbps: 900};
    const settings = {throttlingMethod: 'devtools', throttling};
    const context = {settings, computedCache: new Map()};
    const simulator = await LoadSimulator.request({
      devtoolsLog,
      settings,
    }, context);

    assert.equal(simulator._rtt, 100);
    assert.equal(simulator._throughput / 1024, 1000);
    assert.equal(simulator._cpuSlowdownMultiplier, 1);
    assert.equal(simulator._layoutTaskMultiplier, 1);
  });

  it('returns a simulator for "simulate" throttling', async () => {
    const throttling = {rttMs: 120, throughputKbps: 1000, cpuSlowdownMultiplier: 3};
    const settings = {throttlingMethod: 'simulate', throttling};
    const context = {settings, computedCache: new Map()};
    const simulator = await LoadSimulator.request({
      devtoolsLog,
      settings,
    }, context);

    assert.equal(simulator._rtt, 120);
    assert.equal(simulator._throughput / 1024, 1000);
    assert.equal(simulator._cpuSlowdownMultiplier, 3);
    assert.equal(simulator._layoutTaskMultiplier, 1.5);
  });
});
