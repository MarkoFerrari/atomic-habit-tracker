<script lang="ts">
  // The year's sky (Figma Playground W3, 109): one cell per ISO week, a row per quarter. A perfect week is a star;
  // neighbouring stars join into a constellation; a star is never taken back. A dot is a week that wasn't perfect,
  // dashed weeks are still ahead, and weeks before tracking are faint, never counted (033).
  import AwardStar from './AwardStar.svelte';
  import type { Sky, SkyWeek } from '../domain/moments';

  let { sky }: { sky: Sky } = $props();
  const date = (d: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const said = (w: SkyWeek) => `Week of ${date(w.monday)}: ${{ perfect: 'perfect week', held: 'not perfect', current: 'this week', ahead: 'ahead', before: 'not tracked' }[w.state]}`;
  // a link runs to the next cell when both weeks are perfect and sit in the same row
  const linked = (i: number) => sky.weeks[i]?.state === 'perfect' && sky.weeks[i + 1]?.state === 'perfect' && (i + 1) % 13 !== 0;
  const caption = $derived(
    !sky.longest ? 'No perfect week yet. Seven perfect days in one week light the first star.'
      : sky.longest.weeks === 1 ? (sky.perfect === 1 ? `Your first star: the week of ${date(sky.longest.from)}.` : 'Every star stands alone so far. Two perfect weeks in a row make a constellation.')
        : `Longest constellation: ${sky.longest.weeks} weeks, ${date(sky.longest.from)} to ${date(sky.longest.to)}.`,
  );
</script>

<section class="sky">
  <ol class="grid" aria-label="Perfect weeks in {sky.year}">
    {#each sky.weeks as w, i (w.monday)}
      <li class="week {w.state}" aria-label={said(w)}>
        {#if linked(i)}<span class="link" aria-hidden="true"></span>{/if}
        {#if w.state === 'perfect'}<AwardStar size="tiny" />{:else}<span class="dot" aria-hidden="true"></span>{/if}
      </li>
    {/each}
  </ol>
  <p class="t-body-strong">{caption}</p>
  <p class="t-body-small secondary">One row is a quarter. A star is a perfect week, a dot a week that wasn’t; dashed weeks are still ahead. Neighbouring stars join, and a star is never taken back.</p>
</section>

<style>
  .sky { display: grid; gap: var(--space-8); }
  .grid { display: grid; grid-template-columns: repeat(13, 1fr); row-gap: var(--space-16); padding-bottom: var(--space-8); }
  .week { position: relative; display: grid; place-items: center; height: var(--space-24); }
  .week :global(svg) { position: relative; z-index: 1; }
  .link { position: absolute; left: 50%; top: 50%; width: 100%; height: var(--stroke-icon); translate: 0 -50%; background: var(--award-facet-mid); }
  .dot { width: var(--space-4); height: var(--space-4); border-radius: var(--radius-round); background: var(--border-control); }
  .current .dot { background: var(--border-strong); width: var(--space-8); height: var(--space-8); }
  .ahead .dot { width: var(--space-8); height: var(--space-8); background: none; border: var(--stroke-hairline) dashed var(--border-control); }
  .before .dot { background: var(--border-divider); }
  .secondary { color: var(--text-secondary); }
</style>
