<script lang="ts">
  // H30 New event / Edit event (Figma 46:2105), H31 the repeating-event choice (46:2207).
  // The title is an action with an end point (004): "Diorama - 45 min" ends 45 minutes after it starts.
  // A new event's reminder follows its calendar (R5); habits get a push at their start (069).
  // Starts and Ends open the iPhone's own wheels; Calendar, Repeat, Reminder, Place and Notes open sheets.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import TextField from '../../ui/TextField.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import PickerRow from '../../ui/PickerRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Button from '../../ui/Button.svelte';
  import Chip from '../../ui/Chip.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { calendars as loadCalendars, createEvent, defaultReminders, draftOf, durationFromTitle, newDraft, saveEdit, type EventDraft } from '../../data/events';
  import type { Calendar, CalendarEvent } from '../../data/schema';
  import type { AgendaItem } from '../../domain/agenda';
  import { addDays, habitDayOf, type IsoDay } from '../../domain/day';
  import { addMinutes, type Wall } from '../../domain/zone';
  import { parseRRule } from '../../domain/recurrence';
  import { repeatLabel, weekdayShort } from '../../domain/format';
  import { beforeLabel, reminderLabel } from '../../domain/reminders';
  import { MAX_EVERY, ruleFromRepeat, type RepeatKind, type Scope } from '../../domain/series';
  import { syncReminders } from '../../push/reminders';

  type Mode = { kind: 'new'; day: IsoDay; habit?: boolean } | { kind: 'edit'; event: CalendarEvent; item: AgendaItem } | { kind: 'duplicate'; event: CalendarEvent; item: AgendaItem };
  interface Props { mode: Mode; oncancel: () => void; onsaved: (day: IsoDay) => void }
  let { mode, oncancel, onsaved }: Props = $props();

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let cals = $state<Calendar[]>([]);
  let draft = $state<EventDraft | null>(null);
  let original = null as EventDraft | null;
  let endTouched = false;

  onMount(async () => {
    cals = await loadCalendars();
    draft = mode.kind === 'new' ? newDraft(mode.day, cals, new Date(), zone) : draftOf(mode.event, mode.item);
    if (mode.kind === 'new' && mode.habit) draft.repeat = { ...draft.repeat, kind: 'daily', until: null }; // 079: a habit repeats every day
    original = $state.snapshot(draft) as EventDraft;
    endTouched = mode.kind !== 'new';
  });

  const cal = $derived(cals.find((c) => c.id === draft?.calendarId));
  const minutesBetween = (a: string, b: string) => Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60_000);
  const shortDate = (d: string) => `${weekdayShort(d)} ${Number(d.slice(8, 10))} ${new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${d.slice(0, 10)}T12:00:00Z`))}`;

  // --- labels ---------------------------------------------------------------------------------------
  const startLabel = $derived(!draft ? '' : draft.allDay ? shortDate(draft.start) : `${shortDate(draft.start)}, ${draft.start.slice(11)}`);
  const lastDay = $derived(draft ? addDays(draft.end.slice(0, 10) as IsoDay, -1) : ('' as IsoDay));
  const endLabel = $derived.by(() => {
    if (!draft) return '';
    if (draft.allDay) return lastDay <= draft.start.slice(0, 10) ? 'Same day' : shortDate(lastDay);
    const m = minutesBetween(draft.start, draft.end);
    if (draft.end.slice(0, 10) === draft.start.slice(0, 10) || (m > 0 && m < 1440)) return m === 0 ? 'When it starts' : `${beforeLabel(m)} later`;
    return `${shortDate(draft.end)}, ${draft.end.slice(11)}`;
  });
  const KIND_LABEL: Record<RepeatKind, string> = {
    none: 'Never', daily: 'Every day', weekdays: 'Weekdays', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month', yearly: 'Every year', days: 'Custom', custom: 'Custom',
  };
  const repeatText = $derived.by(() => {
    if (!draft) return '';
    const r = draft.repeat;
    let text = KIND_LABEL[r.kind];
    if (r.kind === 'weekly' || r.kind === 'biweekly' || r.kind === 'days' || r.kind === 'custom') {
      const rule = ruleFromRepeat(r);
      const read = rule ? parseRRule(rule) : null;
      if (read) text = repeatLabel(read, draft.start.slice(0, 10) as IsoDay, true);
    }
    return r.until && r.kind !== 'none' ? `${text} · until ${shortDate(r.until)}` : text;
  });
  const reminderText = $derived(!draft ? '' : `${reminderLabel(draft.reminders)}${cal && same(draft.reminders, defaultReminders(cal)) ? ` (${cal.name} default)` : ''}`);
  function same(a: number[], b: number[]) { return [...new Set(a)].sort().join() === [...new Set(b)].sort().join(); }

  // --- edits ----------------------------------------------------------------------------------------
  function setTitle(v: string) {
    if (!draft) return;
    const minutes = durationFromTitle(v);
    if (!endTouched && minutes && !draft.allDay) draft.end = addMinutes(draft.start, minutes); // 004
  }
  function setStart(v: string) {
    if (!draft || !v) return;
    if (draft.allDay) {
      const days = Math.max(1, Math.round(minutesBetween(draft.start, draft.end) / 1440));
      draft.start = `${v}T00:00` as Wall;
      draft.end = `${addDays(v as IsoDay, days)}T00:00` as Wall;
    } else {
      const length = minutesBetween(draft.start, draft.end);
      draft.start = v.slice(0, 16) as Wall;
      draft.end = addMinutes(draft.start, length);
    }
    const weekday = (new Date(`${draft.start.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7;
    if (draft.repeat.kind === 'none') draft.repeat.days = [weekday];
  }
  function setEnd(v: string) {
    if (!draft || !v) return;
    endTouched = true;
    draft.end = (draft.allDay ? `${addDays(v as IsoDay, 1)}T00:00` : v.slice(0, 16)) as Wall;
  }
  function setAllDay(on: boolean) {
    if (!draft) return;
    const day = draft.start.slice(0, 10) as IsoDay;
    draft.allDay = on;
    if (on) { draft.start = `${day}T00:00` as Wall; draft.end = `${addDays(day, 1)}T00:00` as Wall; }
    else { draft.start = `${day}T09:00` as Wall; draft.end = addMinutes(draft.start, durationFromTitle(draft.title) ?? 60); }
  }
  // 004: typing "- 45 min" sets the end, until the end is picked by hand.
  let lastTitle = '';
  $effect(() => {
    const title = draft?.title ?? '';
    if (title !== lastTitle) { lastTitle = title; setTitle(title); }
  });

  function chooseCalendar(c: Calendar) {
    if (!draft) return;
    const oldDefault = defaultReminders(cal);
    draft.calendarId = c.id;
    if (same(draft.reminders, oldDefault)) draft.reminders = defaultReminders(c); // R5
    sheet = null;
  }
  function chooseRepeat(kind: RepeatKind) {
    if (!draft) return;
    draft.repeat.kind = kind;
    draft.repeatChanged = true;
    if (kind === 'days' && !draft.repeat.every) draft.repeat.every = 1;
    if (kind !== 'weekly' && kind !== 'biweekly' && kind !== 'days') sheet = null; // these three need more choices
  }
  function setEvery(n: number) { if (draft) { draft.repeat.every = n; draft.repeatChanged = true; } }
  /** Custom's "At": the time of day of the start; the length stays. */
  function setTime(v: string) {
    if (!draft || !v) return;
    const length = minutesBetween(draft.start, draft.end);
    draft.start = `${draft.start.slice(0, 10)}T${v.slice(0, 5)}` as Wall;
    draft.end = addMinutes(draft.start, length);
  }
  function toggleDay(d: number) {
    if (!draft) return;
    const days = new Set(draft.repeat.days);
    if (days.has(d)) { if (days.size > 1) days.delete(d); } else days.add(d);
    draft.repeat.days = [...days].sort((a, b) => a - b);
    draft.repeatChanged = true;
  }
  const REMINDERS: number[][] = [[], [0], [5], [10], [15], [30], [60], [1440]];

  // --- sheets and saving ----------------------------------------------------------------------------
  let sheet = $state<'calendar' | 'repeat' | 'reminder' | 'place' | 'notes' | 'scope' | null>(null);
  let titleError = $state('');
  let timeError = $state('');
  let problem = $state('');
  let saving = $state(false);
  const changedOnlyTimes = $derived(!!draft && !!original && !draft.repeatChanged && draft.calendarId === original.calendarId);

  function validate(): boolean {
    if (!draft) return false;
    titleError = draft.title.trim() ? '' : 'Give it a name, like “Read - 20 min”.';
    timeError = draft.end < draft.start ? 'It has to end after it starts.' : '';
    problem = draft.calendarId ? '' : 'Choose a calendar first.';
    // 077: a copy needs its own date or time, or it would sit exactly on top of the original.
    if (!timeError && !problem && mode.kind === 'duplicate' && original && draft.start === original.start && draft.end === original.end) timeError = 'Pick a new date or time for the copy.';
    return !titleError && !timeError && !problem;
  }
  async function save() {
    if (!draft || !validate()) return;
    if (mode.kind === 'edit' && mode.event.rrule) { sheet = 'scope'; return; }
    await commit('all');
  }
  async function commit(scope: Scope) {
    if (!draft) return;
    saving = true; sheet = null;
    const plain = $state.snapshot(draft) as EventDraft;
    try {
      if (mode.kind !== 'edit') await createEvent(plain, zone);
      else await saveEdit(mode.event, mode.item, plain, scope, zone, habitDayOf(new Date(), zone));
      syncReminders().catch(() => {}); // 021: the push queue follows the calendar
      onsaved(plain.start.slice(0, 10) as IsoDay);
    } catch {
      problem = 'Couldn’t save it. Try again.';
    } finally { saving = false; }
  }
