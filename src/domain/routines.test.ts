// 118: routines from After. Sample data only (045).
import { describe, expect, it } from 'vitest';
import { followsTitle, routinesOf } from './routines';
import { todayView, type HabitSource } from './today';
import { planReminders } from './reminders';

const h = (id: string, title: string, start: string, after?: string): HabitSource =>
  ({ id, title, start: `2026-10-01T${start}`, end: `2026-10-01T${start.slice(0, 2)}:59`, allDay: false, rrule: 'FREQ=DAILY', exdates: [], ...(after ? { after } : {}) });
const stretch = h('s', 'Sample stretch 10 min', '07:00');
const read = h('r', 'Sample read 20 min', '07:30', 'Sample stretch');
const breakfast = h('b', 'Sample breakfast 30 min', '08:00', 'sample read 20 min');
const walk = h('w', 'Sample walk 20 min', '17:30');
const ZONE = 'Europe/Athens';

describe('routines (118)', () => {
  it('matches After to a habit by its short name, any case', () => {
    expect(followsTitle('Breakfast', 'Breakfast 30 min')).toBe(true);
    expect(followsTitle('breakfast 30 min', 'Breakfast 30 min')).toBe(true);
    expect(followsTitle('Lunch', 'Breakfast 30 min')).toBe(false);
  });

  it('chains habits in the order they follow each other, and names the routine by its start', () => {
    const [g, ...rest] = routinesOf([walk, breakfast, read, stretch]);
    expect(rest).toEqual([]);
    expect(g!.name).toBe('Morning routine');
    expect(g!.members.map((m) => m.id)).toEqual(['s', 'r', 'b']);
  });

  it('ignores a loop and an After that names nobody', () => {
    const a = h('a', 'Sample A', '09:00', 'Sample B');
    const b = h('b2', 'Sample B', '10:00', 'Sample A');
    expect(routinesOf([a, b, h('c', 'Sample C', '11:00', 'Nobody')])).toHaveLength(1);
  });

  it('hands Mark as done to the next habit once one is done, whatever the clock says', () => {
    const answers = [{ eventId: 's', occurrence: '2026-10-14', status: 'done' as const, answeredAt: '2026-10-14T04:05:00Z' }];
    const view = todayView([stretch, read, breakfast, walk], answers, '2026-10-14', new Date('2026-10-14T04:06:00Z'), ZONE); // 07:06 local
    expect(view.routines[0]!.rows.map((r) => r.eventId)).toEqual(['s', 'r', 'b']);
    expect(view.open.find((r) => r.markDone)?.eventId).toBe('r');
  });

  it('sends one nudge per routine, on its first habit not yet answered', () => {
    const events = [stretch, read, breakfast, walk].map((x) => ({ ...x, calendarId: 'hab', timeMode: 'clock' as const, reminders: [0] }));
    const plan = planReminders(events, new Set(['hab']), new Set(), '2026-10-14', new Date('2026-10-14T00:00:00Z'), ZONE, 1);
    expect(plan.map((p) => `${p.title} | ${p.body}`)).toEqual(['Morning routine | Sample stretch first · 07:00', 'Sample walk 20 min | 17:30 · 29 min']);
    const later = planReminders(events, new Set(['hab']), new Set(['s|2026-10-14']), '2026-10-14', new Date('2026-10-14T00:00:00Z'), ZONE, 1);
    expect(later[0]!.body).toBe('Sample read next · 07:30');
  });
});
