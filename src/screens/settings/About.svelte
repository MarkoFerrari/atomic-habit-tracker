<script lang="ts">
  // About (H41's last row; the screen isn't designed: 074). The version, and the short privacy note
  // the build spec asks for before a friend installs (§11): what stays on the phone, what the push
  // function holds.
  import TopBar from '../../ui/TopBar.svelte';

  let { onback }: { onback: () => void } = $props();
  const built = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(__BUILT_AT__));
</script>

<main class="screen about">
  <TopBar type="navigation" title="" leftLabel="Settings" onleft={onback} />
  <h1 class="t-heading-large">About</h1>
  <section class="card brand">
    <img src="{import.meta.env.BASE_URL}icons/icon-192.png" alt="" />
    <p class="t-body-strong">ATOMIC {__APP_VERSION__}</p>
    <p class="t-body-small secondary">Small habits, kept. Built {built}.</p>
  </section>
  <section class="card privacy">
    <h2 class="t-label-section secondary">Privacy</h2>
    <p class="t-body-small">Your habits, reminders and answers live only on this phone. There’s no account, no analytics and no third-party requests.</p>
    <p class="t-body-small">One server sends the notifications: a small function in Paris (Scaleway). It keeps this phone’s push address, its time zone and a list of upcoming reminder times. Each reminder’s text is encrypted on this phone with a key that never leaves it, so the server can’t read it.</p>
    <p class="t-body-small">A backup is a file you save yourself, with the share sheet. It’s the only copy outside this phone.</p>
  </section>
  <div class="card-list">
    <p class="site"><span class="t-body-default">Licences</span><span class="t-body-small secondary">Geist (OFL), Lucide (ISC)</span></p>
    <a class="site" href="https://markoferrari.eu" target="_blank" rel="noopener noreferrer"><span class="t-body-default">Website</span><span class="t-body-small secondary">markoferrari.eu</span></a>
  </div>
</main>

<style>
  .about { display: flex; flex-direction: column; gap: var(--space-12); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .brand { display: grid; justify-items: center; gap: var(--space-4); padding: var(--space-24) var(--space-16); text-align: center; }
  .brand img { width: var(--space-64); height: var(--space-64); border-radius: var(--radius-tile); margin-bottom: var(--space-8); box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-divider); }
  .privacy { display: grid; gap: var(--space-8); }
  .site { display: flex; align-items: center; justify-content: space-between; gap: var(--space-12); min-height: var(--size-control); padding: var(--space-12) 0; color: var(--text-primary); text-decoration: none; }
  .secondary { color: var(--text-secondary); }
</style>
