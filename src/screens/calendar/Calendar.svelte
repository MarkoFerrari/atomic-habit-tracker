<script lang="ts">
  // 05 Calendar (Figma 65:3824), flow F3: the full calendar that replaces Proton (015).
  // H26 Day: date strip, calendar chips, a timeline with past greyed, now outlined, upcoming tinted (034),
  // habit dots, free bands (070) and overlapping events side by side (E23). H27 Week: blocks without
  // titles, habits done per day. H28 Month: up to three dots a day; the selected day lists below.
  // H33: a day with nothing on it. Swipe sideways to move by a day, a week or a month.
  import { onMount, tick } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import TabBar from '../../ui/TabBar.svelte';
  import type { Tab } from '../../ui/tabs';
  import SegmentedControl from '../../ui/SegmentedControl.svelte';
  import DatePill from '../../ui/DatePill.svelte';
  import Chip from '../../ui/Chip.svelte';
  import EventBlock from '../../ui/EventBlock.svelte';
  import EmptyState from '../../ui/EmptyState.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import { swipe } from '../../ui/swipe';
  import { READY_TABS } from '../../ui/tabs';
  import { db } from '../../data/db';
  import { allEvents, calendars as loadCalendars } from '../../data/events';
  import { getSettings } from '../../data/settings';
  import type { Answer, Calendar, CalendarEvent } from '../../data/schema';
  import { addDays, type IsoDay } from '../../domain/day';
  import {
    agenda, dotsOn, freeBands, itemKey, layoutDay, meetingLink, minuteOfDay, monthGrid, onDay, timeRange, weekOf, type AgendaItem,
  } from '../../domain/agenda';
  import { occurrencesOn } from '../../domain/today';
  import { toSource } from '../../data/answers';
  import { dayAndNumber, fullDate, hoursLabel, isoWeek, monthName, weekdayLetter, weekdayShort, weekRange } from '../../domain/format';
  import { wallOf } from '../../domain/zone';

  type Mode = 'day' | 'week' | 'month';
  interface Props {
    initialDay?: IsoDay;
    initialMode?: Mode;
    ontab?: (tab: Tab) => void;
    onopen?: (item: AgendaItem) => void;
    onnew?: (day: IsoDay) => void;
    onview?: (day: IsoDay, mode: Mode) => void; // the app keeps the place while a detail screen is open
  }
  let { initialDay, initialMode = 'day', ontab, onopen, onnew, onview }: Props = $props();

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const pad = (n: number) => String(n).padStart(2, '0');
  let now = $state(new Date());
  const today = $derived(wallOf(now, zone).slice(0, 10) as IsoDay);
  // svelte-ignore state_referenced_locally
  let selected = $state<IsoDay>(initialDay ?? (wallOf(new Date(), zone).slice(0, 10) as IsoDay));
  // svelte-ignore state_referenced_locally
  let mode = $state<Mode>(initialMode);
  $effect(() => onview?.(selected, mode));
  let events = $state<CalendarEvent[]>([]);
  let cals = $state<Calendar[]>([]);
  let answers = $state<Answer[]>([]);
  let trackingStart = $state<IsoDay | null>(null);
  let hidden = $state<Set<string>>(new Set());
  let loaded = $state(false);

  async function load() {
    now = new Date();
    const [evs, cs, ans, settings] = await Promise.all([allEvents(), loadCalendars(), (await db()).getAll('answers'), getSettings()]);
    events = evs;
    cals = cs;
    answers = ans;
    trackingStart = settings.trackingStart as IsoDay | null;
    loaded = true;
  }

  onMount(() => {
    load().then(scrollToFocus);
    const t = setInterval(() => (now = new Date()), 30_000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  });

  const calById = $derived(new Map(cals.map((c) => [c.id, c])));
  const habitCals = $derived(new Set(cals.filter((c) => c.trackAsHabits).map((c) => c.id)));
  const visible = $derived(events.filter((e) => !hidden.has(e.calendarId)));
  const week = $derived(weekOf(selected));
  const grid = $derived(monthGrid(selected));
  const range = $derived.by(() => {
    if (mode === 'month') { const days = grid.flat().filter(Boolean) as IsoDay[]; return [days[0]!, days.at(-1)!] as const; }
    return [week[0]!, week[6]!] as const;
  });
  const items = $derived(loaded ? agenda(visible, range[0], range[1], zone) : []);
  const answerOf = $derived(new Map(answers.map((a) => [a.key, a.status])));
  const dayItems = $derived(onDay(items, selected));

  // --- labels ---------------------------------------------------------------------------------------
  const eyebrow = $derived(mode === 'day' ? fullDate(selected) : mode === 'week' ? weekRange(week[0]!, week[6]!) : selected.slice(0, 4));
  const title = $derived(mode === 'week' ? `Week ${isoWeek(selected)}` : monthName(selected));
  const calName = (i: AgendaItem) => calById.get(i.calendarId)?.name ?? '';
  const token = (i: AgendaItem) => calById.get(i.calendarId)?.color ?? 'habits';
  const timeLine = (i: AgendaItem, day: IsoDay) => `${timeRange(i, day)} · ${calName(i)}`;
  const stateOf = (i: AgendaItem) => (i.endAt <= now.getTime() ? 'past' : i.startAt <= now.getTime() ? 'now' : 'upcoming');
  const habitDot = (i: AgendaItem) => (habitCals.has(i.calendarId) ? (answerOf.get(itemKey(i)) === 'done' ? 'done' : 'open') : null);
  const joinable = (i: AgendaItem) => {
    const e = events.find((x) => x.id === i.eventId);
    return !!e && stateOf(i) !== 'past' && !!meetingLink(e.place, e.notes);
  };

  // --- Day view geometry: 48 px an hour (Figma H26), labels sit on their hour line ---------------
  const HOUR_ROWS = Array.from({ length: 25 }, (_, h) => h);
  const placed = $derived(layoutDay(dayItems, selected, 20));
  const allDayItems = $derived(dayItems.filter((i) => i.allDay || (i.start < `${selected}T00:00` && i.end > `${addDays(selected, 1)}T00:00`)));
  const timedPlaced = $derived(placed.filter((p) => !allDayItems.includes(p.item)));
  const free = $derived(freeBands(timedPlaced));
  const y = (minutes: number) => `calc(var(--space-48) * ${minutes / 60} + var(--space-8))`;
  const nowMinute = $derived(today === selected ? minuteOfDay(wallOf(now, zone), selected) : null);

  let timeline = $state<HTMLElement>();
  async function scrollToFocus() {
    await tick();
    if (!timeline || mode !== 'day') return;
    const first = timedPlaced[0]?.top;
    const focus = nowMinute ?? (first !== undefined ? first : 7 * 60);
    const hour = parseFloat(getComputedStyle(timeline).getPropertyValue('--space-48')) || 0;
    timeline.scrollTop = Math.max(0, ((focus - 60) / 60) * hour);
  }

  function go(n: number) {
    if (mode === 'day') selected = addDays(selected, n);
    else if (mode === 'week') selected = addDays(selected, 7 * n);
    else {
      const [y0, m0] = selected.split('-').map(Number) as [number, number];
      const total = y0 * 12 + (m0 - 1) + n;
      selected = `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01` as IsoDay;
    }
    if (mode === 'day') scrollToFocus();
  }
  function pick(day: IsoDay, toMode?: Mode) {
    selected = day;
    if (toMode) mode = toMode;
    if (mode === 'day') scrollToFocus();
  }
  function toggleCalendar(id: string) {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id); else next.add(id);
    hidden = next;
  }

  // --- Week view: 05:00 to 24:00 in the grid's height (Figma H27, 20 px an hour) --------------------
  const WEEK_FROM = 5 * 60;
  const weekY = (m: number) => `calc(var(--space-20) * ${Math.max(m - WEEK_FROM, 0) / 60})`;
  const habitsDone = (d: IsoDay) => {
    if (d > today || (trackingStart && d < trackingStart)) return null; // 033: not counted, never zero
    const habitEvents = events.filter((e) => habitCals.has(e.calendarId)).map(toSource);
    const due = occurrencesOn(habitEvents, d);
    if (!due.length) return null;
    const done = due.filter((o) => answerOf.get(`${o.eventId}|${o.occurrence}`) === 'done').length;
    return `${done}/${due.length}`;
  };
