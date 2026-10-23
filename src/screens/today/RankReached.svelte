<script lang="ts">
  // H5 Rank reached, Direction A (141). The biggest moment in ATOMIC, above the perfect-day star (093): a full
  // screen on the dark stage, the habit's medal turns in large, one shine, sparks, the rank's name, then the ladder
  // with the new rung lit. It opens only on the tap on "done" that reaches the rank, never on opening the app.
  // Transform and opacity only; every duration and curve is a token. Continue is the only way out.
  // Reduced motion: no scale, no turn; everything fades in.
  import { onMount } from 'svelte';
  import RankMedal from '../../ui/RankMedal.svelte';
  import Button from '../../ui/Button.svelte';
  import type { IconName } from '../../ui/icons';
  import { RANKS } from '../../domain/ranks';
  import { plural, shortName } from '../../domain/format';
  import { motionMs } from '../../ui/motion';
  import type { Medal } from '../../domain/stats';

  interface Props { item: Medal; onclose: () => void; onbadges: () => void }
  let { item, onclose, onbadges }: Props = $props();

  const rung = RANKS.findIndex((r) => r.id === item.rank);
  const rank = RANKS[rung]!;
  const master = rank.id === 'master';
  const SPARKS = [[-1, -0.8, 22], [0.95, -0.9, 18], [1.15, 0.3, 14], [-1.2, 0.4, 16], [0.25, -1.25, 12], [-0.4, 1.15, 12], [0.9, 0.95, 14], [-0.9, -1.2, 12]] as const;

  let stage: HTMLElement, medal: HTMLElement, band: HTMLElement, words: HTMLElement, ladder: HTMLElement, actions: HTMLElement;
  let sparkEls: HTMLElement[] = $state([]);
  let ready = $state(false); // the ladder beat: Continue appears with it

  onMount(() => {
    const reduced = typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const ease = (name: string) => css(`--motion-easing-${name}`) || 'ease';
    const anims: Animation[] = [];
    const A = (el: Element, kf: Keyframe[], delay: number, duration: number, easing: string) => {
      if (typeof el.animate !== 'function') return null; // no Web Animations (tests)
      const a = el.animate(kf, { delay, duration: Math.max(1, duration), easing: ease(easing), fill: 'forwards' });
      anims.push(a);
      return a;
    };
    const fast = motionMs('fast'), base = motionMs('base'), slow = motionMs('slow'), celebrate = motionMs('celebrate'), hold = motionMs('hold');
    const instant = motionMs('instant');
    const px = (n: string) => parseFloat(css(`--space-${n}`)) || 0;
    const rise = px('8'), drift = px('24');
    const fade = [{ opacity: 0 }, { opacity: 1 }];

    if (reduced) {
      for (const el of [stage, medal, words, ladder, actions]) A(el, fade, 0, fast, 'standard');
      ready = true;
      return () => anims.forEach((a) => a.cancel());
    }
    // 1 · the stage darkens, the medal turns in (spring may overshoot, 053)
    A(stage, fade, 0, base, 'standard');
    A(medal, [{ opacity: 0, transform: 'scale(0.4) rotateY(80deg)' }, { opacity: 1, offset: 0.3 }, { opacity: 1, transform: 'scale(1) rotateY(0deg)' }], base, celebrate + base, 'spring');
    // 2 · one shine, the sparks, the words
    const settle = base + celebrate + base;
    A(band, [{ transform: 'translateX(-200%) rotate(20deg)' }, { transform: 'translateX(700%) rotate(20deg)' }], settle - base, slow, 'standard');
    sparkEls.forEach((el, i) => {
      const [dx, dy] = SPARKS[i]!;
      const t = settle - base + i * instant * 0.3;
      const mid = `translate(${dx * drift * 0.6}px, ${dy * drift * 0.6}px) scale(1)`;
      A(el, [{ opacity: 0, transform: 'translate(0, 0) scale(0)' }, { opacity: 1, transform: mid }], t, fast, 'enter');
      A(el, [{ opacity: 1, transform: mid }, { opacity: 0, transform: `translate(${dx * drift}px, ${dy * drift}px) scale(0.6)` }], t + fast + base, base, 'exit');
    });
    A(words, [{ opacity: 0, transform: `translateY(${rise}px)` }, { opacity: 1, transform: 'none' }], settle, base, 'enter');
    // 3 · the ladder beat, once the moment has had its breath (not skippable before it)
    const beat = settle + hold;
    A(ladder, [{ opacity: 0, transform: `translateY(${rise}px)` }, { opacity: 1, transform: 'none' }], beat, base, 'enter');
    A(actions, fade, beat + base, base, 'standard');
    const t = setTimeout(() => (ready = true), beat + base);
    return () => { clearTimeout(t); anims.forEach((a) => a.cancel()); };
  });
