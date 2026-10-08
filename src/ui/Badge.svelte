<script lang="ts">
  // Badge (Figma 110:581): one medal per habit (055), drawn as the star medal (100): the habit's icon, ringed by
  // stars as ranks are reached. Before Starter the slots are all dots and the bar counts days toward it (H38c).
  import RankMedal from './RankMedal.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import type { IconName } from './icons';
  import type { RankId } from '../domain/ranks';

  interface Props { title: string; sub: string; rank: RankId | null; icon: IconName; progress?: { value: number; of: number } | null; onclick?: () => void }
  let { title, sub, rank, icon, progress = null, onclick }: Props = $props();
</script>

<button class="badge" {onclick}>
  <RankMedal {rank} {icon} />
  <span class="text">
    <span class="t-body-strong name">{title}</span>
    <span class="t-body-small sub">{sub}</span>
    {#if progress}<ProgressBar value={progress.value} of={progress.of} label="Toward the next rank" />{/if}
  </span>
</button>

<style>
  .badge { display: flex; align-items: center; gap: var(--space-16); width: 100%; min-height: calc(var(--space-64) + var(--space-8)); text-align: left; padding: var(--space-4) 0; }
  .text { flex: 1; min-width: 0; display: grid; gap: var(--space-4); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { color: var(--text-secondary); }
</style>
