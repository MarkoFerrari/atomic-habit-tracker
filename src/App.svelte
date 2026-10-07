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
  import type { Tab } from './ui/TabBar.svelte';
  import { isInstalled } from './data/context';
  import { getSettings } from './data/settings';
  import { getEvent } from './data/events';
  import type { CalendarEvent } from './data/schema';
  import { expand, type AgendaItem } from './domain/agenda';
  import { addDays, type IsoDay } from './domain/day';

  type View = 'loading' | 'gallery' | 'build-test' | 'onboarding' | 'import' | 'app' | 'recap';
  type Pushed =
    | { kind: 'event'; item: AgendaItem; from: Tab }
    | { kind: 'new'; day: IsoDay }
    | { kind: 'edit'; event: CalendarEvent; item: AgendaItem };
  type CalMode = 'day' | 'week' | 'month';

  let view = $state<View>('loading');
  let tab = $state<Tab>('today');
  let stack = $state.raw<Pushed[]>([]); // raw: events go back to IndexedDB, which can't store Svelte proxies
  let calDay = $state<IsoDay | undefined>();
  let calMode = $state<CalMode>('day');
  const top = $derived(stack.at(-1) ?? null);
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
{:else if view === 'onboarding'}<Onboarding ondone={() => { view = 'app'; tab = 'today'; }} />
{:else if view === 'import'}<Onboarding from="bring" ondone={() => { view = 'app'; tab = 'today'; }} />
{:else if view === 'recap'}<Recap onclose={closeRecap} />
{:else if view === 'app'}
  {#if top?.kind === 'event'}
    {#key top}
      <EventDetail item={top.item} backLabel={top.from === 'today' ? 'Today' : 'Calendar'} onback={pop}
        onedit={(event) => (stack = [...stack, { kind: 'edit', event, item: top.item }])}
        onchanged={() => { stack = []; }} />
    {/key}
  {:else if top?.kind === 'new'}
    <EventEditor mode={{ kind: 'new', day: top.day }} oncancel={pop} onsaved={saved} />
  {:else if top?.kind === 'edit'}
    <EventEditor mode={{ kind: 'edit', event: top.event, item: top.item }} oncancel={pop} onsaved={saved} />
  {:else if tab === 'calendar'}
    <Calendar initialDay={calDay} initialMode={calMode} ontab={(t) => (tab = t)}
      onview={(d, m) => { calDay = d; calMode = m; }}
      onopen={(item) => (stack = [{ kind: 'event', item, from: 'calendar' }])}
      onnew={(day) => (stack = [{ kind: 'new', day }])} />
  {:else}
    <Today ontab={(t) => (tab = t)} onchoosecalendar={() => (view = 'import')} onrecap={() => (view = 'recap')} />
  {/if}
{/if}
