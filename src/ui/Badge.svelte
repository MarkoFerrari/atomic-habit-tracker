<script lang="ts">
  // Badge (Figma 110:581): one medal per habit (055). Shape and colour = rank, icon = the habit's own.
  // Locked keeps the shape in grey and counts days toward Starter (H38c).
  import RankMedal from './RankMedal.svelte';
  import type { IconName } from './icons';
  import type { RankId } from '../domain/ranks';

  interface Props { title: string; sub: string; rank: RankId | null; icon: IconName; progress?: { value: number; of: number } | null; onclick?: () => void }
  let { title, sub, rank, icon, progress = null, onclick }: Props = $props();
</script>

<button class="badge" {onclick}>
  <RankMedal rank={rank ?? 'starter'} {icon} earned={rank !== null} />
  <span class="text">
    <span class="t-body-strong name">{title}</span>
    <span class="t-body-small sub">{sub}</span>
    {#if progress}
      <span class="bar-row">
        <span class="track" role="progressbar" aria-valuemin="0" aria-valuemax={progress.of} aria-valuenow={Math.min(progress.value, progress.of)} aria-label="Toward the next rank">
          <span class="fill" style:width="{Math.min(100, Math.round((progress.value / progress.of) * 100))}%"></span>
        </span>
        <span class="t-number-small count">{progress.value}/{progress.of}</span>
      </span>
    {/if}
  </span>
</button>

<style>
  .badge { display: flex; align-items: center; gap: var(--space-16); width: 100%; min-height: calc(var(--space-64) + var(--space-8)); text-align: left; padding: var(--space-4) 0; }
  .text { flex: 1; min-width: 0; display: grid; gap: var(--space-4); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { color: var(--text-secondary); }
  .bar-row { display: flex; align-items: center; gap: var(--space-8); }
  .track { flex: 1; height: var(--space-4); background: var(--bg-subtle); border-radius: var(--radius-round); overflow: hidden; }
  .fill { display: block; height: 100%; background: var(--border-strong); border-radius: var(--radius-round); }
  .count { color: var(--text-tertiary); }
</style>
