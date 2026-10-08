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
  import HabitDetail from './screens/stats/HabitDetail.svelte';
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

  type View = 'loading' | 'gallery' | 'build-test' | 'onboarding' | 'app' | 'recap';
  type Pushed =
    | { kind: 'new-habit' }
    | { kind: 'edit'; event: CalendarEvent; item: AgendaItem }
    | { kind: 'habit'; eventId: string; from: string }
    | { kind: 'badges' }
    | { kind: 'week-recap'; weekStart: IsoDay }
    | { kind: 'settings'; screen: SettingsScreen }
    | { kind: 'restore'; preview: BackupPreview; fileName: string; from: 'onboarding' | 'data' };

  let view = $state<View>('loading');
  let tab = $state<Tab>('today');
  let stack = $state.raw<Pushed[]>([]); // raw: events go back to IndexedDB, which can't store Svelte proxies
  let statsMode = $state<'week' | 'month' | 'year'>('week');
  let habitsMode = $state<HabitsMode>('list');
  let statsMonth = $state<IsoDay | undefined>();
  const top = $derived(stack.at(-1) ?? null);
  const push = (p: Pushed) => { stack = [...stack, p]; };
  function restored() { stack = []; view = 'app'; tab = 'today'; }
  function newHabit() { stack = [...stack, { kind: 'new-habit' }]; } // E1: makes the HABITS calendar if missing (079)
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
    const done = (await getSettings()).onboardingDone;
    if (!done) { view = 'onboarding'; return; }
    if (location.hash === '#recap') { view = 'recap'; return; }
    view = 'app';
    const m = /^#event=(.+)$/.exec(location.hash);
    if (m) { clearHash(); await openTag(decodeURIComponent(m[1]!)); }
  }

  function clearHash() { history.replaceState(null, '', location.pathname + location.search); }

  /** A reminder push carries `${eventId}|${occurrence}`: a habit's push opens Today, where it is answered (069, 104). */
  async function openTag(_tag: string) {
    tab = 'today';
    stack = [];
  }

  function closeRecap() {
    if (location.hash === '#recap') clearHash();
    view = 'app';
    tab = 'today';
  }

  const pop = () => { stack = stack.slice(0, -1); };
  function saved() { stack = []; } // screens above the editor are stale after a save

  onMount(() => {
    route();
    addEventListener('hashchange', route);
    const onMessage = (e: MessageEvent) => {
      if (view === 'onboarding') return;
      if (e.data?.type === 'open-recap') view = 'recap';
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
{:else if view === 'onboarding'}<Onboarding ondone={() => { view = 'app'; tab = 'today'; }}
  onrestore={(preview, fileName) => (stack = [{ kind: 'restore', preview, fileName, from: 'onboarding' }])} />
{:else if view === 'recap'}<Recap onclose={closeRecap} />
{:else if view === 'app'}
  {#if top?.kind === 'habit'}
    {#key top}<HabitDetail eventId={top.eventId} backLabel={top.from} onback={pop} onedit={editHabit} />{/key}
  {:else if top?.kind === 'badges'}
    <Badges onback={pop} onhabit={(eventId) => push({ kind: 'habit', eventId, from: 'Badges' })} />
  {:else if top?.kind === 'week-recap'}
    <WeeklyRecap weekStart={top.weekStart} onback={pop} onhabit={(eventId) => push({ kind: 'habit', eventId, from: 'Recap' })} />
  {:else if top?.kind === 'new-habit'}
    <NewHabit oncancel={pop} onsaved={() => { stack = []; }} />
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
      onhabit={(eventId) => push({ kind: 'habit', eventId, from: 'Habits' })} onnew={newHabit} />
  {:else}
    <Today ontab={(t) => (tab = t)} onnewhabit={newHabit} onrecap={() => (view = 'recap')}
      onbadges={() => push({ kind: 'badges' })} />
  {/if}
{/if}
