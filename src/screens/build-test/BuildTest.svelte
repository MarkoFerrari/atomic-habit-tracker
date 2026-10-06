<script lang="ts">
  // M0 · Build test 0 (CLAUDE.md §9). A diagnostic screen, not part of the product:
  // it proves that data and notifications survive on the iPhone before any real screen is built.
  import { onMount } from 'svelte';
  import Button from '../../ui/Button.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import KvRow from '../../ui/KvRow.svelte';
  import { runContext, type RunContext } from '../../data/context';
  import { addDiagnostic, listDiagnostics } from '../../data/db';
  import type { Diagnostic } from '../../data/schema';
  import { habitDayOf } from '../../domain/day';
  import { askPermission, permission, pushSupported, showLocalTest, subscribe, VAPID_PUBLIC_KEY, type Permission } from '../../push/notifications';
  import wordmark from '../../../design/logo-wordmark.svg';

  let ctx = $state<RunContext>(runContext());
  let entries = $state<Diagnostic[]>([]);
  let persisted = $state<'yes' | 'no' | 'unsupported'>('unsupported');
  let usedKb = $state<number | null>(null);
  let perm = $state<Permission>(permission());
  let message = $state('');
  let messageAt = $state<'storage' | 'notifications' | 'haptics' | 'results'>('storage');
  let subscriptionJson = $state('');

  const records = $derived(entries.filter((e) => e.kind === 'record'));
  const pushes = $derived(entries.filter((e) => e.kind === 'push'));
  const oldest = $derived(records[0]);
  const habitDay = $derived(habitDayOf(new Date(), ctx.timeZone));
  const canVibrate = typeof navigator.vibrate === 'function';

  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const when = (iso: string) => fmt.format(new Date(iso));

  async function refresh() {
    ctx = runContext();
    entries = await listDiagnostics();
    perm = permission();
    if (navigator.storage?.persisted) persisted = (await navigator.storage.persisted()) ? 'yes' : 'no';
    if (navigator.storage?.estimate) {
      const { usage } = await navigator.storage.estimate();
      usedKb = usage === undefined ? null : Math.round(usage / 1024);
    }
  }

  const where = () => `${ctx.installed ? 'installed app' : 'browser tab'} · ${ctx.browser}`;

  async function saveRecord() {
    await addDiagnostic({ kind: 'record', at: new Date().toISOString(), installed: ctx.installed, browser: ctx.browser, note: `Test record ${records.length + 1}` });
    messageAt = 'storage';
    message = 'Saved. Now clear the browser’s data, then reopen ATOMIC from the Home Screen.';
    await refresh();
  }

  async function askToKeep() {
    messageAt = 'storage';
    if (!navigator.storage?.persist) { message = 'This browser can’t be asked to keep data.'; return; }
    const ok = await navigator.storage.persist();
    await addDiagnostic({ kind: 'persist', at: new Date().toISOString(), installed: ctx.installed, browser: ctx.browser, note: `persist() answered ${ok}` });
    message = ok ? 'iPhone agreed to keep ATOMIC’s data.' : 'iPhone didn’t promise to keep the data. The test still tells us what really happens.';
    await refresh();
  }

  async function allow() {
    messageAt = 'notifications';
    perm = await askPermission();
    message = perm === 'granted' ? 'Notifications allowed.' : 'Notifications not allowed. You can change this in iPhone Settings.';
  }

  async function localNotification() {
    await showLocalTest();
    await addDiagnostic({ kind: 'notification', at: new Date().toISOString(), installed: ctx.installed, browser: ctx.browser, note: 'Local test notification shown' });
    await refresh();
  }

  async function subscribePush() {
    messageAt = 'notifications';
    try {
      subscriptionJson = JSON.stringify(await subscribe());
      message = 'Subscribed. Send the results so the test push can be scheduled.';
    } catch (e) {
      message = `Couldn’t subscribe: ${(e as Error).message}`;
    }
  }

  function vibrate() {
    messageAt = 'haptics';
    const ok = canVibrate && navigator.vibrate(60);
    message = ok ? 'Vibration ran. Did you feel it?' : 'No vibration on this iPhone browser (expected on iOS).';
  }

  function resultsText() {
    return [
      'ATOMIC build test 0',
      `Version ${__APP_VERSION__} · built ${__BUILT_AT__}`,
      `Running as: ${where()}`,
      `Time zone: ${ctx.timeZone} · habit day ${habitDay}`,
      `Records: ${records.length}${oldest ? ` · oldest ${oldest.at} (${oldest.installed ? 'installed' : 'tab'}, ${oldest.browser})` : ''}`,
      `Kept by iOS: ${persisted} · space used: ${usedKb ?? '?'} KB`,
      `Notifications: ${perm} · push supported: ${pushSupported()} · push arrivals: ${pushes.length}${pushes.at(-1) ? ` · last ${pushes.at(-1)!.at}` : ''}`,
      `Vibration API: ${canVibrate}`,
      `User agent: ${navigator.userAgent}`,
      subscriptionJson ? `Subscription: ${subscriptionJson}` : '',
      '',
      ...entries.map((e) => `${e.at} · ${e.kind} · ${e.installed === null ? 'sw' : e.installed ? 'installed' : 'tab'} · ${e.browser} · ${e.note}`),
    ].filter((l, i) => l !== '' || i > 9).join('\n');
  }

  async function share() {
    messageAt = 'results';
    const text = resultsText();
    try {
      if (navigator.share) await navigator.share({ title: 'ATOMIC build test 0', text });
      else { await navigator.clipboard.writeText(text); message = 'Results copied.'; }
    } catch { /* share sheet dismissed */ }
  }

  onMount(() => {
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });
</script>

