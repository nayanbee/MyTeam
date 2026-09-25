export const minutes = time => { const m = time.match(/(\d+)(?::(\d+))? (AM|PM)/); return m ? (Number(m[1]) % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2] || 0) : 0 };
export const classEnds = time => minutes(time) + 50;
export function findConflict(roster, name, day, studio, time) {
  return roster.find(s => s.name === name && s.day === day && (
    (minutes(time) < classEnds(s.start) && minutes(s.start) < classEnds(time)) ||
    (s.studio !== studio && (minutes(time) >= classEnds(s.start)
      ? minutes(time) - classEnds(s.start) < 30
      : minutes(s.start) - classEnds(time) < 30))
  ));
}
