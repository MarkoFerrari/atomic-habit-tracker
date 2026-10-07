<script lang="ts">
  // H29 Event detail (Figma 45:2380): from any event, or from a reminder push. Join appears when a meeting
  // link is found (in the place or the notes). Delete asks first: one occurrence, this and following, or
  // all (H31's choice), and for a habit with answers, H32: keep the history (the safe, primary choice)
  // or delete everything.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import Button from '../../ui/Button.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import { db } from '../../data/db';
  import { archiveHabit, deleteEvent, deleteHabitEverything, hasAnswers } from '../../data/events';
  import type { Calendar, CalendarEvent } from '../../data/schema';
  import { meetingLink, timeRange, type AgendaItem } from '../../domain/agenda';
  import { parseRRule } from '../../domain/recurrence';
  import { fullDate, repeatLabel, weekdayShort } from '../../domain/format';
  import { reminderLabel } from '../../domain/reminders';
  import { habitDayOf, type IsoDay } from '../../domain/day';
  import { wallOf } from '../../domain/zone';
  import type { Scope } from '../../domain/series';

  interface Props { item: AgendaItem; backLabel?: string; onback: () => void; onedit: (e: CalendarEvent) => void; onchanged: () => void }
  let { item, backLabel = 'Calendar', onback, onedit, onchanged }: Props = $props();

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let event = $state.raw<CalendarEvent | null>(null); // raw: it goes back to IndexedDB as is
  let cal = $state<Calendar | null>(null);
  let missing = $state(false);

  onMount(async () => {
    const database = await db();
    event = (await database.get('events', item.eventId)) ?? null;
    if (!event) { missing = true; return; }
    cal = (await database.get('calendars', event.calendarId)) ?? null;
  });

  const startDay = $derived(item.start.slice(0, 10) as IsoDay);
  const endDay = $derived(item.end.slice(0, 10) as IsoDay);
  const multiDay = $derived(!item.allDay ? endDay > startDay && item.end.slice(11) !== '00:00' : endDay > addOne(startDay));
  function addOne(d: IsoDay) { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10) as IsoDay; }
  const short = (d: string) => `${weekdayShort(d)} ${Number(d.slice(8, 10))} ${new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${d.slice(0, 10)}T12:00:00Z`))}`;
  const when = $derived.by(() => {
    if (item.allDay) {
      const last = (() => { const t = new Date(`${endDay}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); })();
      return last > startDay ? `${short(startDay)} – ${short(last)} · All day` : `${fullDate(startDay)} · All day`;
    }
    if (multiDay) return `${short(item.start)}, ${item.start.slice(11)} – ${short(item.end)}, ${item.end.slice(11)}`;
    return `${fullDate(startDay)} · ${timeRange(item, startDay)}`;
  });
  // E6: a meeting keeps its real time; when it was set in another zone, say what it is there.
  const origin = $derived.by(() => {
    if (!event || event.timeMode !== 'zoned' || !event.tz || event.tz === zone || item.allDay) return null;
    const there = wallOf(new Date(item.startAt), event.tz).slice(11, 16);
    return `${there} in ${event.tz.split('/').pop()!.replace(/_/g, ' ')}`;
  });
  const repeats = $derived(event?.rrule ? repeatLabel(parseRRule(event.rrule), item.occurrence, true) : null);
  const link = $derived(event ? meetingLink(event.place, event.notes) : null);
  const placeIsUrl = $derived(!!event?.place && /^https?:\/\//i.test(event.place));
  const placeText = $derived(placeIsUrl ? event!.place!.replace(/^https?:\/\//i, '').replace(/^(.{24}).+$/, '$1…') : event?.place ?? '');

  // --- delete --------------------------------------------------------------------------------------
  let askScope = $state(false);
  let askSingle = $state(false);
  let askHabit = $state(false);
  let busy = $state(false);
  let problem = $state('');
  const today = () => habitDayOf(new Date(), zone);

  function startDelete() {
    if (!event) return;
    if (event.rrule) askScope = true;
    else if (cal?.trackAsHabits) void maybeHabit();
    else askSingle = true;
  }
  async function maybeHabit() {
    if (event && (await hasAnswers(event.id))) askHabit = true;
    else askSingle = true;
  }
  async function remove(scope: Scope) {
    if (!event) return;
    askScope = false;
    if (scope === 'all' && cal?.trackAsHabits && (await hasAnswers(event.id))) { askHabit = true; return; }
    await run(() => deleteEvent(event!, item.occurrence, scope, zone));
  }
  async function run(action: () => Promise<void>) {
    busy = true; problem = '';
    try { await action(); askSingle = askHabit = askScope = false; onchanged(); }
    catch { problem = 'Couldn’t delete it. Try again.'; }
    finally { busy = false; }
  }
</script>

<main class="screen detail">
  <TopBar type="navigation" title="" leftLabel={backLabel} rightLabel={event ? 'Edit' : undefined} onleft={onback} onright={() => event && onedit(event)} />
  {#if missing}
    <h1 class="t-heading-large">Event not found</h1>
    <p class="t-body-small secondary">It may have been deleted or changed. Go back to the calendar.</p>
  {:else if event}
    <h1 class="t-heading-large title">{item.title}</h1>
    {#if cal}
      <p class="cal t-body-small" style:--cal="var(--calendar-{cal.color})"><span class="dot" aria-hidden="true"></span>{cal.name}</p>
    {/if}
    <dl class="rows">
      <div class="row"><dt class="t-body-small">When</dt><dd class="t-body-default">{when}{#if origin}<span class="t-body-small tertiary block">{origin}</span>{/if}</dd></div>
      {#if repeats}<div class="row"><dt class="t-body-small">Repeats</dt><dd class="t-body-default">{repeats}</dd></div>{/if}
      <div class="row"><dt class="t-body-small">Reminder</dt><dd class="t-body-default">{reminderLabel(event.reminders)}</dd></div>
      {#if event.place}
        <div class="row"><dt class="t-body-small">{placeIsUrl ? 'Link' : 'Place'}</dt>
          <dd class="t-body-default">{#if placeIsUrl}<a href={event.place} target="_blank" rel="noopener noreferrer">{placeText}</a>{:else}{placeText}{/if}</dd></div>
      {/if}
      {#if event.notes}<div class="row"><dt class="t-body-small">Notes</dt><dd class="t-body-default notes">{event.notes}</dd></div>{/if}
    </dl>
    {#if link}
      <Button icon="video" onclick={() => window.open(link!, '_blank', 'noopener,noreferrer')}>Join</Button>
    {/if}
    <div class="spacer"></div>
    {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
    <Button variant="tertiary" onclick={startDelete} disabled={busy}>Delete event</Button>
  {/if}
</main>

<Sheet open={askScope} title="Delete a repeating event" onclose={() => (askScope = false)}>
  <div class="sheet">
    <p class="t-body-small secondary">“{item.title}” repeats. Past answers keep their original time and title.</p>
    <Button variant="secondary" onclick={() => remove('this')}>Only this event</Button>
    <Button variant="secondary" onclick={() => remove('following')}>This and following</Button>
    <Button variant="secondary" onclick={() => remove('all')}>All events</Button>
    <Button variant="tertiary" onclick={() => (askScope = false)}>Cancel</Button>
  </div>
</Sheet>

<Sheet open={askSingle} title="Delete “{item.title}”?" onclose={() => (askSingle = false)}>
  <div class="sheet">
    <p class="t-body-small secondary">This can’t be undone. Anything after your last backup is gone for good.</p>
    <Button variant="secondary" disabled={busy} onclick={() => run(() => deleteEvent(event!, item.occurrence, 'all', zone))}>Delete event</Button>
    <Button variant="tertiary" onclick={() => (askSingle = false)}>Cancel</Button>
  </div>
</Sheet>

<Sheet open={askHabit} title="Delete “{item.title}”?" onclose={() => (askHabit = false)}>
  <div class="sheet">
    <p class="t-body-small secondary">Answers are linked to this habit. Keeping the history archives it: Stats keep it, future events go. Deleting everything cannot be undone.</p>
    <Button disabled={busy} onclick={() => run(() => archiveHabit(event!, today()))}>Keep history, delete future events</Button>
    <Button variant="secondary" disabled={busy} onclick={() => run(() => deleteHabitEverything(event!))}>Delete everything</Button>
    <Button variant="tertiary" onclick={() => (askHabit = false)}>Cancel</Button>
  </div>
</Sheet>

<style>
  .detail { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .title { overflow-wrap: anywhere; } /* E21: the full name in detail screens */
  .cal { display: flex; align-items: center; gap: var(--space-8); color: var(--text-secondary); }
  .dot { width: var(--space-8); height: var(--space-8); border-radius: var(--radius-round); background: var(--cal); }
  .rows { margin: 0; }
  .row { display: flex; gap: var(--space-16); padding: var(--space-12) 0; border-bottom: var(--stroke-hairline) solid var(--border-divider); }
  .row:last-child { border-bottom: 0; }
  dt { flex: none; width: calc(var(--space-64) + var(--space-24)); color: var(--text-tertiary); }
  dd { flex: 1; min-width: 0; margin: 0; overflow-wrap: anywhere; }
  .notes { white-space: pre-line; }
  a { color: var(--text-accent); }
  .spacer { flex: 1; }
  .secondary { color: var(--text-secondary); }
  .tertiary { color: var(--text-tertiary); }
  .block { display: block; }
  .problem { color: var(--text-accent); }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); } /* the sheet already pads 8 on top and the gutter at the sides (Figma 46:2315) */
</style>
