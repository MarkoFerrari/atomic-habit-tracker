<script lang="ts">
  // E2 Settings (Figma page 14, section 05; was H41): one list, every row the same distance apart (111). Your own events stay in Proton,
  // Google or Outlook: the Calendar and the .ics import left the app (104). Your data shows the age of the last
  // backup (R7).
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import TabBar from '../../ui/TabBar.svelte';
  import { READY_TABS, type Tab } from '../../ui/tabs';
  import { getSettings } from '../../data/settings';
  import { permission, pushDevice } from '../../push/notifications';
  import { activeHabits } from '../../data/habits';
  import { backupAge } from '../../domain/format';
  import type { SettingsScreen } from './screens';

  interface Props { ontab?: (tab: Tab) => void; onopen: (screen: SettingsScreen) => void }
  let { ontab, onopen }: Props = $props();

  let habits = $state('');
  let notifications = $state('');
  let data = $state('');
  const version = __APP_VERSION__;

  onMount(async () => {
    const [settings, device, active] = await Promise.all([getSettings(), pushDevice(), activeHabits()]);
    habits = `${active.active.length} active`;
    notifications = permission() !== 'granted' || !device.subscribedAt ? 'Off' : settings.recapPush ? 'At each start · 22:30' : 'At each start';
    data = backupAge(settings.lastBackupAt, new Date());
  });
</script>

<div class="page">
  <main class="screen settings">
    <TopBar eyebrow="ATOMIC {version}" title="Settings" />
    <section class="group">
      <ListRow icon="sprout" label="Habits" value={habits} onclick={() => onopen('habits')} />
      <ListRow icon="bell" label="Notifications" value={notifications} onclick={() => onopen('notifications')} />
      <ListRow icon="lock" label="Your data" value={data} onclick={() => onopen('data')} />
      <ListRow icon="info" label="About" onclick={() => onopen('about')} />
    </section>
    <div class="spacer"></div>
    <p class="t-label-small note">Everything stays on this phone. No account, no cloud, no analytics.</p>
  </main>
  <TabBar active="settings" ready={READY_TABS} onselect={ontab} />
</div>

<style>
  .page { min-height: 100dvh; display: flex; flex-direction: column; }
  .settings { flex: 1; display: flex; flex-direction: column; gap: var(--layout-block-gap); padding-bottom: var(--space-24); }
  .group { display: grid; }
  .spacer { flex: 1; }
  .note { color: var(--text-tertiary); }
  .page :global(nav) { position: sticky; bottom: 0; }
</style>
