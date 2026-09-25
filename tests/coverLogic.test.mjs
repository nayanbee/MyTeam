import test from 'node:test';
import assert from 'node:assert/strict';
import { sendInvitations, answerInvitation, approveApplications } from '../src/coverLogic.mjs';
const classes = ['8:00 AM', '9:00 AM'];
const coverage = { Kate: classes, Emily: classes, Steph: classes, Charlie: ['8:00 AM'] };
test('only two full-bundle invitations can be active', () => {
  let r = sendInvitations([], 'a', ['Kate', 'Emily', 'Steph', 'Charlie'], coverage, classes);
  assert.deepEqual(r.map(x => x.instructor), ['Kate', 'Emily']);
  assert.equal(sendInvitations(r, 'a', ['Steph'], coverage, classes).length, 2);
});
test('decline frees one slot and keeps history', () => {
  let r = sendInvitations([], 'a', ['Kate', 'Emily'], coverage, classes);
  r = answerInvitation(r, 'a', 'Kate', false).records;
  r = sendInvitations(r, 'a', ['Steph', 'Charlie'], coverage, classes);
  assert.deepEqual(r.map(x => x.status), ['DECLINED', 'REQUESTED', 'REQUESTED']);
});
test('first acceptance wins and closes the other invitation', () => {
  let r = sendInvitations([], 'a', ['Kate', 'Emily'], coverage, classes);
  const first = answerInvitation(r, 'a', 'Emily', true);
  assert.equal(first.outcome, 'WON'); assert.deepEqual(first.others, ['Kate']);
  assert.deepEqual(first.records.map(x => x.status), ['NOT SELECTED', 'APPROVED']);
  assert.equal(answerInvitation(first.records, 'a', 'Kate', true).outcome, 'NO_CHANGE');
  assert.equal(sendInvitations(first.records, 'a', ['Steph'], coverage, classes).length, 2);
});
test('an applicant approval closes invitations but cannot override an existing winner', () => {
  let r = sendInvitations([{ id: 'app', shiftId: 'a', instructor: 'Steph', coverage: classes, status: 'PENDING' }], 'a', ['Kate'], coverage, classes);
  const decided = approveApplications(r, 'a', { '8:00 AM': 'Steph', '9:00 AM': 'Steph' });
  assert.deepEqual(decided.records.map(x => x.status), ['APPROVED', 'NOT SELECTED']);
  assert.equal(answerInvitation(decided.records, 'a', 'Kate', true).outcome, 'NO_CHANGE');
  r = answerInvitation(r, 'a', 'Kate', true).records;
  assert.equal(approveApplications(r, 'a', { '8:00 AM': 'Steph', '9:00 AM': 'Steph' }).outcome, 'NO_CHANGE');
});
