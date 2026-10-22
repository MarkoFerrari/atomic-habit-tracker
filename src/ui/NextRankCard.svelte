<script lang="ts">
  // 135 Next rank (Playground section 19, option B): "NEXT RANK · KEEPER" and the days to go; below, the rank held
  // as a badge, a bar toward the next rank with a tick at each milestone (107), and the next badge faded.
  // The bar runs from the rank's days to the next rank's days, so it always starts at the rank already held.
  import RankMedal from './RankMedal.svelte';
  import type { IconName } from './icons';
  import { RANKS, type RankId } from '../domain/ranks';
  import { milestoneDays } from '../domain/moments';
  import { plural } from '../domain/format';

  interface Props { rank: RankId | null; next: { rank: RankId; daysLeft: number; days: number }; held: number; icon: IconName }
  let { rank, next, held, icon }: Props = $props();
  const label = $derived(RANKS.find((r) => r.id === next.rank)!.label);
  const from = $derived(rank ? RANKS.find((r) => r.id === rank)!.days : 0);
  const span = $derived(Math.max(1, next.days - from));
  const pct = $derived(Math.min(100, Math.max(0, ((held - from) / span) * 100)));
  const ticks = $derived(milestoneDays(next.rank).map((d) => ((d - from) / span) * 100));
</script>

<section class="card next" aria-label="Next rank">
  <div class="head">
    <h2 class="t-label-section secondary">Next rank · {label}</h2>
    <p class="t-number-small secondary">{plural(next.daysLeft, 'day')} to go</p>
  </div>
  <div class="row">
    <RankMedal {rank} {icon} size="tiny" />
    <span class="track" role="progressbar" aria-valuemin="0" aria-valuemax={next.days} aria-valuenow={Math.min(held, next.days)} aria-label="Days held toward {label}">
      <span class="fill" style:width="{pct}%"></span>
      {#each ticks as t (t)}<span class="tick" style:left="{t}%" aria-hidden="true"></span>{/each}
    </span>
    <span class="goal"><RankMedal rank={next.rank} {icon} size="tiny" /></span>
  </div>
</section>

<style>
  .next { display: grid; gap: var(--space-12); }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-8); }
  .row { display: flex; align-items: center; gap: var(--space-12); }
  .track { position: relative; flex: 1; height: var(--space-12); background: var(--bg-app); border-radius: var(--radius-round); overflow: hidden; }
  .fill { display: block; height: 100%; min-width: var(--space-12); background: var(--state-done); border-radius: var(--radius-round);
    transition: width var(--motion-duration-slow) var(--motion-easing-standard); }
  .tick { position: absolute; top: 0; bottom: 0; width: var(--stroke-illustration); translate: -50% 0; background: var(--bg-card); }
  .goal { display: flex; opacity: 0.4; }
  .secondary { color: var(--text-secondary); }
</style>
