<script lang="ts">
  // Badge (M1, style B): one medal per habit (055) on a white tile, drawn as Badge 3D (128): the container gains corners
  // rank by rank, the habit's object on its field inside. The rank's name always travels with the medal; the bar counts
  // days held toward the next rank.
  import RankMedal from './RankMedal.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import type { IconName } from './icons';
  import type { RankId } from '../domain/ranks';

  interface Props { title: string; rankLabel: string; next?: string; rank: RankId | null; icon: IconName; progress?: { value: number; of: number } | null; onclick?: () => void }
  let { title, rankLabel, next, rank, icon, progress = null, onclick }: Props = $props();
</script>

<button class="badge card" {onclick} aria-label="{title}, {rankLabel}{next ? `, ${next}` : ''}">
  <RankMedal {rank} {icon} size="medium" />
  <span class="t-body-strong name">{title}</span>
  <span class="t-label-small rank" class:none={!rank}>{rankLabel}</span>
  {#if progress}<span class="bar"><ProgressBar value={progress.value} of={progress.of} label="Toward the next rank" count={false} /></span>{/if}
  {#if next}<span class="t-label-small next">{next}</span>{/if}
</button>

<style>
  .badge { width: 100%; height: 100%; display: grid; justify-items: center; align-content: start; gap: var(--space-8); text-align: center; padding: var(--space-24) var(--space-16) var(--space-16); }
  .name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } /* E21 */
  .rank { color: var(--award-facet-dark); }
  .rank.none, .next { color: var(--text-secondary); }
  .bar { width: 100%; }
</style>
