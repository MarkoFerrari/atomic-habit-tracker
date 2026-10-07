<script lang="ts">
  // The day strip in Calendar Day view (Figma 33:176), scrolling one day at a time. Seven days are visible and the
  // one in the middle is the chosen day: it changes as the strip passes under it, with a soft tick, and the strip
  // snaps to a day when the finger lifts, like the time wheels. A tap on a day brings it to the middle (089).
  import { onMount, tick as afterRender, untrack } from 'svelte';
  import DatePill from './DatePill.svelte';
  import { tick as sound, unlockTick } from './tick';
  import { addDays, type IsoDay } from '../domain/day';
  import { fullDate, weekdayShort } from '../domain/format';

  interface Props { selected: IsoDay; today: IsoDay; onselect: (day: IsoDay) => void; onsettle?: () => void }
  let { selected, today, onselect, onsettle }: Props = $props();

  const SPAN = 120; // days kept either side of the anchor; the anchor moves when the strip travels far
  let anchor = $state(untrack(() => selected));
  const days = $derived(Array.from({ length: SPAN * 2 + 1 }, (_, i) => addDays(anchor, i - SPAN)));
  let el: HTMLDivElement;
  let scrolling = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastIndex = -1;

  const width = () => (el?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
  const indexOf = (day: IsoDay) => days.indexOf(day);

  function centre(day: IsoDay, smooth = false) {
    const w = width();
    const i = indexOf(day);
    if (!w || i < 0) return;
    lastIndex = i;
    if (smooth && typeof el.scrollTo === 'function') el.scrollTo({ left: i * w, behavior: 'smooth' });
    else el.scrollLeft = i * w;
  }

  onMount(() => { centre(selected); const id = requestAnimationFrame(() => centre(selected)); return () => { cancelAnimationFrame(id); clearTimeout(timer); }; });

  // The chosen day changed from outside (a swipe on the timeline, New event, a month tap): bring it to the middle.
  $effect(() => {
    const day = selected;
    untrack(() => {
      if (scrolling || !el) return;
      if (indexOf(day) < 0) anchor = day; // far away: move the window, then centre
      void afterRender().then(() => centre(day));
    });
  });

  function onscroll() {
    const w = width();
    if (!w) return;
    const i = Math.min(days.length - 1, Math.max(0, Math.round(el.scrollLeft / w)));
    if (i !== lastIndex) {
      lastIndex = i;
      scrolling = true;
      sound();
      onselect(days[i]!);
    }
    clearTimeout(timer);
    timer = setTimeout(settle, 120);
  }
  function settle() {
    scrolling = false;
    const i = lastIndex;
    if (Math.abs(i - SPAN) > SPAN / 2) { // moved far from the anchor: re-anchor without a visible jump
      const day = days[i]!;
      anchor = day;
      void afterRender().then(() => centre(day));
    }
    onsettle?.();
  }
  function choose(day: IsoDay) { onselect(day); centre(day, true); }
</script>

<div class="frame">
<div class="strip" bind:this={el} {onscroll} onpointerdown={unlockTick} role="group" aria-label="Days">
  {#each days as d (d)}
    <div class="item">
      <DatePill weekday={weekdayShort(d)} day={d.slice(8, 10)} selected={d === selected} today={d === today} label={fullDate(d)} onclick={() => choose(d)} />
    </div>
  {/each}
</div>
</div>

<style>
  .frame { container-type: inline-size; }
  .strip {
    display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; touch-action: pan-x;
    padding-inline: calc(100cqw / 7 * 3); /* three days of room each side, so the first and last can reach the middle */
    overscroll-behavior-x: contain;
  }
  .strip::-webkit-scrollbar { display: none; }
  .item { flex: 0 0 calc(100cqw / 7); display: grid; justify-items: center; scroll-snap-align: center; }
</style>
