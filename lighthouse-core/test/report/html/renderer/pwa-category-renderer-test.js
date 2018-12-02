/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-env jest, browser */

const assert = require('assert');
const fs = require('fs');
const jsdom = require('jsdom');
const Util = require('../../../../report/html/renderer/util.js');
const URL = require('../../../../lib/url-shim.js');
const DOM = require('../../../../report/html/renderer/dom.js');
const DetailsRenderer = require('../../../../report/html/renderer/details-renderer.js');
const CategoryRenderer = require('../../../../report/html/renderer/category-renderer.js');
const sampleResultsOrig = require('../../../results/sample_v2.json');

const TEMPLATE_FILE = fs.readFileSync(__dirname +
    '/../../../../report/html/templates.html', 'utf8');

describe('PwaCategoryRenderer', () => {
  let category;
  let pwaRenderer;
  let sampleResults;

  beforeAll(() => {
    global.URL = URL;
    global.Util = Util;
    global.CategoryRenderer = CategoryRenderer;

    const PwaCategoryRenderer =
        require('../../../../report/html/renderer/pwa-category-renderer.js');

    const {document} = new jsdom.JSDOM(TEMPLATE_FILE).window;
    const dom = new DOM(document);
    const detailsRenderer = new DetailsRenderer(dom);
    pwaRenderer = new PwaCategoryRenderer(dom, detailsRenderer);

    sampleResults = Util.prepareReportResult(sampleResultsOrig);
  });

  beforeEach(() => {
    // Clone category to allow modifications.
    const pwaCategory = sampleResults.reportCategories.find(cat => cat.id === 'pwa');
    category = JSON.parse(JSON.stringify(pwaCategory));
  });

  afterAll(() => {
    global.URL = undefined;
    global.Util = undefined;
    global.CategoryRenderer = undefined;
  });

  it('renders the regular audits', () => {
    const categoryElem = pwaRenderer.render(category, sampleResults.categoryGroups);
    const allAuditElements = Array.from(categoryElem.querySelectorAll('.lh-audit'));
    const manualElements = Array.from(categoryElem.querySelectorAll('.lh-clump--manual .lh-audit'));
    const regularAuditElements = allAuditElements.filter(el => !manualElements.includes(el));

    const nonManualAudits = category.auditRefs
      .filter(audit => audit.result.scoreDisplayMode !== 'manual');

    assert.strictEqual(regularAuditElements.length, nonManualAudits.length);
  });

  it('renders the manual audits', () => {
    const categoryElem = pwaRenderer.render(category, sampleResults.categoryGroups);
    const manualElements = categoryElem.querySelectorAll('.lh-clump--manual .lh-audit');

    const manualAudits = category.auditRefs
      .filter(audit => audit.result.scoreDisplayMode === 'manual');

    assert.strictEqual(manualElements.length, manualAudits.length);
  });

  it('manual audits are the only clump', () => {
    const categoryElem = pwaRenderer.render(category, sampleResults.categoryGroups);
    const clumpElems = categoryElem.querySelectorAll('.lh-clump');
    assert.strictEqual(clumpElems.length, 1);
    assert.ok(clumpElems[0].classList.contains('lh-clump--manual'));
  });

  it('renders the audit groups', () => {
    const categoryGroupIds = new Set(category.auditRefs.filter(a => a.group).map(a => a.group));
    assert.strictEqual(categoryGroupIds.size, 3); // Ensure there's something to test.

    const categoryElem = pwaRenderer.render(category, sampleResults.categoryGroups);

    categoryGroupIds.forEach(groupId => {
      const selector = `.lh-audit-group--${groupId}`;
      // Expected that only the non-manual audits will be grouped.
      assert.strictEqual(categoryElem.querySelectorAll(selector).length, 1,
        `trouble with selector '${selector}'`);
    });
  });

  describe('badging groups', () => {
    let auditRefs;
    let groupIds;

    beforeEach(() => {
      auditRefs = category.auditRefs
        .filter(audit => audit.result.scoreDisplayMode !== 'manual');

      // Expect results to all be scorable.
      for (const auditRef of auditRefs) {
        assert.strictEqual(auditRef.result.scoreDisplayMode, 'binary');
      }

      groupIds = [...new Set(auditRefs.map(ref => ref.group))];
    });

    it('only gives a group a badge when all the group\'s audits are passing', () => {
      for (const auditRef of auditRefs) {
        auditRef.result.score = 0;
      }

      const targetGroupId = groupIds[2];
      assert.ok(targetGroupId);
      const targetAuditRefs = auditRefs.filter(ref => ref.group === targetGroupId);

      // Try every permutation of audit scoring.
      const totalPermutations = Math.pow(2, targetAuditRefs.length);
      for (let i = 0; i < totalPermutations; i++) {
        for (let j = 0; j < targetAuditRefs.length; j++) {
          // Set as passing if jth bit in i is set.
          targetAuditRefs[j].result.score = i >> j & 1;
        }

        const categoryElem = pwaRenderer.render(category, sampleResults.categoryGroups);
        const badgedElems = categoryElem.querySelectorAll(`.lh-badged`);
        const badgedScoreGauge =
          categoryElem.querySelector('.lh-gauge--pwa__wrapper[class*="lh-badged--"]');

        // Only expect a badge (and badged gauge) on last permutation (all bits are set).
        if (i !== totalPermutations - 1) {
          assert.strictEqual(badgedElems.length, 0);
          assert.strictEqual(badgedScoreGauge, null);
        } else {
          assert.strictEqual(badgedElems.length, 1);
          assert.ok(badgedScoreGauge.classList.contains(`lh-badged--${targetGroupId}`));
        }
      }
    });

    it('renders all badges when all audits are passing', () => {
      for (const auditRef of auditRefs) {
        auditRef.result.score = 1;
      }

      const categoryElem = pwaRenderer.render(category, sampleResults.categoryGroups);
      assert.strictEqual(categoryElem.querySelectorAll('.lh-badged').length, groupIds.length);
      assert.ok(categoryElem.querySelector('.lh-gauge--pwa__wrapper.lh-badged--all'));
    });

    it('renders no badges when no audit groups are passing', () => {
      for (const auditRef of auditRefs) {
        auditRef.result.score = 0;
      }

      const categoryElem = pwaRenderer.render(category, sampleResults.categoryGroups);
      assert.strictEqual(categoryElem.querySelectorAll('.lh-badged').length, 0);
      assert.strictEqual(categoryElem.querySelector('.lh-gauge--pwa__wrapper[class*="lh-badged-"]'),
        null);
    });

    it('renders all but one badge when all groups but one are passing', () => {
      for (const auditRef of auditRefs) {
        auditRef.result.score = 1;
      }
      auditRefs[0].result.score = 0;
      const failingGroupId = auditRefs[0].group;

      const categoryElem = pwaRenderer.render(category, sampleResults.categoryGroups);
      const gaugeElem = categoryElem.querySelector('.lh-gauge--pwa__wrapper');

      for (const groupId of groupIds) {
        const expectedCount = groupId === failingGroupId ? 0 : 1;

        const groupElems = categoryElem.querySelectorAll(`.lh-audit-group--${groupId}.lh-badged`);
        assert.strictEqual(groupElems.length, expectedCount);

        gaugeElem.classList.contains(`lh-badged--${groupId}`);
      }
    });
  });

  describe('#renderScoreGauge', () => {
    it('renders an error score gauge in case of category error', () => {
      category.score = null;
      const badgeGauge = pwaRenderer.renderScoreGauge(category);

      // Not a PWA gauge.
      assert.strictEqual(badgeGauge.querySelector('.lh-gauge--pwa__wrapper'), null);

      const percentageElem = badgeGauge.querySelector('.lh-gauge__percentage');
      assert.strictEqual(percentageElem.textContent, '?');
      assert.strictEqual(percentageElem.title, Util.UIStrings.errorLabel);
    });
  });
});
