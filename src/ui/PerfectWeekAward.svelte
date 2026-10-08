<script lang="ts">
  // The perfect-week award (Figma Playground W2, 109): after the day's star lands, the week's seven stars rise from
  // their cells in the strip and join into a constellation on the dark stage, with a quote (110). Once a week at most,
  // skippable with a tap. Transform and opacity only; every duration and curve is a token. Reduced motion: the
  // constellation and the words fade in, hold and fade out.
  import { onMount } from 'svelte';
  import AwardStar from './AwardStar.svelte';
  import { motionMs } from './motion';
  import type { Quote } from '../domain/quotes';

  interface Props {
    days: readonly string[]; // the week's days, Monday first; a star rises from each one's cell
    line: string; // "7 of 7 days · the 21st this year"
    quote: Quote;
    onend: () => void;
  }
  let { days, line, quote, onend }: Props = $props();

  // Seven stars in the shape of the Plough, the seven stars everyone knows (x, y in a 1 × 0.56 box). The last is today.
  const SHAPE = [[0, 0], [0.24, 0.05], [0.45, 0.13], [0.62, 0.26], [0.63, 0.49], [0.96, 0.54], [1, 0.28]] as const;
  const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] as const;

  let stage: HTMLElement, links: SVGSVGElement, words: HTMLElement;
  let starEls: HTMLElement[] = $state([]);
  let anims: Animation[] = [];
  let finished = false;

  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ease = (name: string) => css(`--motion-easing-${name}`) || 'ease';
  const px = (name: string) => parseFloat(css(`--space-${name}`)) || 0;
  // The constellation's box, measured once, before the first paint, so the stars are in place when the motion starts.
  const box = (() => {
    const w = Math.min(innerWidth - px('48') * 2, px('64') * 5);
    return { x: (innerWidth - w) / 2, y: innerHeight * 0.26, w, h: w * 0.56 };
  })();
  const point = (i: number) => ({ x: box.x + SHAPE[i]![0] * box.w, y: box.y + SHAPE[i]![1] * box.w });

  function end() {
    if (finished) return;
    finished = true;
    for (const a of anims) a.cancel();
    onend();
  }

  onMount(() => {
    const reduced = typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const A = (el: Element, kf: Keyframe[], delay: number, duration: number, easing: string) => {
      if (typeof el.animate !== 'function') return; // no Web Animations (tests): the timer still ends it
      anims.push(el.animate(kf, { delay, duration: Math.max(1, duration), easing: ease(easing), fill: 'forwards' }));
    };
    const instant = motionMs('instant'), fast = motionMs('fast'), base = motionMs('base'), slow = motionMs('slow'), hold = motionMs('hold');
    words.style.top = `${box.y + box.h + px('48')}px`;

    if (reduced) {
      for (const el of [stage, links, words, ...starEls]) A(el, [{ opacity: 0 }, { opacity: 1 }], 0, fast, 'standard');
      const out = fast + hold * 2;
      for (const el of [stage, links, words, ...starEls]) A(el, [{ opacity: 1 }, { opacity: 0 }], out, fast, 'standard');
      const t = setTimeout(end, out + fast);
      return () => { clearTimeout(t); anims.forEach((a) => a.cancel()); };
    }

    // 1 · the stage darkens; each star rises from its cell in the strip and takes its place (enter, 50 ms apart)
    A(stage, [{ opacity: 0 }, { opacity: 1 }], 0, base, 'standard');
    starEls.forEach((el, i) => {
      const cell = document.querySelector(`[data-strip-day="${days[i]}"]`)?.getBoundingClientRect();
      const p = point(i);
      const from = cell ? `translate(${cell.left + cell.width / 2 - p.x}px, ${cell.top + cell.height / 2 - p.y}px) scale(0.85)` : 'scale(0.4)';
      A(el, [{ opacity: cell ? 1 : 0, transform: from }, { opacity: 1, transform: 'none' }], base + (i * instant) / 2, slow, 'enter');
    });
    // 2 · the lines appear, then the words (the quote needs time: two holds)
    const joined = base + slow + 3 * instant;
    A(links, [{ opacity: 0 }, { opacity: 1 }], joined, base, 'standard');
    A(words, [{ opacity: 0, transform: `translateY(${px('8')}px)` }, { opacity: 1, transform: 'none' }], joined + instant / 2, base, 'enter');
    // 3 · hold, then everything leaves together
    const out = joined + base + hold * 2;
    for (const el of [stage, links, words, ...starEls]) A(el, [{ opacity: 1 }, { opacity: 0 }], out, base, 'exit');
    const t = setTimeout(end, out + base);
    return () => { clearTimeout(t); anims.forEach((a) => a.cancel()); };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="award" onclick={end}>
  <p class="sr" role="status">Perfect week. {line.replace(' · ', '. ')}. {quote.text} {quote.source}.</p>
  <div class="stage" bind:this={stage}></div>
  <svg class="links" bind:this={links} aria-hidden="true">
    {#if box.w > 0}
      {#each LINKS as [a, b] (`${a}-${b}`)}
        <line x1={point(a).x} y1={point(a).y} x2={point(b).x} y2={point(b).y} />
      {/each}
    {/if}
  </svg>
  {#if box.w > 0}
    {#each SHAPE as _, i (i)}
      <span class="star" class:today={i === 6} bind:this={starEls[i]} style:left="{point(i).x}px" style:top="{point(i).y}px" aria-hidden="true">
        <AwardStar size="ring" />
      </span>
    {/each}
  {/if}
  <div class="words" bind:this={words} aria-hidden="true">
    <p class="t-heading-medium">Perfect week</p>
    <p class="t-body-default">{line}</p>
    <figure>
      <blockquote class="t-heading-small">“{quote.text}”</blockquote>
      <figcaption class="t-label-small source">{quote.source}</figcaption>
    </figure>
  </div>
</div>

<style>
  .award { position: fixed; inset: 0; z-index: 10; cursor: pointer; }
  .sr { position: absolute; width: var(--stroke-hairline); height: var(--stroke-hairline); overflow: hidden; clip-path: inset(50%); }
  .stage { position: absolute; inset: 0; background: var(--bg-stage); opacity: 0; }
  .links { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; }
  line { stroke: var(--award-facet-light); stroke-width: var(--stroke-icon); stroke-linecap: round; opacity: 0.7; }
  .star { position: absolute; translate: -50% -50%; opacity: 0; }
  .star.today { scale: 1.25; }
  .words { position: absolute; left: var(--layout-gutter); right: var(--layout-gutter); display: grid; gap: var(--space-8); justify-items: center;
    text-align: center; color: var(--text-inverse); opacity: 0; }
  figure { display: grid; gap: var(--space-4); margin: var(--space-16) 0 0; }
  blockquote { margin: 0; }
  .source { opacity: 0.72; }
</style>
