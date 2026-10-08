<script lang="ts">
  // E2 Settings (Figma page 14, section 05; was H41): three groups, 40 apart (092). Your own events stay in Proton,
  // Google or Outlook: showing them is an optional view (097), on by default only when events from other calendars
  // are already on this phone. Your data shows the age of the last backup (R7).
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import TabBar from '../../ui/TabBar.svelte';
  import { READY_TABS, type Tab } from '../../ui/tabs';
  import { db } from '../../data/db';
  import { getSettings, updateSettings } from '../../data/settings';
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
  let showEvents = $state(false);
  const version = __APP_VERSION__;

  onMount(async () => {
    const database = await db();
    const [cals, settings, device, active, all] = await Promise.all([database.getAll('calendars'), getSettings(), pushDevice(), activeHabits(), database.getAll('events')]);
    calendars = String(cals.length);
    const habitCals = new Set(cals.filter((c) => c.trackAsHabits).map((c) => c.id));
    showEvents = settings.showEvents ?? all.some((e) => !habitCals.has(e.calendarId));
    habits = `${active.active.length} active`;
    notifications = permission() !== 'granted' || !device.subscribedAt ? 'Off' : settings.recapPush ? 'At each start · 22:30' : 'At each start';
    data = backupAge(settings.lastBackupAt, new Date());
  });
  async function setShow(on: boolean) { showEvents = on; await updateSettings({ showEvents: on }); }
</script>

<div class="page">
  <main class="screen settings">
    <TopBar eyebrow="ATOMIC {version}" title="Settings" />
    <section class="group">
      <ListRow icon="sprout" label="Habits" value={habits} onclick={() => onopen('habits')} />
      <ListRow icon="bell" label="Notifications" value={notifications} onclick={() => onopen('notifications')} />
    </section>
    <section class="group">
      <ListRow type="toggle" icon="calendar" label="Show my events" on={showEvents} onchange={setShow} />
      {#if showEvents}
        <ListRow label="Calendar" value="Day, week, month" onclick={() => onopen('calendar')} />
        <ListRow label="Calendars and import" value={calendars} onclick={() => onopen('calendars')} />
      {/if}
      <p class="t-label-small note">Optional. Import an .ics file to see your meetings beside your habits.</p>
    </section>
    <section class="group">
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
  .group .note { padding-top: var(--space-8); }
  .spacer { flex: 1; }
  .note { color: var(--text-tertiary); }
  .page :global(nav) { position: sticky; bottom: 0; }
</style>
