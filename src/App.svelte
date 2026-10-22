<script lang="ts">
  // Which screen opens. The installed app is the product (058): a browser tab never saves anything (031).
  // Root tabs (Today, Habits, Stats, Settings; 097 habits first) show the tab bar; pushed screens hide it (044).
  // 104: the Calendar, its event screens and the .ics import left the app; the code stays in the repo, unrouted.
  // #gallery and #build-test stay reachable for review and device tests.
  import { onMount } from 'svelte';
  import BuildTest from './screens/build-test/BuildTest.svelte';
  import Gallery from './screens/gallery/Gallery.svelte';
  import Onboarding from './screens/onboarding/Onboarding.svelte';
  import Today from './screens/today/Today.svelte';
  import Recap from './screens/recap/Recap.svelte';
  import EventEditor from './screens/calendar/EventEditor.svelte';
  import Stats from './screens/stats/Stats.svelte';
  import HabitsTab, { type HabitsMode } from './screens/habits/HabitsTab.svelte';
  import NewHabit from './screens/habits/NewHabit.svelte';
  import Suggestions from './screens/habits/Suggestions.svelte';
  import ReminderCard from './screens/habits/ReminderCard.svelte';
  import { draftFrom } from './data/suggestions';
  import type { HabitDraft } from './data/newHabit';
  import HabitDetail from './screens/stats/HabitDetail.svelte';
  import ReminderDetail from './screens/habits/ReminderDetail.svelte';
  import type { TimedReminder } from './data/schema';
  import Badges from './screens/stats/Badges.svelte';
  import WeeklyRecap from './screens/stats/WeeklyRecap.svelte';
  import Settings from './screens/settings/Settings.svelte';
  import Habits from './screens/settings/Habits.svelte';
  import Notifications from './screens/settings/Notifications.svelte';
  import Data from './screens/settings/Data.svelte';
  import About from './screens/settings/About.svelte';
  import RestorePreview from './screens/settings/RestorePreview.svelte';
  import type { SettingsScreen } from './screens/settings/screens';
  import type { BackupPreview } from './data/restore';
  import type { Tab } from './ui/tabs';
  import { isInstalled } from './data/context';
  import { getSettings } from './data/settings';
  import { getEvent } from './data/events';
  import type { CalendarEvent } from './data/schema';
  import { expand, type AgendaItem } from './domain/agenda';
  import { addDays, habitDayOf, type IsoDay } from './domain/day';
  import Toast from './ui/Toast.svelte';
  import WhatsNew from './ui/WhatsNew.svelte';
  import { updateSettings } from './data/settings';
  import { joinSplitHabits, restoreHabit, type DeletedHabit } from './data/habits';
  import { syncReminders } from './push/reminders';

  type View = 'loading' | 'gallery' | 'build-test' | 'onboarding' | 'app' | 'recap';
  type Pushed =
    | { kind: 'suggest' }
    | { kind: 'new-habit'; prefill?: HabitDraft }
    | { kind: 'nudge'; id: string }
    | { kind: 'reminder'; id: string; from: string }
    | { kind: 'edit-reminder'; reminder: TimedReminder }
    | { kind: 'edit'; event: CalendarEvent; item: AgendaItem }
    | { kind: 'habit'; eventId: string; from: string }
    | { kind: 'badges' }
    | { kind: 'week-recap'; weekStart: IsoDay }
    | { kind: 'settings'; screen: SettingsScreen }
    | { kind: 'restore'; preview: BackupPreview; fileName: string; from: 'onboarding' | 'data' };

  let view = $state<View>('loading');
  let whatsNew = $state(false);
  function seenNews() { whatsNew = false; void updateSettings({ whatsNewSeen: __APP_VERSION__ }); }
  let tab = $state<Tab>('today');
  let stack = $state.raw<Pushed[]>([]); // raw: events go back to IndexedDB, which can't store Svelte proxies
  let statsMode = $state<'week' | 'month' | 'year'>('week');
  let habitsMode = $state<HabitsMode>('list');
  let statsMonth = $state<IsoDay | undefined>();
  const top = $derived(stack.at(-1) ?? null);
  const push = (p: Pushed) => { stack = [...stack, p]; };
  function restored() { stack = []; view = 'app'; tab = 'today'; }
  function newHabit() { stack = [...stack, { kind: 'suggest' }]; } // 136: suggestions first; E1 follows, and makes the HABITS calendar if missing (079)
  /** H4 Edit: the full editor (H30) on the habit's next occurrence, so repeats and past answers are handled (E16). */
  async function editHabit(eventId: string) {
    const event = await getEvent(eventId);
    if (!event) return;
    const today = habitDayOf(new Date(), zone);
    const item = expand(event, today, addDays(today, 60), zone).sort((a, b) => a.occurrence.localeCompare(b.occurrence))[0];
    if (item) push({ kind: 'edit', event, item });
  }
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function route() {
    if (location.hash === '#gallery') { view = 'gallery'; return; }
    if (location.hash === '#build-test') { view = 'build-test'; return; }
    // In a browser tab the build test (with its install banner) stays until H02/H03 are built.
    if (!isInstalled() && import.meta.env.PROD) { view = 'build-test'; return; }
    const settings = await getSettings();
    if (!settings.onboardingDone) { view = 'onboarding'; return; }
    // 131: a phone that ran an earlier version sees what's new once; a fresh install has nothing to compare
    whatsNew = settings.whatsNewSeen !== __APP_VERSION__;
    await joinSplitHabits().catch(() => 0); // 115: once per phone, before any screen reads runs
    if (location.hash === '#recap') { view = 'recap'; return; }
    view = 'app';
    const m = /^#event=(.+)$/.exec(location.hash);
    if (m) { clearHash(); await openTag(decodeURIComponent(m[1]!)); }
    const n = /^#nudge=(.+)$/.exec(location.hash);
    if (n) { clearHash(); openNudge(decodeURIComponent(n[1]!)); }
  }

  function clearHash() { history.replaceState(null, '', location.pathname + location.search); }

  /** A reminder push carries `${eventId}|${occurrence}`: a habit's push opens Today, where it is answered (069, 104). */
  async function openTag(_tag: string) {
    tab = 'today';
    stack = [];
  }

  /** 134: a reminder's push opens its own card, not Today. Close goes to Today. */
  function openNudge(id: string) {
    tab = 'today';
    stack = [{ kind: 'nudge', id }];
  }

  function closeRecap() {
    if (location.hash === '#recap') clearHash();
    view = 'app';
    tab = 'today';
  }

  const pop = () => { stack = stack.slice(0, -1); };

  // 112: a deleted habit leaves its detail at once; the toast keeps Undo for toast-hold (5 s). `refresh` remounts
  // the screen underneath after an Undo, so the habit shows again.
  let deleted = $state.raw<DeletedHabit | null>(null);
  let refresh = $state(0);
  function habitDeleted(d: DeletedHabit) { pop(); deleted = d; }
  async function undoDelete() {
    if (!deleted) return;
    await restoreHabit(deleted);
    syncReminders().catch(() => {});
    refresh++;
  }
  function saved() { stack = []; } // screens above the editor are stale after a save

  onMount(() => {
    route();
    addEventListener('hashchange', route);
    const onMessage = (e: MessageEvent) => {
      if (view === 'onboarding') return;
      if (e.data?.type === 'open-recap') view = 'recap';
      if (e.data?.type === 'open-nudge' && typeof e.data.id === 'string') { view = 'app'; openNudge(e.data.id); }
      if (e.data?.type === 'open-event' && typeof e.data.tag === 'string') { view = 'app'; void openTag(e.data.tag); }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => { removeEventListener('hashchange', route); navigator.serviceWorker?.removeEventListener('message', onMessage); };
  });
</script>

{#if view === 'gallery'}<Gallery />
{:else if view === 'build-test'}<BuildTest />
{:else if view === 'onboarding' && top?.kind === 'restore'}
  <RestorePreview preview={top.preview} fileName={top.fileName} oncancel={() => (stack = [])} ondone={restored} />
{:else if view === 'onboarding'}<Onboarding ondone={() => { view = 'app'; tab = 'today'; void updateSettings({ whatsNewSeen: __APP_VERSION__ }); }}
  onrestore={(preview, fileName) => (stack = [{ kind: 'restore', preview, fileName, from: 'onboarding' }])} />
{:else if view === 'recap'}<Recap onclose={closeRecap} />
{:else if view === 'app'}
  {#key refresh}
  {#if top?.kind === 'habit'}
    {#key top}<HabitDetail eventId={top.eventId} backLabel={top.from} onback={pop} onedit={editHabit} ondeleted={habitDeleted} />{/key}
  {:else if top?.kind === 'reminder'}
    {#key top}<ReminderDetail id={top.id} backLabel={top.from} onback={pop} onedit={(reminder) => push({ kind: 'edit-reminder', reminder })} />{/key}
  {:else if top?.kind === 'edit-reminder'}
    <NewHabit reminder={top.reminder} oncancel={pop} onsaved={() => { stack = stack.slice(0, -2); }} />
  {:else if top?.kind === 'badges'}
    <Badges onback={pop} onhabit={(eventId) => push({ kind: 'habit', eventId, from: 'Badges' })} />
  {:else if top?.kind === 'week-recap'}
    <WeeklyRecap weekStart={top.weekStart} onback={pop} onhabit={(eventId) => push({ kind: 'habit', eventId, from: 'Recap' })} />
  {:else if top?.kind === 'nudge'}
    <ReminderCard id={top.id} onclose={() => { stack = []; tab = 'today'; }} />
  {:else if top?.kind === 'suggest'}
    <Suggestions onback={pop} onpick={(s) => push({ kind: 'new-habit', prefill: draftFrom(s) })} onblank={() => push({ kind: 'new-habit' })} />
  {:else if top?.kind === 'new-habit'}
    {#key top}<NewHabit prefill={top.prefill} oncancel={pop} onsaved={() => { stack = []; }} />{/key}
  {:else if top?.kind === 'edit'}
    <EventEditor mode={{ kind: 'edit', event: top.event, item: top.item }} oncancel={pop} onsaved={saved} />
  {:else if top?.kind === 'settings' && top.screen === 'habits'}<Habits onback={pop} />
  {:else if top?.kind === 'settings' && top.screen === 'notifications'}<Notifications onback={pop} />
  {:else if top?.kind === 'settings' && top.screen === 'about'}<About onback={pop} />
  {:else if top?.kind === 'settings' && top.screen === 'data'}
    <Data onback={pop} onrestore={(preview, fileName) => push({ kind: 'restore', preview, fileName, from: 'data' })} />
  {:else if top?.kind === 'restore'}
    <RestorePreview preview={top.preview} fileName={top.fileName} oncancel={pop} ondone={restored} />
  {:else if tab === 'settings'}
    <Settings ontab={(t) => (tab = t)} onopen={(screen) => push({ kind: 'settings', screen })} />
  {:else if tab === 'stats'}
    <Stats ontab={(t) => (tab = t)} initialMode={statsMode} initialMonth={statsMonth}
      onview={(m, month) => { statsMode = m; statsMonth = month; }}
      onhabit={(eventId) => push({ kind: 'habit', eventId, from: 'Stats' })}
      onbadges={() => push({ kind: 'badges' })}
      onrecap={(weekStart) => push({ kind: 'week-recap', weekStart })} />
  {:else if tab === 'habits'}
    <HabitsTab ontab={(t) => (tab = t)} initialMode={habitsMode} onview={(m) => (habitsMode = m)}
      onhabit={(eventId) => push({ kind: 'habit', eventId, from: 'Habits' })} onnew={newHabit}
      onreminder={(id) => push({ kind: 'reminder', id, from: 'Habits' })} />
  {:else}
    <Today ontab={(t) => (tab = t)} onnewhabit={newHabit} onrecap={() => (view = 'recap')}
      onbadges={() => push({ kind: 'badges' })} onnotifications={() => push({ kind: 'settings', screen: 'notifications' })}
      onreminder={(id) => push({ kind: 'reminder', id, from: 'Today' })} />
  {/if}
  {/key}
  <WhatsNew open={whatsNew && !stack.length} version={__APP_VERSION__} onclose={seenNews} />
  {#if deleted}
    {#key deleted}
      <div class="toast-slot">
        <Toast message="{deleted.event.title} deleted" onaction={undoDelete} ondismiss={() => (deleted = null)} />
      </div>
    {/key}
  {/if}
{/if}

<style>
  .toast-slot {
    position: fixed; left: var(--layout-gutter); right: var(--layout-gutter); z-index: 1;
    bottom: calc(max(env(safe-area-inset-bottom), var(--space-12)) + var(--space-64) + var(--space-16)); /* above the tab bar, as on Today (H12) */
  }
</style>
