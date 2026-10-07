<script lang="ts">
  // H48 Restore preview (Figma 55:3642): replace, never merge (026, R6). The preview shows what comes
  // back before anything is touched.
  import TopBar from '../../ui/TopBar.svelte';
  import Button from '../../ui/Button.svelte';
  import Banner from '../../ui/Banner.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { restoreBackup, type BackupPreview } from '../../data/restore';
  import { syncReminders } from '../../push/reminders';

  interface Props { preview: BackupPreview; fileName: string; oncancel: () => void; ondone: () => void }
  let { preview, fileName, oncancel, ondone }: Props = $props();

  const number = (n: number) => new Intl.NumberFormat('en-GB').format(n);
  const date = (iso: string) => (Number.isNaN(Date.parse(iso)) ? 'an unknown date'
    : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)));
  const short = (iso: string) => (Number.isNaN(Date.parse(iso)) ? 'it was made'
    : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(iso)));

  let busy = $state(false);
  let problem = $state('');
  async function replace() {
    busy = true; problem = '';
    try { await restoreBackup(preview); syncReminders().catch(() => {}); ondone(); }
    catch { problem = 'Couldn’t restore it. Nothing was changed. Try again.'; }
    finally { busy = false; }
  }
</script>

<main class="screen restore">
  <TopBar type="modal" title="Restore" leftLabel="Cancel" onleft={oncancel} />
  <div class="file">
    <Icon name="download" />
    <span class="text"><span class="t-body-strong block name">{fileName}</span><span class="t-body-small tertiary">Backup file</span></span>
  </div>
  <h1 class="t-heading-large">Restore this backup?</h1>
  <dl class="details">
    <div class="row"><dt class="t-body-default grow">Up to</dt><dd class="t-body-small secondary">{date(preview.exportedAt)}</dd></div>
    <div class="row"><dt class="t-body-default grow">Events</dt><dd class="t-number-small secondary">{number(preview.events)}</dd></div>
    <div class="row"><dt class="t-body-default grow">Answers</dt><dd class="t-number-small secondary">{number(preview.answers)}</dd></div>
    <div class="row"><dt class="t-body-default grow">Calendars</dt><dd class="t-number-small secondary">{number(preview.calendars)}</dd></div>
  </dl>
  <Banner message="This replaces everything on this phone. Anything added after {short(preview.exportedAt)} will be lost." />
  <div class="spacer"></div>
  {#if problem}<p class="t-body-small problem" role="alert">{problem}</p>{/if}
  <Button disabled={busy} onclick={replace}>Replace with this backup</Button>
  <Button variant="tertiary" onclick={oncancel}>Cancel</Button>
</main>

<style>
  .restore { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .file { display: flex; align-items: center; gap: var(--space-12); padding: var(--space-16); border-radius: var(--radius-control); background: var(--bg-subtle); }
  .text { flex: 1; min-width: 0; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .block { display: block; }
  .details { margin: 0; }
  .row { display: flex; align-items: center; gap: var(--space-16); padding: var(--space-12) 0; }
  .row + .row { border-top: var(--stroke-hairline) solid var(--border-divider); }
  dd { margin: 0; }
  .grow { flex: 1; min-width: 0; }
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }
  .problem { color: var(--text-accent); }
  .spacer { flex: 1; }
</style>
