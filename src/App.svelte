<script lang="ts">
  // Which screen opens. The installed app is the product (058): a browser tab never saves anything (031).
  // #gallery and #build-test stay reachable for review and device tests.
  import { onMount } from 'svelte';
  import BuildTest from './screens/build-test/BuildTest.svelte';
  import Gallery from './screens/gallery/Gallery.svelte';
  import Onboarding from './screens/onboarding/Onboarding.svelte';
  import Today from './screens/today/Today.svelte';
  import Recap from './screens/recap/Recap.svelte';
  import { isInstalled } from './data/context';
  import { getSettings } from './data/settings';

  type View = 'loading' | 'gallery' | 'build-test' | 'onboarding' | 'import' | 'today' | 'recap';
  let view = $state<View>('loading');

  async function route() {
    if (location.hash === '#gallery') { view = 'gallery'; return; }
    if (location.hash === '#build-test') { view = 'build-test'; return; }
    // M2 slice 2: in a browser tab the build test (with its install banner) stays until H02/H03 are built.
    if (!isInstalled() && import.meta.env.PROD) { view = 'build-test'; return; }
    const done = (await getSettings()).onboardingDone;
    // The 22:30 push opens the app at #recap (sw.js); the recap is built here from local data (025).
    view = !done ? 'onboarding' : location.hash === '#recap' ? 'recap' : 'today';
  }

  function closeRecap() {
    if (location.hash === '#recap') history.replaceState(null, '', location.pathname + location.search);
    view = 'today';
  }

  onMount(() => {
    route();
    addEventListener('hashchange', route);
    // A tap on the recap notification while the app is already open (sw.js posts this).
    const onMessage = (e: MessageEvent) => { if (e.data?.type === 'open-recap' && view !== 'onboarding') view = 'recap'; };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => { removeEventListener('hashchange', route); navigator.serviceWorker?.removeEventListener('message', onMessage); };
  });
</script>

{#if view === 'gallery'}<Gallery />
{:else if view === 'build-test'}<BuildTest />
{:else if view === 'onboarding'}<Onboarding ondone={() => (view = 'today')} />
{:else if view === 'import'}<Onboarding from="bring" ondone={() => (view = 'today')} />
{:else if view === 'today'}<Today onchoosecalendar={() => (view = 'import')} onrecap={() => (view = 'recap')} />
{:else if view === 'recap'}<Recap onclose={closeRecap} />
{/if}
