// Keep the source assignment visible until management checks Mariana Tek.
export function cancelOwnCover(own, applications) {
  const shiftId = `own-${own.sessionId}`;
  const affected = applications.filter(a => a.shiftId === shiftId &&
    ['PENDING', 'REQUESTED', 'APPROVED'].includes(a.status));
  const confirmed = affected.filter(a => a.status === 'APPROVED');
  const covering = own.covering || confirmed[0]?.instructor;
  const hasReplacement = own.status === 'FILLED' || confirmed.length > 0;
  const recipients = [...new Set([covering, ...confirmed.map(a => a.instructor),
    ...affected.map(a => a.instructor)].filter(Boolean))];
  return {
    own: { ...own, status: 'WITHDRAWN', covering,
      syncStatus: hasReplacement ? 'MARIANA_MISMATCH' : own.syncStatus },
    applications: applications.map(a => affected.some(x => x.id === a.id) ?
      { ...a, status: 'WITHDRAWN' } : a),
    recipients,
    hasReplacement,
    confirmedRecipients: [...new Set([covering, ...confirmed.map(a => a.instructor)].filter(Boolean))]
  };
}
