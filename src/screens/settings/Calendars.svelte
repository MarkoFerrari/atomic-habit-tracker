<script lang="ts">
  // H42 Calendars (Figma 54:3110): one switch per calendar, Track as habits. Dots use the calendar marker
  // colours (034). Tap a calendar to edit its name, colour and default reminder, or to delete it.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import Button from '../../ui/Button.svelte';
  import { calendars as loadCalendars } from '../../data/events';
  import { eventCounts, saveCalendar } from '../../data/calendars';
  import { parseIcs, IcsError, type IcsCalendar } from '../../data/ics';
  import type { Calendar } from '../../data/schema';
  import { syncReminders } from '../../push/reminders';
  import { plural } from '../../domain/format';

  interface Props {
    onback: () => void;
    onedit: (c: Calendar | null) => void;
    onimport: (ics: IcsCalendar, fileName: string) => void;
    notice?: string;
  }
  let { onback, onedit, onimport, notice = '' }: Props = $props();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let cals = $state.raw<Calendar[]>([]);
  let counts = $state.raw<Map<string, number>>(new Map());
  let busy = $state(false);
  let problem = $state('');
  let input = $state<HTMLInputElement>();

  async function load() { [cals, counts] = await Promise.all([loadCalendars(), eventCounts()]); }
  onMount(load);

  const detail = (c: Calendar) => `${plural(counts.get(c.id) ?? 0, 'event')}${c.trackAsHabits ? ' · tracked as habits' : ''}`;
  async function track(c: Calendar, on: boolean) {
    busy = true; problem = '';
    try { await saveCalendar({ ...c, trackAsHabits: on }); await load(); syncReminders().catch(() => {}); }
    catch { problem = 'Couldn’t change it. Try again.'; }
    finally { busy = false; }
  }
  async function pick(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    problem = '';
    try { onimport(parseIcs(await file.text(), zone), file.name); }
    catch (err) {
      problem = err instanceof IcsError
        ? `${err.message} In Proton Calendar on the web: Settings → All settings → Import/export → Download ICS.` // E11
        : 'Couldn’t read that file. Try again.';
    }
  }
</script>

<main class="screen calendars">
  <TopBar type="navigation" title="" leftLabel="Settings" onleft={onback} />
  <h1 class="t-heading-large">Calendars</h1>
  <SectionLabel text="On this phone · {cals.length}" />
  <ul class="list">
    {#each cals as c (c.id)}
      <li class="row">
        <button class="open" onclick={() => onedit(c)} aria-label="{c.name}, {detail(c)}. Edit">
          <span class="dot" style:background="var(--calendar-{c.color})" aria-hidden="true"></span>
          <span class="text">
            <span class="t-body-strong name">{c.name}</span>
            <span class="t-body-small tertiary">{detail(c)}</span>
          </span>
        </button>
        <Toggle on={c.trackAsHabits} disabled={busy} label="Track {c.name} as habits" onchange={(on) => track(c, on)} />
      </li>
    {/each}
  </ul>
  <p class="t-body-small tertiary">The switch is Track as habits. Tap a calendar to edit its name, colour and default reminder, or to delete it.</p>
  {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
  {#if notice}<p class="t-body-small secondary" role="status">{notice}</p>{/if}
  <Button variant="secondary" icon="plus" onclick={() => onedit(null)}>New calendar</Button>
  <Button variant="tertiary" icon="download" onclick={() => input?.click()}>Import an .ics file</Button>
  <input bind:this={input} type="file" accept=".ics,text/calendar" hidden onchange={pick} />
</main>

<style>
  .calendars { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .list { display: grid; }
  .row { display: flex; align-items: center; gap: var(--space-12); padding: var(--space-12) 0; }
  .row + .row { border-top: var(--stroke-hairline) solid var(--border-divider); }
  .open { flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-12); text-align: left; min-height: var(--size-touch); }
  .dot { flex: none; width: var(--space-12); height: var(--space-12); border-radius: var(--radius-round); }
  .text { flex: 1; min-width: 0; display: grid; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); } /* E21 */
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }
  .problem { color: var(--text-accent); }
</style>