</script>

<div class="reached" role="dialog" aria-modal="true" aria-labelledby="rank-title">
  <div class="stage" bind:this={stage}></div>
  <div class="spacer"></div>
  <div class="hero">
    <div class="persp"><div class="medal" bind:this={medal}>
      <RankMedal rank={item.rank} icon={item.icon as IconName} size="large" label="{rank.label} medal, {shortName(item.title)}" />
      <span class="shine" aria-hidden="true"><span class="band" bind:this={band}></span></span>
    </div></div>
    {#each SPARKS as s, i (i)}
      <span class="spark" class:gold={i % 2 === 1} bind:this={sparkEls[i]} style:--x={s[0]} style:--y={s[1]} style:width="{s[2]}px" style:height="{s[2]}px" aria-hidden="true">
        <svg viewBox="0 0 16 16"><path d="M8 0 9.6 6.4 16 8 9.6 9.6 8 16 6.4 9.6 0 8 6.4 6.4Z" /></svg>
      </span>
    {/each}
  </div>
  <div class="words" bind:this={words}>
    <p class="t-label-small kicker">{master ? 'Final rank' : 'New rank'}</p>
    <h1 id="rank-title" class="t-heading-large">{master ? 'Mastered' : rank.label}</h1>
    <p class="t-body-default soft">{shortName(item.title)} held for {plural(rank.days, 'day')}, never missed twice in a row.</p>
  </div>
  <ol class="ladder" bind:this={ladder} aria-label="Rank ladder">
    {#each RANKS as r, i (r.id)}
      <li class="rung" class:lit={i <= rung} class:now={i === rung} aria-current={i === rung ? 'step' : undefined}>
        <span class="pip" aria-hidden="true"></span>
        <span class="t-label-small">{r.label}</span>
      </li>
    {/each}
  </ol>
  <div class="spacer"></div>
  <div class="actions" bind:this={actions} inert={!ready}>
    <Button onclick={onclose}>Continue</Button>
    <Button variant="tertiary" onclick={onbadges}>See all medals</Button>
  </div>
</div>

<style>
  .reached {
    position: fixed; inset: 0; z-index: 11; display: flex; flex-direction: column; gap: var(--layout-block-gap); color: var(--text-inverse);
    padding: calc(env(safe-area-inset-top) + var(--space-32)) var(--layout-gutter) calc(env(safe-area-inset-bottom) + var(--space-24));
  }
  .stage { position: absolute; inset: 0; background: var(--bg-stage); opacity: 0; z-index: -1; }
  .spacer { flex: 1; }
  .hero { position: relative; display: grid; justify-items: center; }
  .persp { perspective: calc(var(--space-64) * 10); }
  .medal { position: relative; opacity: 0; }
  .shine { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .band { position: absolute; top: -10%; left: 0; width: 12%; height: 120%; transform: translateX(-200%) rotate(20deg);
    background: linear-gradient(90deg, transparent, var(--bg-default), transparent); opacity: 0.45; }
  .spark { position: absolute; left: calc(50% + var(--x) * 7rem); top: calc(50% + var(--y) * 7rem); translate: -50% -50%; opacity: 0; }
  .spark svg { width: 100%; height: 100%; fill: var(--celebrate-spark); }
  .spark.gold svg { fill: var(--award-facet-light); }
  .words { display: grid; gap: var(--space-8); text-align: center; opacity: 0; }
  .kicker { color: var(--award-facet-light); text-transform: uppercase; }
  .soft { opacity: 0.8; }
  .ladder { list-style: none; margin: 0; padding: 0; display: flex; justify-content: space-between; gap: var(--space-4); opacity: 0; }
  .rung { display: grid; justify-items: center; gap: var(--space-8); flex: 1; opacity: 0.5; }
  .rung.lit { opacity: 1; }
  .pip { width: var(--space-12); height: var(--space-12); border-radius: 50%; background: var(--text-inverse); opacity: 0.4; }
  .rung.lit .pip { background: var(--award-facet-light); opacity: 1; }
  .rung.now .pip { transform: scale(1.5); }
  .actions { display: grid; gap: var(--space-8); opacity: 0; }
</style>
