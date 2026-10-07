// Wall-clock time ⇄ instants in an IANA time zone, using the platform's zone rules (E5, E6, 028).
// A "wall" time is 'YYYY-MM-DDTHH:mm' with no zone: what a clock on the wall shows.
export type Wall = `${number}-${number}-${number}T${number}:${number}`;

const pad = (n: number) => String(n).padStart(2, '0');

export function wallOf(instant: Date, timeZone: string): Wall {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` as Wall;
}

const wallAsUtc = (w: string) => Date.parse(`${w}:00Z`);

/**
 * The instant a wall time happens in a zone. In the spring-forward gap the time doesn't exist, so it
 * lands just after the jump; in the autumn overlap the first (summer) occurrence wins.
 */
export function instantOf(wall: Wall, timeZone: string): Date {
  const target = wallAsUtc(wall);
  let guess = target;
  for (let i = 0; i < 3; i += 1) {
    const offset = wallAsUtc(wallOf(new Date(guess), timeZone)) - guess;
    const next = target - offset;
    if (next === guess) break;
    guess = next;
  }
  // Prefer the earlier instant when the wall time happens twice.
  const hourEarlier = guess - 3600_000;
  if (wallOf(new Date(hourEarlier), timeZone) === wall) return new Date(hourEarlier);
  return new Date(guess);
}

/** Adds minutes to a wall time as clock arithmetic (no zone): 23:30 + 45 min = 00:15 the next day. */
export function addMinutes(wall: Wall, minutes: number): Wall {
  const t = new Date(wallAsUtc(wall) + minutes * 60_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` as Wall;
}

export function isValidZone(timeZone: string): boolean {
  try { new Intl.DateTimeFormat('en-GB', { timeZone }); return true; } catch { return false; }
}