{#snippet status(section: typeof messageAt)}
  {#if message && messageAt === section}<p class="t-body-small message" role="status">{message}</p>{/if}
{/snippet}

<main class="screen">
  <header>
    <img class="wordmark" src={wordmark} alt="ATOMIC" />
    <h1 class="t-heading-large">Build test 0</h1>
    <p class="t-body-small lede">Checks that your data and notifications survive on this iPhone. A test tool, not the app yet.</p>
  </header>

  {#if !ctx.installed}
    <aside class="banner" role="note">
      <p class="t-body-strong">Install first</p>
      <p class="t-body-small">
        {#if ctx.browser === 'DuckDuckGo'}Tap the menu, then Add to Home Screen.
        {:else if ctx.browser === 'Chrome'}Tap Share, then Add to Home Screen.
        {:else}Tap Share, then Add to Home Screen.{/if}
        Open ATOMIC from the Home Screen. Records saved in a browser tab don’t count (031).
      </p>
    </aside>
  {/if}

  <SectionLabel text="This copy" />
  <KvRow label="Running as" value={ctx.installed ? 'Installed app' : 'Browser tab'} tone={ctx.installed ? 'done' : 'warn'} />
  <KvRow label="Browser" value={ctx.browser} />
  <KvRow label="Time zone" value={ctx.timeZone} />
  <KvRow label="Habit day now" value={habitDay} />
  <KvRow label="Version" value={__APP_VERSION__} tone="muted" />

  <SectionLabel text="Storage" />
  <KvRow label="Test records" value={String(records.length)} />
  <KvRow label="Oldest record" value={oldest ? when(oldest.at) : 'None yet'} tone={oldest ? 'default' : 'muted'} />
  <KvRow label="Kept by iOS" value={persisted === 'unsupported' ? 'Can’t tell' : persisted === 'yes' ? 'Yes' : 'Not promised'} tone={persisted === 'yes' ? 'done' : 'muted'} />
  <KvRow label="Space used" value={usedKb === null ? 'Can’t tell' : `${usedKb} KB`} tone="muted" />
  <div class="actions">
    <Button onclick={saveRecord}>Save a test record</Button>
    <Button variant="secondary" onclick={askToKeep}>Ask iPhone to keep data</Button>
  </div>
  {@render status('storage')}
  {#if records.length}
    <ol class="log">
      {#each records.slice(-5).reverse() as r (r.id)}
        <li class="t-body-small"><span class="t-number-small">{when(r.at)}</span> · {r.installed ? 'installed' : 'tab'} · {r.browser}</li>
      {/each}
    </ol>
  {/if}

  <SectionLabel text="Notifications" />
  <KvRow label="Permission" value={perm === 'granted' ? 'Allowed' : perm === 'denied' ? 'Denied' : perm === 'default' ? 'Not asked yet' : 'Not available'} tone={perm === 'granted' ? 'done' : perm === 'denied' ? 'warn' : 'muted'} />
  <KvRow label="Push supported" value={pushSupported() ? 'Yes' : 'No'} tone={pushSupported() ? 'done' : 'warn'} />
  <KvRow label="Pushes received" value={pushes.length ? `${pushes.length} · last ${when(pushes.at(-1)!.at)}` : 'None yet'} tone={pushes.length ? 'done' : 'muted'} />
  <div class="actions">
    {#if perm === 'default'}
      <Button onclick={allow} disabled={!ctx.installed}>Allow notifications</Button>
    {/if}
    <Button variant="secondary" onclick={localNotification} disabled={perm !== 'granted'}>Show a test notification</Button>
    <Button variant="secondary" onclick={subscribePush} disabled={perm !== 'granted' || !VAPID_PUBLIC_KEY}>Subscribe to push</Button>
    {#if !VAPID_PUBLIC_KEY}<p class="t-body-small hint">Push needs the push host (part B). Everything else can be tested now.</p>{/if}
  </div>
  {@render status('notifications')}

  <SectionLabel text="Haptics" />
  <KvRow label="Vibration API" value={canVibrate ? 'Available' : 'Not available'} tone="muted" />
  <div class="actions"><Button variant="secondary" onclick={vibrate}>Try vibration</Button></div>
  {@render status('haptics')}

  <SectionLabel text="Results" />
  <div class="actions"><Button variant="secondary" onclick={share}>Share results</Button></div>
  {@render status('results')}

  <SectionLabel text="Steps" />
  <ol class="steps t-body-small">
    <li>Install from Safari and open ATOMIC from the Home Screen. Save 2 records, ask iPhone to keep data.</li>
    <li>Do the same from DuckDuckGo (it installs a second copy).</li>
    <li>Clear the browsers: DuckDuckGo’s Fire button and automatic clearing; Safari’s Clear History and Website Data.</li>
    <li>Reopen each installed copy. The oldest record must still be there.</li>
    <li>Allow notifications and show a test notification.</li>
    <li>Wait a day, reopen, then tap Share results and send them to Claude.</li>
  </ol>
</main>

<style>
  header { display: grid; gap: var(--space-8); padding-bottom: var(--space-16); }
  .wordmark { height: var(--space-20); width: auto; justify-self: start; margin-bottom: var(--space-16); }
  .lede, .hint, .message { color: var(--text-secondary); }
  .banner {
    display: grid; gap: var(--space-4);
    padding: var(--space-12) var(--space-16);
    border-left: var(--space-4) solid var(--action-primary);
  }
  .actions { display: grid; gap: var(--space-8); padding: var(--space-16) 0 var(--space-8); }
  .log { display: grid; gap: var(--space-4); color: var(--text-secondary); padding-bottom: var(--space-8); }
  .message { padding-bottom: var(--space-8); color: var(--text-primary); }
  .steps { list-style: decimal; padding-left: var(--space-20); display: grid; gap: var(--space-8); color: var(--text-secondary); }
</style>