</script>

<div class="page">
  <main class="screen calendar">
    <TopBar {eyebrow} {title} action={{ icon: 'plus', label: 'New event' }} onaction={() => onnew?.(selected)} />
    <SegmentedControl label="Calendar view" selected={mode}
      options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]}
      onselect={(m) => { mode = m; if (m === 'day') scrollToFocus(); }} />

    {#if mode === 'day'}
      <div class="strip" use:swipe={{ onleft: () => pick(addDays(week[0]!, 7)), onright: () => pick(addDays(week[0]!, -7)) }}>
        {#each week as d (d)}
          <DatePill weekday={weekdayShort(d)} day={d.slice(8, 10)} selected={d === selected} today={d === today}
            label={fullDate(d)} onclick={() => pick(d)} />
        {/each}
      </div>
    {/if}

    {#if mode !== 'month' && cals.length > 1}
      <div class="chips" role="group" aria-label="Calendars shown">
        {#each cals as c (c.id)}
          <Chip kind="filter" label={c.name} calendar={c.color} selected={!hidden.has(c.id)} onclick={() => toggleCalendar(c.id)} />
        {/each}
      </div>
    {/if}

    {#if !loaded}
      <!-- first read from IndexedDB -->
    {:else if mode === 'day'}
      {#if dayItems.length === 0}
        <div class="spacer"></div>
        <EmptyState title="Nothing on {dayAndNumber(selected)}" body="A free day. Add an event, or keep it free."
          action="New event" onaction={() => onnew?.(selected)} />
        <div class="spacer"></div>
      {:else}
        {#if allDayItems.length}
          <ul class="all-day">
            {#each allDayItems as i (itemKey(i))}
              <li><EventBlock size="compact" title={i.title} time="All day · {calName(i)}" calendar={token(i)}
                state={stateOf(i)} habit={habitDot(i)} onclick={() => onopen?.(i)} /></li>
            {/each}
          </ul>
        {/if}
        <div class="timeline" bind:this={timeline} use:swipe={{ onleft: () => go(1), onright: () => go(-1) }}>
          <div class="hours">
            {#each HOUR_ROWS as h (h)}
              <span class="t-number-small hour" style:top="calc(var(--space-48) * {h})">{pad(h % 24)}:00</span>
              <span class="line" style:top="calc(var(--space-48) * {h} + var(--space-8))"></span>
            {/each}
            {#each free as f (f.top)}
              <div class="free" style:top="calc({y(f.top)} + var(--stroke-hairline) * 2)" style:height="calc(var(--space-48) * {(f.bottom - f.top) / 60} - var(--stroke-hairline) * 4)">
                <span class="t-label-small">Free · {hoursLabel(f.bottom - f.top)}</span>
              </div>
            {/each}
            {#each timedPlaced as p (itemKey(p.item))}
              {@const minutes = p.bottom - p.top}
              <div class="slot"
                style:top="calc({y(p.top)} + var(--stroke-hairline))"
                style:height="calc(var(--space-48) * {minutes / 60} - var(--stroke-hairline) * 2)"
                style:left="calc(var(--space-48) + var(--space-4) + (100% - var(--space-48) - var(--space-8)) * {p.column / p.columns})"
                style:width="calc((100% - var(--space-48) - var(--space-8)) / {p.columns} - var(--stroke-hairline) * {p.columns > 1 ? 2 : 0})">
                <EventBlock fill title={p.item.title} time={timeLine(p.item, selected)} calendar={token(p.item)}
                  size={minutes < 55 ? 'compact' : 'regular'} state={stateOf(p.item)} habit={habitDot(p.item)}
                  join={p.columns === 1 && minutes >= 55 && joinable(p.item)} onclick={() => onopen?.(p.item)} />
              </div>
            {/each}
            {#if nowMinute !== null}
              <span class="now-line" style:top={y(nowMinute)} aria-hidden="true"></span>
              <span class="now-dot" style:top={y(nowMinute)} aria-hidden="true"></span>
            {/if}
          </div>
        </div>
      {/if}
    {:else if mode === 'week'}
      <div class="week" use:swipe={{ onleft: () => go(1), onright: () => go(-1) }}>
        {#each week as d, col (d)}
          {@const dayList = onDay(items, d).filter((i) => !i.allDay)}
          {@const count = habitsDone(d)}
          <button class="col" class:first={col === 0} aria-label="{fullDate(d)}, {dayList.length} events{count ? `, habits done ${count}` : ''}" onclick={() => pick(d, 'day')}>
            <span class="t-label-small wd" class:today={d === today}>{weekdayLetter(d)}</span>
            <span class="t-number-default num" class:today={d === today}>{d.slice(8, 10)}</span>
            <span class="lane">
              {#each dayList as i (itemKey(i))}
                {@const top = minuteOfDay(i.start, d)}
                {@const bottom = Math.max(minuteOfDay(i.end, d), top + 30)}
                <span class="wblock" class:past={i.endAt <= now.getTime()} style:--cal="var(--calendar-{token(i)})"
                  style:top={weekY(top)} style:height="max(var(--space-8), calc(var(--space-20) * {(bottom - Math.max(top, WEEK_FROM)) / 60}))"></span>
              {/each}
            </span>
            <span class="t-number-small done" class:none={!count}>{count ?? '—'}</span>
          </button>
        {/each}
      </div>
      <p class="t-label-small caption">Habits done</p>
    {:else}
      <div class="month" use:swipe={{ onleft: () => go(1), onright: () => go(-1) }}>
        <div class="row">
          {#each week as d (d)}<span class="t-label-small head">{weekdayLetter(d)}</span>{/each}
        </div>
        {#each grid as row, r (r)}
          <div class="row">
            {#each row as d, c (d ?? `empty-${r}-${c}`)}
              {#if d}
                {@const dots = dotsOn(items, d, cals.filter((x) => !hidden.has(x.id)).map((x) => x.id))}
                <button class="cell" class:selected={d === selected} class:past={d < today} class:today={d === today}
                  aria-pressed={d === selected} aria-label="{fullDate(d)}{dots.length ? `, events in ${dots.map((id) => calById.get(id)?.name).join(', ')}` : ''}"
                  onclick={() => pick(d)} ondblclick={() => pick(d, 'day')}>
                  <span class="t-number-default">{d.slice(8, 10)}</span>
                  <span class="dots">{#each dots as id (id)}<span class="mdot" style:--cal="var(--calendar-{calById.get(id)?.color})"></span>{/each}</span>
                </button>
              {:else}
                <span class="cell"></span>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
      <SectionLabel text={fullDate(selected)} />
      {#if dayItems.length}
        <ul class="list">
          {#each dayItems as i (itemKey(i))}
            <li><EventBlock title={i.title} time={timeLine(i, selected)} calendar={token(i)} state={stateOf(i)}
              habit={habitDot(i)} join={joinable(i)} onclick={() => onopen?.(i)} /></li>
          {/each}
        </ul>
      {:else}
        <p class="t-body-small secondary">Nothing on this day.</p>
      {/if}
    {/if}
  </main>
  <TabBar active="calendar" ready={READY_TABS} onselect={ontab} />
</div>

<style>
  .page { height: 100dvh; display: flex; flex-direction: column; }
  .calendar {
    flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--space-12);
    padding-bottom: var(--space-16); overflow: hidden;
  }
  .spacer { flex: 1; }
  .secondary { color: var(--text-secondary); }
  .strip { display: flex; justify-content: space-between; touch-action: pan-y; }
  .chips { display: flex; gap: var(--space-8); overflow-x: auto; scrollbar-width: none; flex: none; }
  .chips::-webkit-scrollbar { display: none; }
  .all-day { display: grid; gap: var(--space-4); }

  .timeline { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; }
  .hours { position: relative; height: calc(var(--space-48) * 24 + var(--space-16)); }
  .hour { position: absolute; left: 0; color: var(--text-tertiary); }
  .line { position: absolute; left: var(--space-48); right: 0; height: var(--stroke-hairline); background: var(--border-divider); }
  .slot { position: absolute; display: flex; }
  .free {
    position: absolute; left: calc(var(--space-48) + var(--space-4)); right: var(--space-4);
    border: var(--stroke-hairline) dashed var(--border-divider); border-radius: var(--radius-event);
    padding: var(--space-12); color: var(--text-tertiary); overflow: hidden;
  }
  .now-line {
    position: absolute; left: calc(var(--space-32) + var(--space-8)); right: 0;
    height: calc(var(--stroke-hairline) * 2); margin-top: calc(var(--stroke-hairline) * -1);
    background: var(--action-primary); pointer-events: none; z-index: 1;
  }
  .now-dot {
    position: absolute; left: calc(var(--space-32) + var(--space-4)); width: var(--space-8); height: var(--space-8);
    margin-top: calc(var(--space-4) * -1); border-radius: var(--radius-round); background: var(--action-primary); z-index: 1;
  }

  .week { display: flex; touch-action: pan-y; }
  .col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; }
  .wd { color: var(--text-tertiary); }
  .num { color: var(--text-primary); }
  .today { color: var(--text-accent); }
  .lane {
    position: relative; align-self: stretch; height: calc(var(--space-20) * 19); margin-top: var(--space-8);
    border-left: var(--stroke-hairline) solid var(--border-divider);
  }
  .first .lane { border-left-color: transparent; }
  .wblock {
    position: absolute; left: calc(var(--space-4) - var(--stroke-hairline)); right: var(--space-4);
    border-radius: var(--radius-event); overflow: hidden;
    background: color-mix(in srgb, var(--cal) 28%, var(--bg-default)); /* upcoming: Figma layer opacity 28% */
  }
  .wblock.past { background: color-mix(in srgb, var(--cal) 14%, var(--bg-default)); } /* past: 14% */
  .wblock::before { content: ''; position: absolute; inset: 0 auto 0 0; width: calc(var(--stroke-hairline) * 3); background: var(--cal); }
  .done { margin-top: var(--space-12); color: var(--text-primary); }
  .done.none { color: var(--text-tertiary); }
  .caption { color: var(--text-tertiary); }

  .month { display: grid; gap: var(--space-4); touch-action: pan-y; }
  .row { display: flex; }
  .head { flex: 1; text-align: center; color: var(--text-tertiary); }
  .cell {
    flex: 1; min-width: 0; display: grid; justify-items: center; gap: var(--space-4);
    padding: var(--space-8) 0; border-radius: var(--radius-control); color: var(--text-primary);
  }
  .cell.past { color: var(--text-tertiary); }
  .cell.today:not(.selected) { color: var(--text-accent); }
  .cell.selected { background: var(--action-primary); color: var(--action-on-primary); }
  .dots { display: flex; gap: calc(var(--space-4) / 2); height: var(--space-4); }
  .mdot { width: var(--space-4); height: var(--space-4); border-radius: var(--radius-round); background: var(--cal); }
  .selected .mdot { background: var(--action-on-primary); }
  .list { display: grid; gap: var(--space-12); overflow-y: auto; min-height: 0; }

  .page :global(nav) { flex: none; }
</style>