</script>

<main class="screen editor">
  <TopBar type="modal" title={mode.kind === 'new' ? (mode.habit ? 'New habit' : 'New event') : mode.kind === 'duplicate' ? 'Duplicate event' : 'Edit event'} leftLabel="Cancel" rightLabel={saving ? 'Saving…' : 'Save'} onleft={oncancel} onright={save} />
  {#if draft}
    <TextField bind:value={draft.title} placeholder="Title, like “Read - 20 min”" error={titleError || undefined} autocapitalize="sentences" spellcheck />
    <div class="group">
      <ListRow label="Calendar" value={cal?.name ?? 'Choose'} onclick={() => (sheet = 'calendar')} />
    </div>
    <div class="group">
      <ListRow type="toggle" label="All day" on={draft.allDay} onchange={setAllDay} />
    </div>
    <div class="group">
      <PickerRow label="Starts" value={startLabel} type={draft.allDay ? 'date' : 'datetime-local'}
        input={draft.allDay ? draft.start.slice(0, 10) : draft.start} onchange={setStart} />
      <PickerRow label="Ends" value={endLabel} type={draft.allDay ? 'date' : 'datetime-local'}
        input={draft.allDay ? lastDay : draft.end} min={draft.allDay ? draft.start.slice(0, 10) : draft.start} onchange={setEnd} />
      {#if timeError}<p class="t-label-small problem" role="alert">{timeError}</p>{/if}
    </div>
    <div class="group">
      <ListRow label="Repeat" value={repeatText} onclick={() => (sheet = 'repeat')} />
      <ListRow label="Reminder" value={reminderText} onclick={() => (sheet = 'reminder')} />
    </div>
    <div class="group last">
      <ListRow label="Place or link" value={draft.place ? (draft.place.length > 24 ? `${draft.place.slice(0, 24)}…` : draft.place) : 'Add'} onclick={() => (sheet = 'place')} />
      <ListRow label="Notes" value={draft.notes ? 'Added' : 'Add'} onclick={() => (sheet = 'notes')} />
    </div>
    {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
  {/if}
</main>

{#if draft}
  <Sheet open={sheet === 'calendar'} title="Calendar" onclose={() => (sheet = null)}>
    <ul class="sheet list">
      {#each cals as c (c.id)}
        <li>
          <button class="choice" aria-pressed={c.id === draft.calendarId} style:--cal="var(--calendar-{c.color})" onclick={() => chooseCalendar(c)}>
            <span class="dot" aria-hidden="true"></span>
            <span class="t-body-default grow">{c.name}{#if c.trackAsHabits}<span class="t-body-small tertiary"> · habits</span>{/if}</span>
            {#if c.id === draft.calendarId}<Icon name="check" />{/if}
          </button>
        </li>
      {/each}
    </ul>
  </Sheet>

  <Sheet open={sheet === 'repeat'} title="Repeat" onclose={() => (sheet = null)}>
    <div class="sheet">
      <ul class="list">
        {#each (['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly', 'days'] as RepeatKind[]).concat(draft.repeat.raw ? ['custom'] : []) as kind (kind)}
          <li>
            <button class="choice" aria-pressed={draft.repeat.kind === kind} onclick={() => chooseRepeat(kind)}>
              <span class="t-body-default grow">{kind === 'custom' ? `As imported: ${repeatText}` : KIND_LABEL[kind]}</span>
              {#if draft.repeat.kind === kind}<Icon name="check" />{/if}
            </button>
          </li>
        {/each}
      </ul>
      {#if draft.repeat.kind === 'days'}
        <p class="t-label-small tertiary">Every</p>
        <div class="days">
          {#each Array.from({ length: MAX_EVERY }, (_, i) => i + 1) as n (n)}
            <Chip label={n === 1 ? 'Week' : `${n} weeks`} selected={(draft.repeat.every ?? 1) === n} onclick={() => setEvery(n)} />
          {/each}
        </div>
      {/if}
      {#if draft.repeat.kind === 'weekly' || draft.repeat.kind === 'biweekly' || draft.repeat.kind === 'days'}
        <p class="t-label-small tertiary">On</p>
        <div class="days">
          {#each [0, 1, 2, 3, 4, 5, 6] as d (d)}
            <Chip label={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]!} selected={draft.repeat.days.includes(d)} onclick={() => toggleDay(d)} />
          {/each}
        </div>
      {/if}
      {#if draft.repeat.kind === 'days' && !draft.allDay}
        <PickerRow label="At" value={draft.start.slice(11)} type="time" input={draft.start.slice(11)} onchange={setTime} />
      {/if}
      {#if draft.repeat.kind !== 'none'}
        <PickerRow label="Ends" value={draft.repeat.until ? shortDate(draft.repeat.until) : 'Never'} type="date"
          input={draft.repeat.until ?? ''} min={draft.start.slice(0, 10)}
          onchange={(v) => { draft!.repeat.until = (v || null) as IsoDay | null; draft!.repeatChanged = true; }} />
        {#if draft.repeat.until}<Button variant="tertiary" onclick={() => { draft!.repeat.until = null; draft!.repeatChanged = true; }}>Repeat with no end</Button>{/if}
      {/if}
      <Button onclick={() => (sheet = null)}>Done</Button>
    </div>
  </Sheet>

  <Sheet open={sheet === 'reminder'} title="Reminder" onclose={() => (sheet = null)}>
    <ul class="sheet list">
      {#each REMINDERS as option (option.join() || 'none')}
        <li>
          <button class="choice" aria-pressed={same(draft.reminders, option)} onclick={() => { draft!.reminders = option; sheet = null; }}>
            <span class="t-body-default grow">{reminderLabel(option)}{#if cal && same(option, defaultReminders(cal))}<span class="t-body-small tertiary"> · {cal.name} default</span>{/if}</span>
            {#if same(draft.reminders, option)}<Icon name="check" />{/if}
          </button>
        </li>
      {/each}
    </ul>
  </Sheet>

  <Sheet open={sheet === 'place'} title="Place or link" onclose={() => (sheet = null)}>
    <div class="sheet">
      <TextField bind:value={draft.place} placeholder="An address, or a meeting link" />
      <Button onclick={() => (sheet = null)}>Done</Button>
    </div>
  </Sheet>

  <Sheet open={sheet === 'notes'} title="Notes" onclose={() => (sheet = null)}>
    <div class="sheet">
      <textarea class="t-body-default notes" bind:value={draft.notes} rows="6" aria-label="Notes"></textarea>
      <Button onclick={() => (sheet = null)}>Done</Button>
    </div>
  </Sheet>

  <Sheet open={sheet === 'scope'} title="Change a repeating event" onclose={() => (sheet = null)}>
    <div class="sheet">
      <p class="t-body-small secondary">“{draft.title.trim()}” is a repeating event. Past answers keep their original time and title.</p>
      {#if changedOnlyTimes}<Button variant="secondary" onclick={() => commit('this')}>Only this event</Button>{/if}
      <Button variant="secondary" onclick={() => commit('following')}>This and following</Button>
      <Button variant="secondary" onclick={() => commit('all')}>All events</Button>
      <Button variant="tertiary" onclick={() => (sheet = null)}>Cancel</Button>
    </div>
  </Sheet>
{/if}

<style>
  .editor { display: flex; flex-direction: column; gap: var(--space-8); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .group { border-bottom: var(--stroke-hairline) solid var(--border-divider); padding-bottom: var(--space-8); }
  .group.last { border-bottom: 0; }
  .problem { color: var(--text-accent); }
  .secondary { color: var(--text-secondary); }
  .tertiary { color: var(--text-tertiary); }
  .grow { flex: 1; min-width: 0; }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); } /* the sheet already pads 8 on top and the gutter at the sides (Figma 46:2315) */
  .list { display: grid; }
  .choice {
    display: flex; align-items: center; gap: var(--space-12); width: 100%; min-height: var(--size-control);
    padding: var(--space-12) 0; text-align: left; color: var(--icon-default);
  }
  .choice .t-body-default { color: var(--text-primary); }
  .dot { width: var(--space-8); height: var(--space-8); border-radius: var(--radius-round); background: var(--cal); flex: none; }
  .days { display: flex; flex-wrap: wrap; column-gap: var(--space-8); }
  .notes {
    width: 100%; padding: var(--space-12); border: 0; border-radius: var(--radius-control); resize: vertical;
    box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control); color: var(--text-primary); background: var(--bg-default);
  }
</style>
