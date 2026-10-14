// 118: routines from After (Playground 09, owner approved 14 Oct 2026). Habits that point to each other with the
// After cue (085) on the same day are one routine: Today shows them together, one nudge goes out at the routine's
// start, and each done hands Mark as done to the next one, whatever its clock time. Runs, rates and ranks stay per
// habit. Nothing new is stored: routines are read from After every time. Pure rules.
import { shortName } from './format';

export interface RoutineMember { id: string; title: string; after?: string; start: string; allDay: boolean }

export interface Routine<M extends RoutineMember = RoutineMember> {
  name: string; // "Morning routine"
  members: M[]; // in the order they follow each other
}

const norm = (s: string) => shortName(s).trim().toLowerCase();

/** Does an After cue name this habit? "Breakfast" names "Breakfast 30 min" (004), case doesn't matter. */
export function followsTitle(after: string | undefined, title: string): boolean {
  if (!after?.trim()) return false;
  return norm(after) === norm(title) || after.trim().toLowerCase() === title.trim().toLowerCase();
}

/** Named by when it starts: morning 04–12, afternoon 12–18, evening after that (the habit day closes at 04:00, R1). */
export function routineName(first: RoutineMember): string {
  if (first.allDay) return 'Routine';
  const h = Number(first.start.slice(11, 13));
  return h >= 4 && h < 12 ? 'Morning routine' : h >= 12 && h < 18 ? 'Afternoon routine' : 'Evening routine';
}

/**
 * The routines among a set of habits (one day's occurrences, or every habit for the list). A habit follows the
 * one its After names, when exactly one in the set has that name; two or more habits linked this way make a
 * routine. Habits following the same one are taken by start time. Habits not in a routine are left out.
 */
export function routinesOf<M extends RoutineMember>(items: readonly M[]): Routine<M>[] {
  const parent = new Map<string, string>();
  for (const m of items) {
    const cands = items.filter((x) => x.id !== m.id && followsTitle(m.after, x.title));
    if (cands.length === 1) parent.set(m.id, cands[0]!.id);
  }
  // break cycles: walk up from each; a habit that leads back to itself loses its link
  for (const m of items) {
    const seen = new Set<string>([m.id]);
    let cur = parent.get(m.id);
    while (cur) { if (seen.has(cur)) { parent.delete(m.id); break; } seen.add(cur); cur = parent.get(cur); }
  }
  const byStart = (a: M, b: M) => Number(b.allDay) - Number(a.allDay) || a.start.slice(11).localeCompare(b.start.slice(11)) || a.title.localeCompare(b.title);
  const children = (id: string) => items.filter((x) => parent.get(x.id) === id).sort(byStart);
  const out: Routine<M>[] = [];
  for (const root of items.filter((m) => !parent.has(m.id)).sort(byStart)) {
    const members: M[] = [];
    const visit = (m: M) => { members.push(m); for (const c of children(m.id)) visit(c); };
    visit(root);
    if (members.length >= 2) out.push({ name: routineName(root), members });
  }
  return out;
}
