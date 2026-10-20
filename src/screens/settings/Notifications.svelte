<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  // H46 Notifications (Figma 55:3469), with 069: habits remind at their start, and the 22:30 recap push
  // is a switch (off by default). "Last arrived" makes a silent push visible (E1, 027); the test push
  // proves the path end to end. Only habits remind (104): the per-calendar defaults (R5, 072) left with the Calendar.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import Button from '../../ui/Button.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { getSettings } from '../../data/settings';
  import { lastPushArrival, permission, pushDevice, PUSH_URL, sendTestPush, setRecapPush } from '../../push/notifications';
  import { enablePush } from '../../push/enable';
  import { arrivalLabel } from '../../domain/format';

  let { onback }: { onback: () => void } = $props();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let recap = $state(false);
  let last = $state('Not yet');
  let ready = $state(false); // notifications allowed and this phone subscribed
  let busy = $state(false);
  let message = $state('');

  async function load() {
    const [settings, device, arrival] = await Promise.all([getSettings(), pushDevice(), lastPushArrival()]);
    recap = settings.recapPush ?? false;
    ready = permission() === 'granted' && !!device.subscribedAt;
    last = arrival ? arrivalLabel(arrival, new Date(), zone) : 'Not yet';
  }
  onMount(load);

  async function attempt(action: () => Promise<void>, done: string) {
    busy = true; message = '';
    try { await action(); message = done; } catch (e) { message = (e as Error).message || 'Something went wrong. Try again.'; }
    finally { busy = false; }
  }
  const turnOn = () => attempt(async () => {
    const p = await enablePush(); // 121: one tap, no invite code
    if (p !== 'granted') throw new Error('Notifications are off for ATOMIC. Turn them on in the iPhone’s Settings → Notifications → ATOMIC.'); // R3
    await load();
  }, 'Notifications are on.');
  const toggleRecap = (on: boolean) => attempt(async () => { await setRecapPush(on); recap = on; }, on ? 'The recap push arrives at 22:30.' : 'No recap push. Habits remind you when they start.');
  const test = () => attempt(async () => { await sendTestPush(0); }, 'Test sent. It arrives in a few seconds.');

</script>

<main class="screen notifications">
  <TopBar type="navigation" title="" leftLabel="Settings" onleft={onback} />
  <h1 class="t-heading-large">Notifications</h1>

  {#if PUSH_URL}
    <div class="card status">
      <span class="bell"><Icon name="bell" /></span>
      <div class="text">
        <p class="t-body-strong">{ready ? 'Reminders are on' : 'Reminders are off'}</p>
        <p class="t-body-small secondary">{ready ? 'Each habit nudges you when it starts.' : 'Habits can’t remind you when they start.'}</p>
      </div>
    </div>
    {#if !ready}<Button disabled={busy} onclick={turnOn}>Turn on notifications</Button>{/if}
  {/if}

  <SectionLabel text="Evening recap" />
  <div class="card-list">
    <div class="row">
      <span class="t-body-default grow">Recap push at 22:30</span>
      <Toggle on={recap} label="Recap push at 22:30" disabled={!ready || busy} onchange={toggleRecap} />
    </div>
    <div class="row">
      <span class="t-body-default grow">Last arrived</span>
      <span class="t-body-small secondary">{last}</span>
    </div>
  </div>
  <Button variant="card" disabled={!ready || busy} onclick={test}>Send a test push</Button>
  {#if message}<p class="t-body-small secondary" role="status">{message}</p>{/if}

  <p class="t-label-small secondary">Habits remind you when they start. Their names are encrypted on this phone; the server only sees times. The 22:30 recap is optional.</p>
</main>


<style>
  .notifications { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .row { display: flex; align-items: center; gap: var(--space-12); min-height: var(--size-control); padding: var(--space-12) 0; }
  .grow { flex: 1; min-width: 0; }
  .status { display: flex; align-items: center; gap: var(--space-12); }
  .bell { flex: none; display: grid; place-items: center; width: var(--space-40); height: var(--space-40); border-radius: var(--radius-tile); background: var(--bg-app); }
  .text { display: grid; gap: var(--space-4); }
  .secondary { color: var(--text-secondary); }
</style>
