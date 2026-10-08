<script lang="ts">
  // The perfect-day award (Figma page 14, section 03; 093, 094). When the last habit of the day is done, a gold star
  // turns in at the centre on a dark stage, holds for a breath, then shrinks into today's cell of the week strip.
  // About 2.7 s, once a day, skippable with a tap. Transform and opacity only; every duration and curve is a token.
  // Reduced motion: no scale, turn or flight. The star and the words fade in, hold, fade out; the cell's star fades in.
  import { onMount } from 'svelte';
  import AwardStar from './AwardStar.svelte';
  import { motionMs } from './motion';

  interface Props {
    from: DOMRect | null; // the ring, where the star rises from
    target: () => DOMRect | null; // today's cell, where it lands (read at flight time: the page may have moved)
    line: string; // "3 of 3 done · 3 this week"
    onlanded: () => void; // the star is now the cell: show it there, bump the cell, put the small star in the ring
    onend: () => void;
  }
  let { from, target, line, onlanded, onend }: Props = $props();

  let stage: HTMLElement, flyX: HTMLElement, flyY: HTMLElement, enter: HTMLElement, scaler: HTMLElement, turn: HTMLElement, band: HTMLElement, words: HTMLElement;
  let sparkEls: HTMLElement[] = $state([]);
  const SPARKS = [[-1, -0.7, 22], [0.95, -0.85, 18], [1.1, 0.35, 14], [-1.15, 0.45, 16], [0.2, -1.2, 12], [-0.35, 1.1, 12]] as const;
  let anims: Animation[] = [];
  let landed = false;
  let finished = false;

  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ms = (name: string) => motionMs(name);
  const ease = (name: string) => css(`--motion-easing-${name}`) || 'ease';

  function land() {
    if (landed) return;
    landed = true;
    onlanded();
  }
  function end() {
    if (finished) return;
    finished = true;
    land();
    for (const a of anims) a.cancel();
    onend();
  }
  /** A tap skips to the landing (094). */
  function skip() { end(); }

  onMount(() => {
    const reduced = typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = innerWidth, H = innerHeight;
    const CX = W / 2, CY = H * 0.47;
    flyX.style.left = `${CX}px`; flyX.style.top = `${CY}px`;
    const A = (el: Element, kf: Keyframe[], delay: number, duration: number, easing: string) => {
      if (typeof el.animate !== 'function') return null; // no Web Animations (tests): the timers still land it
      const a = el.animate(kf, { delay, duration: Math.max(1, duration), easing: ease(easing), fill: 'forwards' });
      anims.push(a);
      return a;
    };
    const instant = ms('instant'), fast = ms('fast'), base = ms('base'), slow = ms('slow'), celebrate = ms('celebrate'), hold = ms('hold');
    const px = (name: string) => parseFloat(css(`--space-${name}`)) || 0;
    const rise = px('8'), drift = px('16'); // the words rise 8; sparks drift 16 (Figma page 14, K3)
    words.style.top = `${CY + scaler.offsetWidth / 2 + px('24')}px`;

    if (reduced) {
      const t1 = fast + hold;
      A(stage, [{ opacity: 0 }, { opacity: 1 }], 0, fast, 'standard');
      A(turn, [{ opacity: 0 }, { opacity: 1 }], 0, fast, 'standard');
      A(words, [{ opacity: 0 }, { opacity: 1 }], 0, fast, 'standard');
      for (const el of [stage, turn, words]) A(el, [{ opacity: 1 }, { opacity: 0 }], t1, fast, 'standard');
      setTimeout(() => { land(); }, t1 + fast);
      setTimeout(end, t1 + fast * 2);
      return () => anims.forEach((a) => a.cancel());
    }

    // 1 · the stage darkens (250), the star turns in from the ring (250 → 850)
    A(stage, [{ opacity: 0 }, { opacity: 1 }], base, base, 'standard');
    const sx = from ? from.left + from.width / 2 - CX : 0;
    const sy = from ? from.top + from.height / 2 - CY : 0;
    A(enter, [{ transform: `translate(${sx}px, ${sy}px)` }, { transform: 'translate(0, 0)' }], base, celebrate, 'enter');
    A(turn, [{ opacity: 0, transform: 'scale(0.6) rotateY(70deg)' }, { opacity: 1, offset: 0.3 }, { opacity: 1, transform: 'scale(1) rotateY(0deg)' }], base, celebrate, 'spring');
    // 2 · one shine, six sparks, the words (850 → 1150)
    const settle = base + celebrate;
    A(band, [{ transform: 'translateX(-200%) rotate(20deg)' }, { transform: 'translateX(700%) rotate(20deg)' }], settle, slow, 'standard');
    sparkEls.forEach((el, i) => {
      const [dx, dy] = SPARKS[i]!;
      const t = settle + i * instant * 0.3;
      const mid = `translate(${dx * drift * 0.6}px, ${dy * drift * 0.6}px) scale(1)`;
      A(el, [{ opacity: 0, transform: 'translate(0, 0) scale(0)' }, { opacity: 1, transform: mid }], t, fast, 'enter');
      A(el, [{ opacity: 1, transform: mid }, { opacity: 0, transform: `translate(${dx * drift}px, ${dy * drift}px) scale(0.6)` }], t + fast + base, base, 'exit');
    });
    A(words, [{ opacity: 0, transform: `translateY(${rise}px)` }, { opacity: 1, transform: 'none' }], settle + instant / 2, base, 'enter');
    // 3 · hold, then into the week (2050 → 2450): x on standard, y on exit, so the path curves
    const fly = settle + hold;
    A(words, [{ opacity: 1 }, { opacity: 0 }], fly, fast, 'exit');
    A(stage, [{ opacity: 1 }, { opacity: 0 }], fly, base, 'standard');
    const flight = setTimeout(() => {
      const t = target();
      const tx = t ? t.left + t.width / 2 - CX : 0;
      const ty = t ? t.top + t.height / 2 - CY : H / 2;
      const size = t ? t.width * 0.875 : px('24');
      A(flyX, [{ transform: 'translateX(0)' }, { transform: `translateX(${tx}px)` }], 0, slow, 'standard');
      A(flyY, [{ transform: 'translateY(0)' }, { transform: `translateY(${ty}px)` }], 0, slow, 'exit');
      A(scaler, [{ transform: 'scale(1)' }, { transform: `scale(${size / scaler.offsetWidth})` }], 0, slow, 'standard');
    }, fly);
    // 4 · landed: the star becomes the cell (2450), the overlay leaves after the bump
    const landing = setTimeout(() => { flyX.style.opacity = '0'; land(); }, fly + slow);
    const done = setTimeout(end, fly + slow + fast * 2);
    return () => { clearTimeout(flight); clearTimeout(landing); clearTimeout(done); anims.forEach((a) => a.cancel()); };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="award" onclick={skip}>
  <p class="sr" role="status">Perfect day. {line.replace(' · ', '. ')}.</p>
  <div class="stage" bind:this={stage}></div>
  <div class="fly-x" bind:this={flyX}><div class="fly-y" bind:this={flyY}><div class="enter" bind:this={enter}>
    <div class="scaler" bind:this={scaler}><div class="persp"><div class="turn" bind:this={turn}>
      <AwardStar size="hero" />
      <span class="shine" aria-hidden="true"><span class="band" bind:this={band}></span></span>
    </div></div></div>
  </div></div></div>
  {#each SPARKS as s, i (i)}
    <span class="spark" class:gold={i % 2 === 1} bind:this={sparkEls[i]} style:--x={s[0]} style:--y={s[1]} style:width="{s[2]}px" style:height="{s[2]}px" aria-hidden="true">
      <svg viewBox="0 0 16 16"><path d="M8 0 9.6 6.4 16 8 9.6 9.6 8 16 6.4 9.6 0 8 6.4 6.4Z" /></svg>
    </span>
  {/each}
  <div class="words" bind:this={words} aria-hidden="true">
    <p class="t-heading-medium">Perfect day</p>
    <p class="t-body-default">{line}</p>
  </div>
</div>

<style>
  .award { position: fixed; inset: 0; z-index: 10; cursor: pointer; }
  .sr { position: absolute; width: var(--stroke-hairline); height: var(--stroke-hairline); overflow: hidden; clip-path: inset(50%); }
  .stage { position: absolute; inset: 0; background: var(--bg-stage); opacity: 0; }
  .fly-x, .fly-y, .enter { position: absolute; left: 0; top: 0; width: 0; height: 0; }
  .fly-y, .enter { position: absolute; inset: 0; }
  .scaler { position: absolute; width: calc(var(--space-64) * 2 + var(--space-32)); height: calc(var(--space-64) * 2 + var(--space-32));
    left: calc((var(--space-64) + var(--space-16)) * -1); top: calc((var(--space-64) + var(--space-16)) * -1); }
  .persp { perspective: calc(var(--space-64) * 10); width: 100%; height: 100%; }
  .turn { position: relative; width: 100%; height: 100%; opacity: 0; }
  .shine { position: absolute; inset: 0; overflow: hidden; clip-path: polygon(50% 2%, 64% 32%, 96% 36%, 72% 60%, 79% 94%, 50% 77%, 21% 94%, 28% 60%, 4% 36%, 36% 32%); }
  .band { position: absolute; top: -10%; left: 0; width: 12%; height: 120%; transform: translateX(-200%) rotate(20deg);
    background: linear-gradient(90deg, transparent, var(--bg-default), transparent); opacity: 0.55; }
  .spark { position: absolute; left: calc(50% + var(--x) * 6rem); top: calc(47% + var(--y) * 6rem); translate: -50% -50%; opacity: 0; }
  .spark svg { width: 100%; height: 100%; fill: var(--celebrate-spark); }
  .spark.gold svg { fill: var(--award-facet-light); }
  .words { position: absolute; left: 0; right: 0; text-align: center; color: var(--text-inverse); opacity: 0; display: grid; gap: var(--space-8); }
</style>
