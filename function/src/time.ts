// Local clock in a stored time zone, computed from UTC (E5: daylight saving is handled by the zone rules).

export interface LocalClock { day: string; minutes: number } // day 'YYYY-MM-DD', minutes since local midnight

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function localClock(at: Date, zone: string): LocalClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const DAY_CLOSES_AT = 4 * 60; // R1: the habit day closes at 04:00 local
const RECAP_AT = 22 * 60 + 30; // 039: recap push at 22:30 local

/** The habit day a moment belongs to: before 04:00 it is still yesterday (R1). */
export function habitDay(at: Date, zone: string): string {
  return localClock(new Date(at.getTime() - DAY_CLOSES_AT * 60_000), zone).day;
}

/**
 * True from 22:30 until the day closes at 04:00 (039, R1). A window rather than one exact minute,
 * so a late or skipped timer run still sends the recap; `lastRecapDay` keeps it to once per day.
 */
export function inRecapWindow(at: Date, zone: string): boolean {
  const { minutes } = localClock(at, zone);
  return minutes >= RECAP_AT || minutes < DAY_CLOSES_AT;
}
