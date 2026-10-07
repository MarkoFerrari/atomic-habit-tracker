<script lang="ts">
  // H41 Settings (Figma 54:2971): the F2/F7 entry. Set once, rarely visited. Data shows the age of the
  // last backup (R7).
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import TabBar from '../../ui/TabBar.svelte';
  import { READY_TABS, type Tab } from '../../ui/tabs';
  import { db } from '../../data/db';
  import { getSettings } from '../../data/settings';
  import { permission, pushDevice } from '../../push/notifications';
  import { activeHabits } from '../../data/habits';
  import { backupAge } from '../../domain/format';
  import type { SettingsScreen } from './screens';

  interface Props { ontab?: (tab: Tab) => void; onopen: (screen: SettingsScreen) => void }
  let { ontab, onopen }: Props = $props();

  let calendars = $state('');
  let habits = $state('');
  let notifications = $state('');
  let data = $state('');

  onMount(async () => {
    const [cals, settings, device, active] = await Promise.all([(await db()).count('calendars'), getSettings(), pushDevice(), activeHabits()]);
    calendars = String(cals);
    habits = `${active.active.length} active`;
    notifications = permission() !== 'granted' || !device.subscribedAt ? 'Off' : settings.recapPush ? 'On · 22:30' : 'On';
    data = backupAge(settings.lastBackupAt, new Date());
  });
</script>

<div class="page">
  <main class="screen settings">
    <TopBar eyebrow="Everything stays on this phone" title="Settings" />
    <ListRow icon="calendar" label="Calendars" value={calendars} onclick={() => onopen('calendars')} />
    <ListRow icon="check" label="Habits" value={habits} onclick={() => onopen('habits')} />
    <ListRow icon="bell" label="Notifications" value={notifications} onclick={() => onopen('notifications')} />
    <ListRow icon="upload" label="Data" value={data} onclick={() => onopen('data')} />
    <ListRow icon="info" label="About" onclick={() => onopen('about')} />
    <div class="spacer"></div>
    <p class="t-body-small note">No account, no analytics, no third-party requests. A backup file is the only copy outside this phone.</p>
  </main>
  <TabBar active="settings" ready={READY_TABS} onselect={ontab} />
</div>

<style>
  .page { min-height: 100dvh; display: flex; flex-direction: column; }
  .settings { flex: 1; display: flex; flex-direction: column; gap: var(--space-8); padding-bottom: var(--space-16); }
  .spacer { flex: 1; }
  .note { color: var(--text-tertiary); }
  .page :global(nav) { position: sticky; bottom: 0; }
</style>
