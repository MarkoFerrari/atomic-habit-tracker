<script lang="ts">
  // Which screen opens. The installed app is the product (058): a browser tab never saves anything (031).
  // #gallery and #build-test stay reachable for review and device tests.
  import { onMount } from 'svelte';
  import BuildTest from './screens/build-test/BuildTest.svelte';
  import Gallery from './screens/gallery/Gallery.svelte';
  import Onboarding from './screens/onboarding/Onboarding.svelte';
  import Today from './screens/today/Today.svelte';
  import { isInstalled } from './data/context';
  import { getSettings } from './data/settings';

  type View = 'loading' | 'gallery' | 'build-test' | 'onboarding' | 'import' | 'today';
  let view = $state<View>('loading');

  async function route() {
    if (location.hash === '#gallery') { view = 'gallery'; return; }
    if (location.hash === '#build-test') { view = 'build-test'; return; }
    // M2 slice 2: in a browser tab the build test (with its install banner) stays until H02/H03 are built.
    if (!isInstalled() && import.meta.env.PROD) { view = 'build-test'; return; }
    view = (await getSettings()).onboardingDone ? 'today' : 'onboarding';
  }

  onMount(() => {
    route();
    addEventListener('hashchange', route);
    return () => removeEventListener('hashchange', route);
  });
</script>

{#if view === 'gallery'}<Gallery />
{:else if view === 'build-test'}<BuildTest />
{:else if view === 'onboarding'}<Onboarding ondone={() => (view = 'today')} />
{:else if view === 'import'}<Onboarding from="bring" ondone={() => (view = 'today')} />
{:else if view === 'today'}<Today onchoosecalendar={() => (view = 'import')} />
{/if}
