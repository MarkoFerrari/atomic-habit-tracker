<script lang="ts">
  // H44 Import preview (Figma 54:3250), E8: an .ics file into a calendar. Events matched by their ID:
  // already here are skipped, changed ones are updated unless you keep yours, new ones are added.
  // The count is in the button.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import Chip from '../../ui/Chip.svelte';
  import Button from '../../ui/Button.svelte';
  import Banner from '../../ui/Banner.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { allEvents, calendars as loadCalendars } from '../../data/events';
  import { commitReimport, planReimport, type ReimportPlan } from '../../data/reimport';
  import type { IcsCalendar } from '../../data/ics';
  import type { Calendar, CalendarEvent } from '../../data/schema';
  import { syncReminders } from '../../push/reminders';
  import { plural } from '../../domain/format';

  interface Props { ics: IcsCalendar; fileName: string; oncancel: () => void; ondone: (summary: string) => void }
  let { ics, fileName, oncancel, ondone }: Props = $props();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let cals = $state.raw<Calendar[]>([]);
  let existing = $state.raw<CalendarEvent[]>([]);
  let target = $state<string>('new'); // a calendar id, or 'new'
  let update = $state(true);
  let sheet = $state(false);
  let busy = $state(false);
  let problem = $state('');
  let loaded = $state(false);
  const newName = $derived((ics.name ?? fileName.replace(/\.ics$/i, '')).trim() || 'Imported');

  onMount(async () => {
    [cals, existing] = await Promise.all([loadCalendars(), allEvents()]);
    target = cals.find((c) => c.name.toLowerCase() === (ics.name ?? '').toLowerCase())?.id ?? 'new';
    loaded = true;
  });

  const targetCal = $derived(cals.find((c) => c.id === target) ?? null);
  const plan = $derived<ReimportPlan>(planReimport(ics, existing, targetCal, zone));
  const count = $derived(plan.fresh.length + (update ? plan.changed.length : 0));

  async function run() {
    busy = true; problem = '';
    try {
      const result = await commitReimport(plan, targetCal ?? { newName }, update);
      syncReminders().catch(() => {});
      const parts = [result.added ? `${result.added} added` : '', result.updated ? `${result.updated} updated` : ''].filter(Boolean);
      ondone(parts.length ? `Imported: ${parts.join(', ')}.` : 'Nothing new in that file.');
    } catch { problem = 'Couldn’t import it. Nothing was changed. Try again.'; }
    finally { busy = false; }
  }
</script>

<main class="screen import">
  <TopBar type="modal" title="Import" leftLabel="Cancel" onleft={oncancel} />
  <div class="file">
    <Icon name="calendar" />
    <span class="text"><span class="t-body-strong block name">{fileName}</span><span class="t-body-small tertiary">{plural(plan.total, 'event')} found</span></span>
  </div>
  <dl class="details">
    <div class="row"><dt class="t-body-default grow">Repeating</dt><dd class="t-body-small secondary">{plan.repeating} series</dd></div>
    <div class="row"><dt class="t-body-default grow">Already here</dt><dd class="t-body-small secondary">{plan.same}, will be skipped</dd></div>
    {#if plan.changed.length}
      <button class="row link" onclick={() => (sheet = true)}>
        <span class="t-body-default grow">Changed</span>
        <span class="t-body-small accent">{plan.changed.length}, {update ? 'will be updated' : 'kept as on this phone'}</span>
        <span class="chevron"><Icon name="chevron-right" /></span>
      </button>
    {/if}
  </dl>
  {#each ics.problems.slice(0, 3) as p (p)}<Banner message={p} />{/each}
  <SectionLabel text="Import into" />
  <div class="chips">
    {#each cals as c (c.id)}
      <Chip kind="filter" label={c.name} calendar={c.color} selected={target === c.id} onclick={() => (target = c.id)} />
    {/each}
    <Chip kind="filter" dot={false} label="+ New calendar: {newName}" selected={target === 'new'} onclick={() => (target = 'new')} />
  </div>
  <div class="spacer"></div>
  {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
  <Button disabled={!loaded || busy || count === 0} onclick={run}>{count ? `Import ${plural(count, 'event')}` : 'Nothing new to import'}</Button>
</main>

<Sheet open={sheet} title="Changed in the file" onclose={() => (sheet = false)}>
  <div class="sheet">
    <p class="t-body-small secondary">These events are already on this phone, but the file has a different version. Answers stay on their events either way.</p>
    <ul class="changed">
      {#each plan.changed.slice(0, 20) as c (c.before.id)}
        <li class="t-body-default">{c.before.title === c.after.title ? c.after.title : `${c.before.title} → ${c.after.title}`}</li>
      {/each}
    </ul>
    <Button onclick={() => { update = true; sheet = false; }}>Update them</Button>
    <Button variant="secondary" onclick={() => { update = false; sheet = false; }}>Keep what’s on this phone</Button>
  </div>
</Sheet>

<style>
  .import { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .file { display: flex; align-items: center; gap: var(--space-12); padding: var(--space-16); border-radius: var(--radius-control); background: var(--bg-subtle); }
  .text { flex: 1; min-width: 0; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .block { display: block; }
  .details { margin: 0; display: grid; }
  .row { display: flex; align-items: center; gap: var(--space-16); padding: var(--space-12) 0; width: 100%; text-align: left; }
  .row + .row { border-top: var(--stroke-hairline) solid var(--border-divider); }
  dd { margin: 0; }
  .link { color: var(--text-primary); }
  .chevron { color: var(--icon-muted); display: flex; }
  .grow { flex: 1; min-width: 0; }
  .chips { display: flex; flex-wrap: wrap; column-gap: var(--space-8); }
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }
  .accent { color: var(--text-accent); }
  .problem { color: var(--text-accent); }
  .spacer { flex: 1; }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); }
  .changed { display: grid; gap: var(--space-4); max-height: calc(var(--space-64) * 3); overflow-y: auto; }
</style>
