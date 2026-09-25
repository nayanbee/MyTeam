// Each class has its own two-person invitation race. The caller must persist
// transitions atomically when a shared backend is connected.
export const classWinner = (records, shiftId, classTime) => records.find(r =>
  r.shiftId === shiftId && r.status === 'APPROVED' && r.coverage.includes(classTime));
export const activeInvitations = (records, shiftId, classTime) => records.filter(r =>
  r.shiftId === shiftId && r.source === 'REQUESTED' && r.status === 'REQUESTED' && r.coverage.includes(classTime));

export function sendInvitations(records, shiftId, names, coverageByName, classes) {
  const next = [...records];
  for (const name of [...new Set(names)]) {
    for (const classTime of (coverageByName[name] || []).filter(t => classes.includes(t))) {
      if (classWinner(next, shiftId, classTime) || activeInvitations(next, shiftId, classTime).length >= 2) continue;
      if (next.some(r => r.shiftId === shiftId && r.instructor === name && r.coverage.includes(classTime))) continue;
      next.push({ id: `req-${shiftId}-${name}-${classTime}-${Date.now()}`, shiftId, instructor: name,
        coverage: [classTime], status: 'REQUESTED', createdAt: 'Now', source: 'REQUESTED' });
    }
  }
  return next;
}

export function answerInvitation(records, shiftId, instructor, accept, classTime) {
  const active = records.find(r => r.shiftId === shiftId && r.instructor === instructor &&
    r.source === 'REQUESTED' && r.status === 'REQUESTED' && (!classTime || r.coverage.includes(classTime)));
  if (!active) return { records, outcome: 'NO_CHANGE', others: [], classTime: undefined };
  const time = active.coverage[0];
  if (classWinner(records, shiftId, time)) return { records, outcome: 'NO_CHANGE', others: [], classTime: time };
  if (!accept) return { records: records.map(r => r.id === active.id ? { ...r, status: 'DECLINED' } : r), outcome: 'DECLINED', others: [], classTime: time };
  const others = activeInvitations(records, shiftId, time).filter(r => r.id !== active.id);
  const closed = new Set(others.map(r => r.id));
  return {
    records: records.map(r => r.id === active.id ? { ...r, status: 'APPROVED', syncStatus: 'MARIANA_PENDING' }
      : closed.has(r.id) ? { ...r, status: 'NOT SELECTED' }
      : r.shiftId === shiftId && r.source !== 'REQUESTED' && r.status === 'PENDING' && r.coverage.includes(time)
        ? { ...r, coverage: r.coverage.filter(t => t !== time), status: r.coverage.length === 1 ? 'NOT SELECTED' : 'PENDING' }
        : r),
    outcome: 'WON', others: others.map(r => r.instructor), classTime: time
  };
}

export function approveApplications(records, shiftId, assignments) {
  const times = Object.keys(assignments).filter(t => assignments[t]);
  if (!times.length || times.some(t => classWinner(records, shiftId, t))) return { records, outcome: 'NO_CHANGE' };
  if (times.some(t => !records.some(r => r.shiftId === shiftId && r.source !== 'REQUESTED' &&
    r.status === 'PENDING' && r.instructor === assignments[t] && r.coverage.includes(t)))) return { records, outcome: 'NO_CHANGE' };
  const affected = new Set(times);
  const next = records.map(r => {
    if (r.shiftId !== shiftId || !['PENDING','REQUESTED'].includes(r.status)) return r;
    if (r.source === 'REQUESTED') return r.coverage.some(t => affected.has(t)) ? { ...r, status: 'NOT SELECTED' } : r;
    const remaining = r.coverage.filter(t => !affected.has(t));
    return { ...r, coverage: remaining, status: remaining.length ? 'PENDING' : 'NOT SELECTED' };
  });
  for (const time of times) next.push({ id: `approved-${shiftId}-${time}-${Date.now()}`, shiftId,
    instructor: assignments[time], coverage: [time], source: 'APPLIED', status: 'APPROVED', syncStatus: 'MARIANA_PENDING', createdAt: 'Now' });
  return { records: next, outcome: 'APPROVED' };
}

export function withdrawApplication(records, shiftId, instructor) {
  const selected = records.filter(r => r.shiftId === shiftId && r.instructor === instructor && ['PENDING','APPROVED'].includes(r.status));
  if (!selected.length) return { records, outcome: 'NO_CHANGE', reopened: [] };
  const reopened = selected.filter(r => r.status === 'APPROVED').flatMap(r => r.coverage);
  return { records: records.map(r => selected.some(x => x.id === r.id) ? { ...r, status: 'WITHDRAWN' } : r), outcome: 'WITHDRAWN', reopened };
}
