<script lang="ts">
  // About (H41's last row; the screen isn't designed: 074). The version, and the short privacy note
  // the build spec asks for before a friend installs (§11): what stays on the phone, what the push
  // function holds.
  import TopBar from '../../ui/TopBar.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import KvRow from '../../ui/KvRow.svelte';

  let { onback }: { onback: () => void } = $props();
  const built = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(__BUILT_AT__));
</script>

<main class="screen about">
  <TopBar type="navigation" title="" leftLabel="Settings" onleft={onback} />
  <h1 class="t-heading-large">About</h1>
  <KvRow label="Version" value={__APP_VERSION__} />
  <KvRow label="Built" value={built} />
  <SectionLabel text="Privacy" />
  <p class="t-body-default">Your calendars, habits and answers live only on this phone. There’s no account, no analytics and no third-party requests.</p>
  <p class="t-body-default">One server sends the notifications: a small function in Paris (Scaleway). It keeps this phone’s push address, its time zone and a list of upcoming reminder times. Each reminder’s text is encrypted on this phone with a key that never leaves it, so the server can’t read it.</p>
  <p class="t-body-default">A backup is a file you save yourself, with the share sheet. It’s the only copy outside this phone.</p>
  <div class="spacer"></div>
  <p class="site t-body-default"><a href="https://markoferrari.eu" target="_blank" rel="noopener noreferrer">markoferrari.eu</a></p>
</main>

<style>
  .about { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .spacer { flex: 1; min-height: var(--space-48); }
  .site { text-align: center; }
  a { color: var(--text-accent); }
</style>
