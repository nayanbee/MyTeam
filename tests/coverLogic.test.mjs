import test from 'node:test';
import assert from 'node:assert/strict';
import { sendInvitations, answerInvitation, approveApplications, withdrawApplication, classWinner, activeInvitations } from '../src/coverLogic.mjs';
const classes = ['8:00 AM','9:00 AM','10:00 AM'];
const coverage = { Kate: classes.slice(0,2), Emily: classes.slice(1), Steph: classes, Charlie: [classes[0]] };
test('two invitations per class, including split coverage', () => {
  const r = sendInvitations([], 'a', ['Kate','Emily','Steph','Charlie'], coverage, classes);
  assert.deepEqual(classes.map(t => activeInvitations(r,'a',t).length), [2,2,2]);
  assert.deepEqual(activeInvitations(r,'a',classes[0]).map(x=>x.instructor), ['Kate','Steph']);
});
test('decline frees only its class slot', () => {
  let r = sendInvitations([], 'a', ['Kate','Emily'], coverage, classes);
  r = answerInvitation(r,'a','Kate',false,classes[0]).records;
  r = sendInvitations(r,'a',['Charlie'],coverage,classes);
  assert.deepEqual(activeInvitations(r,'a',classes[0]).map(x=>x.instructor),['Charlie']);
  assert.equal(activeInvitations(r,'a',classes[1]).length,2);
});
test('first acceptance wins its class and leaves other classes open', () => {
  let r = sendInvitations([], 'a', ['Kate','Emily','Steph'], coverage, classes);
  const first = answerInvitation(r,'a','Emily',true,classes[1]);
  assert.equal(first.outcome,'WON'); assert.deepEqual(first.others,['Kate']);
  assert.equal(classWinner(first.records,'a',classes[1]).instructor,'Emily');
  assert.equal(classWinner(first.records,'a',classes[0]),undefined);
  assert.equal(answerInvitation(first.records,'a','Kate',true,classes[1]).outcome,'NO_CHANGE');
});
test('manager can split application approval without filling unassigned class', () => {
  let r = [{id:'s',shiftId:'a',instructor:'Steph',coverage:classes,status:'PENDING',source:'APPLIED'},
    {id:'k',shiftId:'a',instructor:'Kate',coverage:classes.slice(0,2),status:'PENDING',source:'APPLIED'}];
  const decided = approveApplications(r,'a',{[classes[0]]:'Kate',[classes[1]]:'Steph'});
  assert.equal(decided.outcome,'APPROVED');
  assert.deepEqual(classes.map(t=>classWinner(decided.records,'a',t)?.instructor),['Kate','Steph',undefined]);
  assert.equal(decided.records.find(x=>x.id==='s').status,'PENDING');
  assert.deepEqual(decided.records.find(x=>x.id==='s').coverage,[classes[2]]);
  assert.equal(approveApplications(decided.records,'a',{[classes[0]]:'Steph'}).outcome,'NO_CHANGE');
});
test('withdrawal reopens only covered classes', () => {
  const r=approveApplications([{id:'s',shiftId:'a',instructor:'Steph',coverage:classes,status:'PENDING',source:'APPLIED'}],'a',{[classes[0]]:'Steph'}).records;
  const withdrawn=withdrawApplication(r,'a','Steph');
  assert.deepEqual(withdrawn.reopened,[classes[0]]);
  assert.equal(classWinner(withdrawn.records,'a',classes[0]),undefined);
});
