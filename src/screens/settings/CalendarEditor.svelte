<script lang="ts">
  // H43 New calendar (Figma 54:3192), also used to edit one; H49 Delete calendar (55:3711).
  // Name, colour, Track as habits, default reminder (R5). Twelve colours (081); a thirteenth calendar
  // shares a hue, and the screen says so (E13).
  // Deleting says how many events go; Back up first is the primary action (R7).
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import TextField from '../../ui/TextField.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Button from '../../ui/Button.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { calendars as loadCalendars, defaultReminders } from '../../data/events';
  import { COLOUR_NAME, TOKENS, deleteCalendar, eventCounts, nextColour, saveCalendar } from '../../data/calendars';
  import { shareBackup } from '../../data/backup';
  import type { Calendar, CalendarToken } from '../../data/schema';
  import { reminderLabel } from '../../domain/reminders';
  import { syncReminders } from '../../push/reminders';
  import { plural } from '../../domain/format';

  interface Props { calendar: Calendar | null; oncancel: () => void; ondone: () => void }
  let { calendar, oncancel, ondone }: Props = $props();

  let others = $state.raw<Calendar[]>([]);
  let count = $state(0);
  // svelte-ignore state_referenced_locally
  let name = $state(calendar?.name ?? '');
  let color = $state<CalendarToken>('marko');
  // svelte-ignore state_referenced_locally
  let habits = $state(calendar?.trackAsHabits ?? false);
  let reminders = $state<number[]>([15]);
  let remindersTouched = false;

  onMount(async () => {
    const [all, counts] = await Promise.all([loadCalendars(), eventCounts()]);
    others = all.filter((c) => c.id !== calendar?.id);
    count = calendar ? counts.get(calendar.id) ?? 0 : 0;
    color = calendar?.color ?? nextColour(others);
    reminders = defaultReminders(calendar ?? { trackAsHabits: habits } as Calendar);
  });
  $effect(() => { if (!remindersTouched && !calendar?.defaultReminders) reminders = habits ? [0] : [15]; });

  const allUsed = $derived(TOKENS.every((t) => others.some((c) => c.color === t)));
  const usedBy = (t: CalendarToken) => others.filter((c) => c.color === t).map((c) => c.name).join(', ');

  let sheet = $state<'reminder' | 'delete' | null>(null);
  let error = $state('');
  let busy = $state(false);
  const OPTIONS: number[][] = [[], [0], [5], [10], [15], [30], [60], [1440]];
  const same = (a: number[], b: number[]) => a.join() === b.join();

  async function save() {
    error = name.trim() ? '' : 'Give the calendar a name.';
    if (error) return;
    busy = true;
    try {
      await saveCalendar({
        id: calendar?.id ?? crypto.randomUUID(), createdAt: calendar?.createdAt ?? new Date().toISOString(),
        name: name.trim(), color, trackAsHabits: habits, defaultReminders: [...reminders],
      });
      syncReminders().catch(() => {});
      ondone();
    } finally { busy = false; }
  }
  async function backUpFirst() {
    busy = true;
    try { await shareBackup(); } catch { /* the sheet stays open either way */ } finally { busy = false; }
  }
  async function remove() {
    if (!calendar) return;
    busy = true;
    try { await deleteCalendar(calendar); syncReminders().catch(() => {}); ondone(); } finally { busy = false; sheet = null; }
  }
</script>

<main class="screen editor">
  <TopBar type="modal" title={calendar ? 'Edit calendar' : 'New calendar'} leftLabel="Cancel" rightLabel="Save" onleft={oncancel} onright={save} />
  <TextField bind:value={name} placeholder="Name" error={error || undefined} autocapitalize="words" />
  <SectionLabel text="Colour" />
  <div class="swatches" role="radiogroup" aria-label="Colour">
    {#each TOKENS as t (t)}
      <button class="swatch" class:selected={t === color} role="radio" aria-checked={t === color}
        aria-label="{COLOUR_NAME[t]}{usedBy(t) ? `, used by ${usedBy(t)}` : ''}"
        style:--sw="var(--calendar-{t})" onclick={() => (color = t)}><span></span></button>
    {/each}
  </div>
  {#if allUsed}
    <p class="t-body-small accent">All twelve colours are in use, so this one shares a colour with another calendar.</p>
  {/if}
  <ListRow type="toggle" label="Track as habits" bind:on={habits} />
  {#if calendar && habits !== calendar.trackAsHabits}
    <p class="t-body-small tertiary">{habits ? `Its ${plural(count, 'event')} become habits, answered on Today and kept at their clock time.` : `Its ${plural(count, 'event')} stop being habits. Their answers stay.`}</p>
  {/if}
  <ListRow label="Default reminder" value={reminderLabel(reminders)} onclick={() => (sheet = 'reminder')} />
  {#if calendar}
    <ListRow type="destructive" label="Delete calendar" onclick={() => (sheet = 'delete')} />
  {/if}
</main>

<Sheet open={sheet === 'reminder'} title="Default reminder" onclose={() => (sheet = null)}>
  <ul class="sheet list">
    {#each OPTIONS as option (option.join() || 'none')}
      <li>
        <button class="choice" aria-pressed={same(reminders, option)} onclick={() => { reminders = option; remindersTouched = true; sheet = null; }}>
          <span class="t-body-default grow">{reminderLabel(option)}</span>
          {#if same(reminders, option)}<Icon name="check" />{/if}
        </button>
      </li>
    {/each}
  </ul>
</Sheet>

<Sheet open={sheet === 'delete'} title="Delete {calendar?.name ?? ''}?" onclose={() => (sheet = null)}>
  <div class="sheet">
    <p class="t-body-default secondary">{plural(count, 'event')} will be deleted from this phone. This cannot be undone.</p>
    <Button icon="upload" disabled={busy} onclick={backUpFirst}>Back up first</Button>
    <Button variant="secondary" disabled={busy} onclick={remove}>Delete calendar</Button>
    <Button variant="tertiary" onclick={() => (sheet = null)}>Cancel</Button>
  </div>
</Sheet>

<style>
  .editor { display: flex; flex-direction: column; gap: var(--space-16); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .swatches { display: flex; flex-wrap: wrap; gap: var(--space-8); }
  .swatch { width: var(--size-touch); height: var(--size-touch); display: grid; place-items: center; border-radius: var(--radius-round); }
  .swatch span { width: var(--space-32); height: var(--space-32); border-radius: var(--radius-round); background: var(--sw); }
  .swatch.selected { box-shadow: inset 0 0 0 var(--stroke-illustration) var(--border-strong); }
  .accent { color: var(--text-accent); }
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }
  .grow { flex: 1; min-width: 0; }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); }
  .list { display: grid; }
  .choice { display: flex; align-items: center; gap: var(--space-12); width: 100%; min-height: var(--size-control); padding: var(--space-12) 0; text-align: left; color: var(--icon-default); }
  .choice .t-body-default { color: var(--text-primary); }
</style>
