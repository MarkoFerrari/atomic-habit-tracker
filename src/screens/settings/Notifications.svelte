<script lang="ts">
  // H46 Notifications (Figma 55:3469), with 069: habits remind at their start, and the 22:30 recap push
  // is a switch (off by default). "Last arrived" makes a silent push visible (E1, 027); the test push
  // proves the path end to end. Each calendar has a default reminder for new events (R5, 072).
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import Button from '../../ui/Button.svelte';
  import Banner from '../../ui/Banner.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import TextField from '../../ui/TextField.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { calendars as loadCalendars, defaultReminders } from '../../data/events';
  import { eventCounts, setDefaultReminders } from '../../data/calendars';
  import { getSettings } from '../../data/settings';
  import type { Calendar } from '../../data/schema';
  import { askPermission, lastPushArrival, permission, pushDevice, PUSH_URL, sendTestPush, setRecapPush, turnOnPush } from '../../push/notifications';
  import { syncReminders } from '../../push/reminders';
  import { reminderLabel } from '../../domain/reminders';
  import { arrivalLabel, plural } from '../../domain/format';

  let { onback }: { onback: () => void } = $props();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let cals = $state.raw<Calendar[]>([]);
  let counts = $state.raw<Map<string, number>>(new Map());
  let recap = $state(false);
  let last = $state('Not yet');
  let ready = $state(false); // notifications allowed and this phone subscribed
  let needsInvite = $state(false);
  let invite = $state('');
  let busy = $state(false);
  let message = $state('');

  async function load() {
    const [cs, n, settings, device, arrival] = await Promise.all([loadCalendars(), eventCounts(), getSettings(), pushDevice(), lastPushArrival()]);
    cals = cs;
    counts = n;
    recap = settings.recapPush ?? false;
    ready = permission() === 'granted' && !!device.subscribedAt;
    needsInvite = !device.subscribedAt;
    last = arrival ? arrivalLabel(arrival, new Date(), zone) : 'Not yet';
  }
  onMount(load);

  async function attempt(action: () => Promise<void>, done: string) {
    busy = true; message = '';
    try { await action(); message = done; } catch (e) { message = (e as Error).message || 'Something went wrong. Try again.'; }
    finally { busy = false; }
  }
  const turnOn = () => attempt(async () => {
    const p = await askPermission();
    if (p !== 'granted') throw new Error('Notifications are off for ATOMIC. Turn them on in the iPhone’s Settings → Notifications → ATOMIC.'); // R3
    await turnOnPush(invite);
    await syncReminders();
    await load();
  }, 'Notifications are on.');
  const toggleRecap = (on: boolean) => attempt(async () => { await setRecapPush(on); recap = on; }, on ? 'The recap push arrives at 22:30.' : 'No recap push. Habits remind you when they start.');
  const test = () => attempt(async () => { await sendTestPush(0); }, 'Test sent. It arrives in a few seconds.');

  // --- default reminder per calendar (R5) -----------------------------------------------------------
  let editing = $state.raw<Calendar | null>(null);
  let choice = $state<number[]>([]);
  let applyToExisting = $state(false);
  const OPTIONS: number[][] = [[], [0], [5], [10], [15], [30], [60], [1440]];
  const short = (m: number[]) => (m.length === 1 && m[0]! > 0 ? reminderLabel(m).replace(' before', '') : reminderLabel(m));
  const same = (a: number[], b: number[]) => a.join() === b.join();
  function open(c: Calendar) { editing = c; choice = defaultReminders(c); applyToExisting = false; }
  const saveDefault = () => attempt(async () => {
    await setDefaultReminders(editing!, choice, applyToExisting);
    if (applyToExisting) await syncReminders().catch(() => null);
    editing = null;
    await load();
  }, '');
</script>

<main class="screen notifications">
  <TopBar type="navigation" title="" leftLabel="Settings" onleft={onback} />
  <h1 class="t-heading-large">Notifications</h1>

  {#if !ready && PUSH_URL}
    <Banner message="Notifications are off on this phone. Habits and events can’t remind you." />
    {#if needsInvite}<TextField bind:value={invite} label="Invite code" placeholder="The phrase you were given" />{/if}
    <Button disabled={busy || (needsInvite && !invite.trim())} onclick={turnOn}>Turn on notifications</Button>
  {/if}

  <SectionLabel text="Evening recap" />
  <div class="row">
    <span class="t-body-default grow">Recap push at 22:30</span>
    <Toggle on={recap} label="Recap push at 22:30" disabled={!ready || busy} onchange={toggleRecap} />
  </div>
  <div class="row">
    <span class="t-body-default grow">Last arrived</span>
    <span class="t-body-small tertiary">{last}</span>
  </div>
  <Button variant="secondary" icon="bell" disabled={!ready || busy} onclick={test}>Send a test push</Button>
  {#if message}<p class="t-body-small secondary" role="status">{message}</p>{/if}

  <SectionLabel text="Event reminders by default" />
  <ul class="list">
    {#each cals as c (c.id)}
      <li>
        <button class="cal" onclick={() => open(c)}>
          <span class="dot" style:background="var(--calendar-{c.color})" aria-hidden="true"></span>
          <span class="t-body-strong grow name">{c.name}</span>
          <span class="t-body-small tertiary">{short(defaultReminders(c))}</span>
          <span class="chevron"><Icon name="chevron-right" /></span>
        </button>
      </li>
    {/each}
  </ul>
  <p class="t-body-small tertiary">Reminder titles are encrypted on this phone; the server only sees times. Habits remind you when they start; the 22:30 recap is optional.</p>
</main>

<Sheet open={editing !== null} title={editing ? `${editing.name} reminders` : ''} onclose={() => (editing = null)}>
  {#if editing}
    <div class="sheet">
      <ul class="list">
        {#each OPTIONS as option (option.join() || 'none')}
          <li>
            <button class="choice" aria-pressed={same(choice, option)} onclick={() => (choice = option)}>
              <span class="t-body-default grow">{reminderLabel(option)}</span>
              {#if same(choice, option)}<Icon name="check" />{/if}
            </button>
          </li>
        {/each}
      </ul>
      <ListRow type="toggle" label="Also change the {plural(counts.get(editing.id) ?? 0, 'event')} already in it" bind:on={applyToExisting} />
      <Button disabled={busy} onclick={saveDefault}>Save</Button>
    </div>
  {/if}
</Sheet>

<style>
  .notifications { display: flex; flex-direction: column; gap: var(--space-8); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .row { display: flex; align-items: center; gap: var(--space-12); min-height: var(--size-control); padding: var(--space-12) 0; }
  .grow { flex: 1; min-width: 0; }
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }
  .list { display: grid; }
  .list > li + li { border-top: var(--stroke-hairline) solid var(--border-divider); }
  .cal, .choice {
    display: flex; align-items: center; gap: var(--space-12); width: 100%; padding: var(--space-12) 0;
    min-height: var(--size-control); text-align: left; color: var(--icon-default);
  }
  .cal .t-body-strong, .choice .t-body-default { color: var(--text-primary); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dot { flex: none; width: var(--space-12); height: var(--space-12); border-radius: var(--radius-round); }
  .chevron { color: var(--icon-muted); display: flex; }
  .sheet { display: grid; gap: var(--space-12); padding-bottom: var(--space-40); }
</style>
