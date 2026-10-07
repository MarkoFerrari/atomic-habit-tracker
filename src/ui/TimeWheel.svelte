<script lang="ts">
  // P5: two scrollable columns, hours and minutes. The row in the middle is the choice; a tap on any row picks it too.
  // Scroll-snap does the physics, so it feels like the iPhone's own wheel. Reports "HH:MM" on every change.
  import { onMount } from 'svelte';
  interface Props { hours: number[]; minutes: number[]; value: string; onchange: (value: string) => void }
  let { hours, minutes, value, onchange }: Props = $props();

  const pad = (n: number) => String(n).padStart(2, '0');
  const hour = $derived(Number(value.slice(0, 2)));
  const minute = $derived(Number(value.slice(3, 5)));
  let hourEl: HTMLUListElement;
  let minuteEl: HTMLUListElement;

  function place(el: HTMLElement | undefined, index: number, smooth: boolean) {
    const item = el?.firstElementChild as HTMLElement | null;
    if (!el || !item || index < 0) return;
    const top = index * item.offsetHeight;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
    else el.scrollTop = top;
  }
  function setup() { place(hourEl, hours.indexOf(hour), false); place(minuteEl, minutes.indexOf(minute), false); }
  onMount(() => { setup(); const id = requestAnimationFrame(setup); return () => cancelAnimationFrame(id); }); // again once a sheet has its size

  function read(el: HTMLUListElement, list: number[]): number {
    const item = el.firstElementChild as HTMLElement | null;
    if (!item || !item.offsetHeight) return list[0]!;
    return list[Math.min(list.length - 1, Math.max(0, Math.round(el.scrollTop / item.offsetHeight)))]!;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  function scrolled() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = `${pad(read(hourEl, hours))}:${pad(read(minuteEl, minutes))}`;
      if (next !== value) onchange(next);
    }, 80); // wait for the snap to settle
  }
  function pick(h: number, m: number, el: HTMLElement, list: number[], n: number) {
    onchange(`${pad(h)}:${pad(m)}`);
    place(el, list.indexOf(n), true);
  }
</script>

<div class="wheel" role="group" aria-label="Time">
  <span class="band" aria-hidden="true"></span>
  <ul bind:this={hourEl} onscroll={scrolled} aria-label="Hours">
    {#each hours as h (h)}
      <li><button type="button" class="t-number-large" aria-pressed={h === hour} aria-label="{h} hours" onclick={() => pick(h, minute, hourEl, hours, h)}>{pad(h)}</button></li>
    {/each}
  </ul>
  <span class="t-number-large colon" aria-hidden="true">:</span>
  <ul bind:this={minuteEl} onscroll={scrolled} aria-label="Minutes">
    {#each minutes as m (m)}
      <li><button type="button" class="t-number-large" aria-pressed={m === minute} aria-label="{m} minutes" onclick={() => pick(hour, m, minuteEl, minutes, m)}>{pad(m)}</button></li>
    {/each}
  </ul>
</div>

<style>
  .wheel { position: relative; display: flex; justify-content: center; align-items: center; gap: var(--space-16); }
  .band { position: absolute; left: 0; right: 0; top: 50%; height: var(--space-48); transform: translateY(-50%); background: var(--bg-subtle); border-radius: var(--radius-control); pointer-events: none; }
  ul {
    position: relative; height: calc(var(--space-48) * 3); overflow-y: auto; scroll-snap-type: y mandatory; scrollbar-width: none;
    padding: var(--space-48) 0; box-sizing: border-box; /* one row of room above and below, so the first and last can reach the middle */
    min-width: var(--space-64);
  }
  ul::-webkit-scrollbar { display: none; }
  li { height: var(--space-48); scroll-snap-align: center; }
  button { width: 100%; height: 100%; color: var(--text-tertiary); text-align: center; }
  button[aria-pressed='true'] { color: var(--text-primary); }
  .colon { color: var(--text-primary); }
</style>
