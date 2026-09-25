import test from 'node:test';
import assert from 'node:assert/strict';
import {cancelOwnCover} from '../src/ownCoverWithdrawal.mjs';

test('accepted invitation cancellation alerts the cover and retains source reconciliation', () => {
  const records = [{id:'invite',shiftId:'own-12',instructor:'George',status:'APPROVED'},
    {id:'other',shiftId:'own-12',instructor:'Kate',status:'NOT SELECTED'}];
  const result = cancelOwnCover({sessionId:12,status:'OPEN'}, records);
  assert.deepEqual(result.confirmedRecipients,['George']);
  assert.equal(result.own.covering,'George');
  assert.equal(result.own.syncStatus,'MARIANA_MISMATCH');
  assert.equal(result.applications[0].status,'WITHDRAWN');
  assert.equal(result.applications[1].status,'NOT SELECTED');
});

test('manager selected cover is notified even without an invitation record', () => {
  const result = cancelOwnCover({sessionId:12,status:'FILLED',covering:'Steph'}, []);
  assert.deepEqual(result.recipients,['Steph']);
  assert.equal(result.own.syncStatus,'MARIANA_MISMATCH');
});

test('unaccepted invitations close without inventing a confirmed replacement', () => {
  const result = cancelOwnCover({sessionId:12,status:'OPEN'},
    [{id:'invite',shiftId:'own-12',instructor:'Kate',status:'REQUESTED'}]);
  assert.equal(result.hasReplacement,false);
  assert.deepEqual(result.confirmedRecipients,[]);
  assert.deepEqual(result.recipients,['Kate']);
  assert.equal(result.applications[0].status,'WITHDRAWN');
});
