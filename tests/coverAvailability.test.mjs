import test from 'node:test';
import assert from 'node:assert/strict';
import { findConflict } from '../src/coverAvailability.mjs';
const roster = [{ name: 'Kate', day: 'TUE', studio: 'Other Brand', start: '11:00 AM', brand: 'Competitor' }];
test('blocks overlapping shifts at another brand', () => assert.ok(findConflict(roster, 'Kate', 'TUE', 'Martin Place', '11:00 AM')));
test('blocks cross-studio travel shorter than 30 minutes', () => {
  assert.ok(findConflict(roster, 'Kate', 'TUE', 'Martin Place', '12:00 PM'));
  assert.equal(findConflict(roster, 'Kate', 'TUE', 'Martin Place', '12:30 PM'), undefined);
});
test('permits adjacent classes at the same studio', () => assert.equal(findConflict([{ ...roster[0], studio: 'Martin Place' }], 'Kate', 'TUE', 'Martin Place', '12:00 PM'), undefined));
test('does not block a different day or person', () => {
  assert.equal(findConflict(roster, 'Kate', 'WED', 'Martin Place', '11:00 AM'), undefined);
  assert.equal(findConflict(roster, 'Emily', 'TUE', 'Martin Place', '11:00 AM'), undefined);
});
