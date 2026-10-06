// R1: a habit day closes at 04:00 local time, not at midnight.
// Between 00:00 and 03:59 the phone still belongs to "yesterday".
export const DAY_CLOSE_HOUR = 4;

export type IsoDay = `${number}-${number}-${number}`;

interface LocalParts { year: number; month: number; day: number; hour: number }

export function localParts(instant: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  });
  const get = (type: string) => Number(fmt.formatToParts(instant).find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The habit day an instant belongs to, in the given IANA time zone (R1, E5, E6). */
export function habitDayOf(instant: Date, timeZone: string, closeHour = DAY_CLOSE_HOUR): IsoDay {
  const p = localParts(instant, timeZone);
  // Calendar arithmetic in UTC so daylight-saving shifts can't move the date.
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  if (p.hour < closeHour) date.setUTCDate(date.getUTCDate() - 1);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` as IsoDay;
}
