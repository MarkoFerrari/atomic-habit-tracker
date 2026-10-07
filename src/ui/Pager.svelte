<script lang="ts" generics="K extends string">
  // A row of full-width pages that scrolls one page at a time and snaps, like the day strip and the time wheels (089).
  // The parent says which page is current and how to find the one before or after; the pager keeps a few pages
  // either side so the next one is already there under the finger, and plays a soft tick at every page.
  import { onMount, tick as afterRender, untrack, type Snippet } from 'svelte';
  import { tick as sound, unlockTick } from './tick';

  interface Props {
    current: K;
    neighbour: (key: K, steps: number) => K;
    onchange: (key: K) => void;
    label: string;
    children: Snippet<[K]>;
  }
  let { current, neighbour, onchange, label, children }: Props = $props();

  const SPAN = 3; // pages kept either side of the anchor
  let anchor = $state(untrack(() => current));
  const pages = $derived(Array.from({ length: SPAN * 2 + 1 }, (_, i) => neighbour(anchor, i - SPAN)));
  let el: HTMLDivElement;
  let scrolling = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastIndex = -1;

  const centre = (key: K) => {
    const i = pages.indexOf(key);
    const w = el?.clientWidth ?? 0;
    if (i < 0 || !w) return;
    lastIndex = i;
    el.scrollLeft = i * w;
  };

  onMount(() => { centre(current); const id = requestAnimationFrame(() => centre(current)); return () => { cancelAnimationFrame(id); clearTimeout(timer); }; });

  // The current page changed from outside (the segmented control, a tap on a day): bring it in.
  $effect(() => {
    const key = current;
    untrack(() => {
      if (scrolling || !el) return;
      if (pages.indexOf(key) < 0) anchor = key;
      void afterRender().then(() => centre(key));
    });
  });

  function onscroll() {
    const w = el.clientWidth;
    if (!w) return;
    const i = Math.min(pages.length - 1, Math.max(0, Math.round(el.scrollLeft / w)));
    if (i !== lastIndex) {
      lastIndex = i;
      scrolling = true;
      sound();
      onchange(pages[i]!);
    }
    clearTimeout(timer);
    timer = setTimeout(settle, 120);
  }
  function settle() {
    scrolling = false;
    if (lastIndex === SPAN || lastIndex < 0) return;
    const key = pages[lastIndex]!; // the new centre: same page, so nothing visibly moves
    anchor = key;
    void afterRender().then(() => centre(key));
  }
</script>

<div class="pager" bind:this={el} {onscroll} onpointerdown={unlockTick} role="group" aria-label={label}>
  {#each pages as key (key)}
    <div class="page" inert={key !== current}>{@render children(key)}</div>
  {/each}
</div>

<style>
  .pager { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain; touch-action: pan-x pan-y; }
  .pager::-webkit-scrollbar { display: none; }
  .page { flex: 0 0 100%; min-width: 0; scroll-snap-align: start; scroll-snap-stop: always; }
</style>
