// One cover request is one offer. Bundle invitations must cover every class.
export function sendInvitations(records, shiftId, names, coverageByName, classes) {
  const forShift = records.filter(r => r.shiftId === shiftId);
  if (forShift.some(r => r.status === 'APPROVED')) return records;
  const active = forShift.filter(r => r.source === 'REQUESTED' && r.status === 'REQUESTED').length;
  const remaining = Math.max(0, 2 - active);
  const newNames = [...new Set(names)].filter(name =>
    !forShift.some(r => r.instructor === name) &&
    classes.every(t => (coverageByName[name] || []).includes(t))
  ).slice(0, remaining);
  return [...records, ...newNames.map((name, i) => ({
    id: `req-${shiftId}-${name}-${Date.now()}-${i}`, shiftId, instructor: name,
    coverage: [...classes], status: 'REQUESTED', createdAt: 'Now', source: 'REQUESTED'
  }))];
}

export function answerInvitation(records, shiftId, instructor, accept) {
  const active = records.find(r => r.shiftId === shiftId && r.instructor === instructor && r.source === 'REQUESTED' && r.status === 'REQUESTED');
  if (!active || records.some(r => r.shiftId === shiftId && r.status === 'APPROVED')) return { records, outcome: 'NO_CHANGE', others: [] };
  if (!accept) return { records: records.map(r => r.id === active.id ? { ...r, status: 'DECLINED' } : r), outcome: 'DECLINED', others: [] };
  const others = records.filter(r => r.shiftId === shiftId && r.source === 'REQUESTED' && r.status === 'REQUESTED' && r.id !== active.id);
  return {
    records: records.map(r => r.id === active.id ? { ...r, status: 'APPROVED', syncStatus: 'MARIANA_PENDING' } : others.some(o => o.id === r.id) ? { ...r, status: 'NOT SELECTED' } : r),
    outcome: 'WON', others: others.map(r => r.instructor)
  };
}

export function approveApplications(records, shiftId, assignments) {
  const forShift = records.filter(r => r.shiftId === shiftId);
  if (forShift.some(r => r.status === 'APPROVED')) return { records, outcome: 'NO_CHANGE' };
  const names = new Set(Object.values(assignments));
  const selected = forShift.filter(r => r.source !== 'REQUESTED' && r.status === 'PENDING' && names.has(r.instructor));
  if (selected.length !== names.size || !names.size) return { records, outcome: 'NO_CHANGE' };
  return { records: records.map(r => r.shiftId !== shiftId || (r.status !== 'PENDING' && r.status !== 'REQUESTED') ? r : { ...r, status: names.has(r.instructor) ? 'APPROVED' : 'NOT SELECTED', ...(names.has(r.instructor) ? { syncStatus: 'MARIANA_PENDING' } : {}) }), outcome: 'APPROVED' };
}
