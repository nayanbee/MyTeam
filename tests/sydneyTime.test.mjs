import test from 'node:test';
import assert from 'node:assert/strict';
import {sydneyTimeToIso} from '../src/sydneyTime.mjs';

test('Sydney class time uses standard time before daylight saving',()=>{
  assert.equal(sydneyTimeToIso('2026-09-25','07:00'),'2026-09-24T21:00:00.000Z');
});
test('Sydney class time uses daylight saving in October',()=>{
  assert.equal(sydneyTimeToIso('2026-10-06','07:00'),'2026-10-05T20:00:00.000Z');
});
