import test from 'node:test';
import assert from 'node:assert/strict';
import {vestedTokens} from '../scripts/vesting.mjs';

test('vesting keeps 90% locked through the first 12 months', () => {
  assert.equal(vestedTokens(0), 375000);
  assert.equal(vestedTokens(11), 375000);
});

test('vesting releases equal monthly amounts and completes at month 36', () => {
  assert.equal(vestedTokens(12), 515625);
  assert.equal(vestedTokens(34), 3609375);
  assert.equal(vestedTokens(35), 3750000);
  assert.equal(vestedTokens(36), 3750000);
  assert.equal(vestedTokens(60), 3750000);
});
