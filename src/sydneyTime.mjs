// Convert a wall-clock time entered for Sydney into its UTC instant.
export function sydneyTimeToIso(day, clock) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(clock)) throw new Error('Invalid class time');
  const localAsUtc = Date.parse(`${day}T${clock}:00Z`);
  const offsetAt = time => {
    const zone = new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',timeZoneName:'shortOffset'}).formatToParts(time).find(p=>p.type==='timeZoneName')?.value || '';
    const match = zone.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) throw new Error('Sydney time zone unavailable');
    return (match[1]==='+'?1:-1)*(Number(match[2])*60+Number(match[3]||0));
  };
  let instant = localAsUtc - offsetAt(localAsUtc)*60000;
  instant = localAsUtc - offsetAt(instant)*60000;
  return new Date(instant).toISOString();
}
