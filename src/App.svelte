<script lang="ts">
  // Which screen opens. The installed app is the product (058): a browser tab never saves anything (031).
  // Root tabs (Today, Calendar) show the tab bar; pushed screens (event detail, the editor) hide it (044).
  // #gallery and #build-test stay reachable for review and device tests.
  import { onMount } from 'svelte';
  import BuildTest from './screens/build-test/BuildTest.svelte';
  import Gallery from './screens/gallery/Gallery.svelte';
  import Onboarding from './screens/onboarding/Onboarding.svelte';
  import Today from './screens/today/Today.svelte';
  import Recap from './screens/recap/Recap.svelte';
  import Calendar from './screens/calendar/Calendar.svelte';
  import EventDetail from './screens/calendar/EventDetail.svelte';
  import EventEditor from './screens/calendar/EventEditor.svelte';
  import Stats from './screens/stats/Stats.svelte';
  import HabitDetail from './screens/stats/HabitDetail.svelte';
  import Badges from './screens/stats/Badges.svelte';
  import WeeklyRecap from './screens/stats/WeeklyRecap.svelte';
  import Settings from './screens/settings/Settings.svelte';
  import Habits from './screens/settings/Habits.svelte';
  import Notifications from './screens/settings/Notifications.svelte';
  import Data from './screens/settings/Data.svelte';
  import About from './screens/settings/About.svelte';
  import Calendars from './screens/settings/Calendars.svelte';
  import CalendarEditor from './screens/settings/CalendarEditor.svelte';
  import ImportPreview from './screens/settings/ImportPreview.svelte';
  import RestorePreview from './screens/settings/RestorePreview.svelte';
  import type { SettingsScreen } from './screens/settings/screens';
  import type { BackupPreview } from './data/restore';
  import type { IcsCalendar } from './data/ics';
  import type { Tab } from './ui/tabs';
  import { isInstalled } from './data/context';
  import { getSettings } from './data/settings';
  import { getEvent } from './data/events';
  import type { Calendar as CalendarRecord, CalendarEvent } from './data/schema';
  import { expand, type AgendaItem } from './domain/agenda';
  import { addDays, habitDayOf, type IsoDay } from './domain/day';
  import { ensureHabitCalendar } from './data/calendars';

  type View = 'loading' | 'gallery' | 'build-test' | 'onboarding' | 'import' | 'app' | 'recap';
  type Pushed =
    | { kind: 'event'; item: AgendaItem; from: Tab }
    | { kind: 'new'; day: IsoDay; habit?: boolean }
    | { kind: 'edit'; event: CalendarEvent; item: AgendaItem }
    | { kind: 'duplicate'; event: CalendarEvent; item: AgendaItem }
    | { kind: 'habit'; eventId: string; from: string }
    | { kind: 'badges' }
    | { kind: 'week-recap'; weekStart: IsoDay }
    | { kind: 'settings'; screen: SettingsScreen }
    | { kind: 'calendar-edit'; calendar: CalendarRecord | null }
    | { kind: 'import'; ics: IcsCalendar; fileName: string }
    | { kind: 'restore'; preview: BackupPreview; fileName: string; from: 'onboarding' | 'data' };
  type CalMode = 'day' | 'week' | 'month';

  let view = $state<View>('loading');
  let tab = $state<Tab>('today');
  let stack = $state.raw<Pushed[]>([]); // raw: events go back to IndexedDB, which can't store Svelte proxies
  let calDay = $state<IsoDay | undefined>();
  let calMode = $state<CalMode>('day');
  let statsMode = $state<'week' | 'month' | 'year'>('week');
  let statsMonth = $state<IsoDay | undefined>();
  const top = $derived(stack.at(-1) ?? null);
  let notice = $state(''); // one line for Calendars after an import
  const push = (p: Pushed) => { stack = [...stack, p]; };
  function restored() { stack = []; view = 'app'; tab = 'today'; }
  async function newHabit() {
    await ensureHabitCalendar();
    stack = [{ kind: 'new', day: habitDayOf(new Date(), zone), habit: true }];
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

  /** A reminder push carries `${eventId}|${occurrence}`; it opens that occurrence (H29). */
  async function openTag(tag: string) {
    const [id, occurrence] = tag.split('|') as [string, IsoDay];
    const event = id ? await getEvent(id) : undefined;
    if (!event || !occurrence) return;
    const item = expand(event, addDays(occurrence, -1), addDays(occurrence, 2), zone).find((i) => i.occurrence === occurrence);
    if (!item) return;
    tab = 'calendar';
    calDay = item.start.slice(0, 10) as IsoDay;
    stack = [{ kind: 'event', item, from: 'calendar' }];
  }

  function closeRecap() {
    if (location.hash === '#recap') clearHash();
    view = 'app';
    tab = 'today';
  }

  const pop = () => { stack = stack.slice(0, -1); };
  function saved(day: IsoDay) {
    // After a save the calendar shows the day the event is on; detail screens above the editor are stale.
    calDay = day;
    stack = [];
    tab = 'calendar';
  }

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
{:else if view === 'import'}<Onboarding from="bring" ondone={() => { view = 'app'; tab = 'today'; }} />
{:else if view === 'recap'}<Recap onclose={closeRecap} />
{:else if view === 'app'}
  {#if top?.kind === 'event'}
    {#key top}
      <EventDetail item={top.item} backLabel={top.from === 'today' ? 'Today' : 'Calendar'} onback={pop}
        onedit={(event) => (stack = [...stack, { kind: 'edit', event, item: top.item }])}
        onduplicate={(event) => (stack = [...stack, { kind: 'duplicate', event, item: top.item }])}
        onchanged={() => { stack = []; }} />
    {/key}
  {:else if top?.kind === 'habit'}
    {#key top}<HabitDetail eventId={top.eventId} backLabel={top.from} onback={pop} />{/key}
  {:else if top?.kind === 'badges'}
    <Badges onback={pop} onhabit={(eventId) => push({ kind: 'habit', eventId, from: 'Badges' })} />
  {:else if top?.kind === 'week-recap'}
    <WeeklyRecap weekStart={top.weekStart} onback={pop} onhabit={(eventId) => push({ kind: 'habit', eventId, from: 'Recap' })} />
  {:else if top?.kind === 'new'}
    <EventEditor mode={{ kind: 'new', day: top.day, habit: top.habit }} oncancel={pop} onsaved={saved} />
  {:else if top?.kind === 'duplicate'}
    <EventEditor mode={{ kind: 'duplicate', event: top.event, item: top.item }} oncancel={pop} onsaved={saved} />
  {:else if top?.kind === 'edit'}
    <EventEditor mode={{ kind: 'edit', event: top.event, item: top.item }} oncancel={pop} onsaved={saved} />
  {:else if top?.kind === 'settings' && top.screen === 'habits'}<Habits onback={pop} />
  {:else if top?.kind === 'settings' && top.screen === 'notifications'}<Notifications onback={pop} />
  {:else if top?.kind === 'settings' && top.screen === 'about'}<About onback={pop} />
  {:else if top?.kind === 'settings' && top.screen === 'data'}
    <Data onback={pop} onrestore={(preview, fileName) => push({ kind: 'restore', preview, fileName, from: 'data' })} />
  {:else if top?.kind === 'settings' && top.screen === 'calendars'}
    <Calendars onback={() => { notice = ''; pop(); }} {notice}
      onedit={(calendar) => { notice = ''; push({ kind: 'calendar-edit', calendar }); }}
      onimport={(ics, fileName) => { notice = ''; push({ kind: 'import', ics, fileName }); }} />
  {:else if top?.kind === 'calendar-edit'}
    <CalendarEditor calendar={top.calendar} oncancel={pop} ondone={pop} />
  {:else if top?.kind === 'import'}
    <ImportPreview ics={top.ics} fileName={top.fileName} oncancel={pop} ondone={(summary) => { notice = summary; pop(); }} />
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
  {:else if tab === 'calendar'}
    <Calendar initialDay={calDay} initialMode={calMode} ontab={(t) => (tab = t)}
      onview={(d, m) => { calDay = d; calMode = m; }}
      onopen={(item) => (stack = [{ kind: 'event', item, from: 'calendar' }])}
      onnew={(day) => (stack = [{ kind: 'new', day }])} />
  {:else}
    <Today ontab={(t) => (tab = t)} onnewhabit={newHabit} onimport={() => (view = 'import')} onrecap={() => (view = 'recap')} />
  {/if}
{/if}
