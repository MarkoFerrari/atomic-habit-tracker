<script lang="ts">
  // E3 Your data (Figma page 14, section 05; was H47). No account, so the backup leads: it goes out through the
  // share sheet as one file (020); restore reads one back, after a preview (H48). The plain list of what leaves the
  // phone doubles as the privacy note (074). What's on this phone, in numbers.
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import Button from '../../ui/Button.svelte';
  import Banner from '../../ui/Banner.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { db } from '../../data/db';
  import { getSettings } from '../../data/settings';
  import { shareBackup } from '../../data/backup';
  import { readBackup, BackupError, type BackupPreview } from '../../data/restore';
  import { backupAge } from '../../domain/format';

  interface Props { onback: () => void; onrestore: (preview: BackupPreview, fileName: string) => void }
  let { onback, onrestore }: Props = $props();

  let last = $state('');
  let events = $state(0);
  let answers = $state(0);
  let storage = $state('–');
  let busy = $state(false);
  let problem = $state('');
  let input = $state<HTMLInputElement>();

  const number = (n: number) => new Intl.NumberFormat('en-GB').format(n);

  async function load() {
    const database = await db();
    const [settings, ev, ans] = await Promise.all([getSettings(), database.count('events'), database.count('answers')]);
    last = backupAge(settings.lastBackupAt, new Date(), '');
    events = ev;
    answers = ans;
    const estimate = await navigator.storage?.estimate?.().catch(() => null);
    if (estimate?.usage !== undefined) storage = `${(estimate.usage / 1_048_576).toFixed(1)} MB`;
  }
  onMount(load);

  async function backUp() {
    busy = true; problem = '';
    try { await shareBackup(); await load(); }
    catch { problem = 'Couldn’t make the backup. Try again.'; }
    finally { busy = false; }
  }
  async function pick(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!file) return;
    problem = '';
    try { onrestore(readBackup(await file.text()), file.name); }
    catch (err) { problem = err instanceof BackupError ? err.message : 'Couldn’t read that file. Try again.'; }
  }
</script>

<main class="screen data">
  <TopBar type="navigation" title="Your data" leftLabel="Settings" onleft={onback} />
  <section class="group">
    <h1 class="t-heading-small">Backup</h1>
    <p class="t-body-default secondary">One file with every habit, answer and medal. Keep it in Files or Proton Drive. Last backup: {last.toLowerCase()}.</p>
    <div class="actions">
      <Button icon="upload" disabled={busy} onclick={backUp}>Back up now</Button>
      <Button variant="secondary" icon="download" onclick={() => input?.click()}>Restore from a backup</Button>
    </div>
    <input bind:this={input} type="file" accept=".json,application/json" hidden onchange={pick} />
    {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
  </section>
  <section class="group tight">
    <SectionLabel text="What leaves this phone" />
    <ul class="leaves">
      <li><Icon name="check" /><span class="t-body-small secondary">The push address and your time zone, so nudges arrive on time.</span></li>
      <li><Icon name="check" /><span class="t-body-small secondary">Each reminder, encrypted here with a key the server never sees.</span></li>
      <li><Icon name="check" /><span class="t-body-small secondary">Nothing else. No account, no analytics, no third-party requests.</span></li>
    </ul>
  </section>
  <section class="group tight">
  <SectionLabel text="On this phone" />
  <dl class="details">
    <div class="row"><dt class="t-body-default grow">Events</dt><dd class="t-number-small secondary">{number(events)}</dd></div>
    <div class="row"><dt class="t-body-default grow">Answers</dt><dd class="t-number-small secondary">{number(answers)}</dd></div>
    <div class="row"><dt class="t-body-default grow">Storage</dt><dd class="t-number-small secondary">{storage}</dd></div>
  </dl>
  </section>
  <Banner message="Removing ATOMIC from the Home Screen deletes all of this. The backup file is your only other copy." />
</main>

<style>
  .data { display: flex; flex-direction: column; gap: var(--layout-block-gap); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .group { display: grid; gap: var(--space-16); }
  .group.tight { gap: 0; }
  .actions { display: grid; gap: var(--space-8); }
  .leaves { display: grid; gap: var(--space-12); }
  .leaves li { display: flex; align-items: flex-start; gap: var(--space-12); }
  .row { display: flex; align-items: center; gap: var(--space-16); min-height: var(--size-control); padding: var(--space-12) 0; }
  .details { margin: 0; }
  .details .row + .row { border-top: var(--stroke-hairline) solid var(--border-divider); }
  dd { margin: 0; }
  .grow { flex: 1; min-width: 0; }
  .secondary { color: var(--text-secondary); }
  .problem { color: var(--text-accent); }
</style>
