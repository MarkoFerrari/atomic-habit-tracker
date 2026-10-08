<script lang="ts">
  // H5 Rank reached (Figma page 14, section 04). Rarer than a perfect day, so it gets the whole screen, the next
  // time Today opens after it is earned; never a push (E15). Several on one day come one after another.
  // The new stars pop in one by one, clockwise (fast, spring, 60 ms apart), after the disc settles (celebrate).
  import RankMedal from '../../ui/RankMedal.svelte';
  import ProgressBar from '../../ui/ProgressBar.svelte';
  import Button from '../../ui/Button.svelte';
  import type { IconName } from '../../ui/icons';
  import { RANKS } from '../../domain/ranks';
  import { plural, shortName } from '../../domain/format';
  import type { Medal } from '../../domain/stats';

  interface Props { items: readonly Medal[]; onclose: () => void; onbadges: () => void }
  let { items, onclose, onbadges }: Props = $props();
  let i = $state(0);
  const m = $derived(items[i]!);
  const label = (id: string) => RANKS.find((r) => r.id === id)!.label;
  const days = (id: string) => RANKS.find((r) => r.id === id)!.days;
  function next() { if (i < items.length - 1) i += 1; else onclose(); }
</script>

<div class="reached" role="dialog" aria-modal="true" aria-labelledby="rank-title">
  <div class="spacer"></div>
  {#key i}
    <div class="medal">
      <RankMedal rank={m.rank} icon={m.icon as IconName} size="large" celebrate label="{label(m.rank!)} medal, {shortName(m.title)}" />
      <div class="words">
        <h1 id="rank-title" class="t-heading-large">{m.rank === 'master' ? 'Mastered' : label(m.rank!)}</h1>
        <p class="t-body-default secondary">{shortName(m.title)} held for {plural(days(m.rank!), 'day')}, never missed twice in a row.</p>
      </div>
    </div>
  {/key}
  {#if m.next}
    <div class="next">
      <p class="t-body-strong">Next: {label(m.next.rank)}</p>
      <ProgressBar value={m.held} of={m.next.days} label="Toward {label(m.next.rank)}" />
    </div>
  {:else}
    <p class="t-body-small secondary center">The ring is full. The run keeps counting, and nothing else unlocks.</p>
  {/if}
  <div class="spacer"></div>
  <div class="actions">
    <Button onclick={next}>{i < items.length - 1 ? 'Next medal' : 'Continue'}</Button>
    <Button variant="tertiary" onclick={onbadges}>See all medals</Button>
  </div>
</div>

<style>
  .reached {
    position: fixed; inset: 0; z-index: 9; background: var(--bg-default); display: flex; flex-direction: column; gap: var(--layout-block-gap);
    padding: calc(env(safe-area-inset-top) + var(--space-32)) var(--layout-gutter) calc(env(safe-area-inset-bottom) + var(--space-24));
  }
  .spacer { flex: 1; }
  .medal { display: grid; justify-items: center; gap: var(--space-24); text-align: center; }
  .words { display: grid; gap: var(--space-8); }
  .next { display: grid; gap: var(--space-8); }
  .actions { display: grid; gap: var(--space-8); }
  .secondary { color: var(--text-secondary); }
  .center { text-align: center; }
</style>
