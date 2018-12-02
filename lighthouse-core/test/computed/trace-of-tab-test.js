/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const TraceOfTab = require('../../computed/trace-of-tab.js');

const assert = require('assert');
const fs = require('fs');
const badNavStartTrace = require('../fixtures/traces/bad-nav-start-ts.json');
const lateTracingStartedTrace = require('../fixtures/traces/tracingstarted-after-navstart.json');
const preactTrace = require('../fixtures/traces/preactjs.com_ts_of_undefined.json');
const noFMPtrace = require('../fixtures/traces/no_fmp_event.json');
const noFCPtrace = require('../fixtures/traces/airhorner_no_fcp.json');
const noNavStartTrace = require('../fixtures/traces/no_navstart_event.json');
const backgroundTabTrace = require('../fixtures/traces/backgrounded-tab-missing-paints.json');

/* eslint-env jest */
describe('Trace of Tab computed artifact:', () => {
  it('gathers the events from the tab\'s process', async () => {
    const trace = await TraceOfTab.compute_(lateTracingStartedTrace);

    const firstEvt = trace.processEvents[0];
    trace.processEvents.forEach(evt => {
      assert.equal(evt.pid, firstEvt.pid, 'A traceEvent is found from another process');
    });

    assert.ok(firstEvt.pid === trace.mainFrameIds.pid);
    assert.ok(firstEvt.pid === trace.navigationStartEvt.pid);
    assert.ok(firstEvt.pid === trace.firstContentfulPaintEvt.pid);
    assert.ok(firstEvt.pid === trace.firstMeaningfulPaintEvt.pid);
  });

  it('computes timings of each event', async () => {
    const trace = await TraceOfTab.compute_(lateTracingStartedTrace);
    assert.equal(Math.round(trace.timings.navigationStart), 0);
    assert.equal(Math.round(trace.timings.firstPaint), 80);
    assert.equal(Math.round(trace.timings.firstContentfulPaint), 80);
    assert.equal(Math.round(trace.timings.firstMeaningfulPaint), 530);
    assert.equal(Math.round(trace.timings.traceEnd), 649);
  });

  it('computes timestamps of each event', async () => {
    const trace = await TraceOfTab.compute_(lateTracingStartedTrace);
    assert.equal(Math.round(trace.timestamps.navigationStart), 29343540951);
    assert.equal(Math.round(trace.timestamps.firstPaint), 29343620997);
    assert.equal(Math.round(trace.timestamps.firstContentfulPaint), 29343621005);
    assert.equal(Math.round(trace.timestamps.firstMeaningfulPaint), 29344070867);
    assert.equal(Math.round(trace.timestamps.traceEnd), 29344190223);
  });

  describe('finds correct FMP', () => {
    it('if there was a tracingStartedInPage after the frame\'s navStart', async () => {
      const trace = await TraceOfTab.compute_(lateTracingStartedTrace);
      assert.equal(trace.mainFrameIds.frameId, '0x163736997740');
      assert.equal(trace.navigationStartEvt.ts, 29343540951);
      assert.equal(trace.firstContentfulPaintEvt.ts, 29343621005);
      assert.equal(trace.firstMeaningfulPaintEvt.ts, 29344070867);
      assert.ok(!trace.fmpFellBack);
    });

    it('if there was a tracingStartedInPage after the frame\'s navStart #2', async () => {
      const trace = await TraceOfTab.compute_(badNavStartTrace);
      assert.equal(trace.mainFrameIds.frameId, '0x89915541e48');
      assert.equal(trace.navigationStartEvt.ts, 8885424467);
      assert.equal(trace.firstContentfulPaintEvt.ts, 8886056886);
      assert.equal(trace.firstMeaningfulPaintEvt.ts, 8886056891);
      assert.ok(!trace.fmpFellBack);
    });

    it('if it appears slightly before the fCP', async () => {
      const trace = await TraceOfTab.compute_(preactTrace);
      assert.equal(trace.mainFrameIds.frameId, '0x25edaa521e58');
      assert.equal(trace.navigationStartEvt.ts, 1805796384607);
      assert.equal(trace.firstContentfulPaintEvt.ts, 1805797263653);
      assert.equal(trace.firstMeaningfulPaintEvt.ts, 1805797262960);
      assert.ok(!trace.fmpFellBack);
    });

    it('from candidates if no defined FMP exists', async () => {
      const trace = await TraceOfTab.compute_(noFMPtrace);
      assert.equal(trace.mainFrameIds.frameId, '0x150343381dd0');
      assert.equal(trace.navigationStartEvt.ts, 2146735807738);
      assert.equal(trace.firstContentfulPaintEvt.ts, 2146737302468);
      assert.equal(trace.firstMeaningfulPaintEvt.ts, 2146740268666);
      assert.ok(trace.fmpFellBack);
    });
  });

  it('handles traces missing a paints (captured in background tab)', async () => {
    const trace = await TraceOfTab.compute_(backgroundTabTrace);
    assert.equal(trace.mainFrameIds.frameId, '0x53965941e30');
    assert.notEqual(trace.navigationStartEvt.ts, 1966813346529, 'picked wrong frame');
    assert.notEqual(trace.navigationStartEvt.ts, 1966813520313, 'picked wrong frame');
    assert.equal(
      trace.navigationStartEvt.ts,
      1966813258737,
      'didnt select navStart event with same timestamp as usertiming measure'
    );
    assert.equal(trace.firstMeaningfulPaintEvt, undefined, 'bad fmp');
  });

  it('handles traces with TracingStartedInBrowser events', async () => {
    const tracingStartedInBrowserTrace = {
      'traceEvents': [{
        'pid': 69850,
        'tid': 69850,
        'ts': 2193564729582,
        'ph': 'I',
        'cat': 'disabled-by-default-devtools.timeline',
        'name': 'TracingStartedInBrowser',
        'args': {'data': {
          'frameTreeNodeId': 1,
          'frames': [{
            'frame': 'B192D1F3355A6F961EC8F0B01623C1FB',
            'url': 'http://www.example.com/',
            'name': '',
            'processId': 69920,
          }],
        }},
        'tts': 1085165,
        's': 't',
      }, {
        'pid': 69920,
        'tid': 1,
        'ts': 2193564790059,
        'ph': 'R',
        'cat': 'blink.user_timing',
        'name': 'navigationStart',
        'args': {
          'frame': 'B192D1F3355A6F961EC8F0B01623C1FB',
          'data': {
            'documentLoaderURL': 'http://www.example.com/',
            'isLoadingMainFrame': true,
          },
        },
        'tts': 141371,
      }, {
        'pid': 69920,
        'tid': 1,
        'ts': 2193564790060,
        'ph': 'R',
        'cat': 'loading,rail,devtools.timeline',
        'name': 'firstContentfulPaint',
        'args': {
          'frame': 'B192D1F3355A6F961EC8F0B01623C1FB',
        },
        'tts': 141372,
      }, {
        'pid': 69920,
        'tid': 1,
        'ts': 0,
        'ph': 'M',
        'cat': '__metadata',
        'name': 'thread_name',
        'args': {'name': 'CrRendererMain'},
      }]};
    const trace = await TraceOfTab.compute_(tracingStartedInBrowserTrace);
    assert.equal(trace.mainFrameIds.frameId, 'B192D1F3355A6F961EC8F0B01623C1FB');
    assert.equal(trace.navigationStartEvt.ts, 2193564790059);
  });

  it('stably sorts events', async () => {
    const traceJson = fs.readFileSync(__dirname +
        '/../fixtures/traces/tracingstarted-after-navstart.json', 'utf8');
    const trace = await TraceOfTab.compute_(JSON.parse(traceJson));
    const mainPid = trace.mainThreadEvents[0].pid;

    const freshProcessEvents = JSON.parse(traceJson).traceEvents
        .filter(e => e.pid === mainPid);

    // Group all events with the same timestamp in original trace order.
    const tsMap = new Map();
    for (const event of freshProcessEvents) {
      const tsGroup = tsMap.get(event.ts) || [];
      tsGroup.push(event);
      tsMap.set(event.ts, tsGroup);
    }

    // Assert that groups of same-timestamped events are in the same order in
    // processed events.
    for (const [ts, tsGroup] of tsMap) {
      if (tsGroup.length === 1) {
        continue;
      }

      // .filter overhead could be slow, but only a handful of tsGroups.
      const sortedEvents = trace.processEvents.filter(e => e.ts === ts);
      assert.deepStrictEqual(sortedEvents, tsGroup);
    }
  });

  it('throws on traces missing a navigationStart', () => {
    return TraceOfTab.compute_(noNavStartTrace)
      .then(_ => assert(false, 'NO_NAVSTART error not throw'),
        err => assert.equal(err.message, 'NO_NAVSTART'));
  });

  it('throws on traces missing an FCP', () => {
    return TraceOfTab.compute_(noFCPtrace)
      .then(_ => assert(false, 'NO_FCP error not throw'),
        err => assert.equal(err.message, 'NO_FCP'));
  });
});
