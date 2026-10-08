<script lang="ts">
  // Stepper (Figma 219:39, 095): replaces "1 of 3" on every flow with steps. A segment and a labelled check per step:
  // done steps turn green (state/done), the current one is ink, the ones ahead are the decorative track.
  // Advancing: the finished segment turns green and the next fills from the left (base, standard).
  import Icon from './Icon.svelte';
  interface Props { steps: readonly string[]; current: number } // current: 1-based
  let { steps, current }: Props = $props();
  const label = $derived(`Step ${current} of ${steps.length}, ${steps[current - 1]}${current > 1 ? `, ${steps.slice(0, current - 1).join(' and ')} done` : ''}`);
</script>

<div class="stepper" role="progressbar" aria-valuemin="1" aria-valuemax={steps.length} aria-valuenow={current} aria-label={label}>
  <div class="bar" aria-hidden="true">
    {#each steps as _, i (i)}<span class="seg" class:done={i + 1 < current} class:current={i + 1 === current}></span>{/each}
  </div>
  <div class="labels" aria-hidden="true">
    {#each steps as s, i (i)}
      <span class="step t-label-small" class:done={i + 1 < current} class:current={i + 1 === current}><Icon name="check" size="small" />{s}</span>
    {/each}
  </div>
</div>

<style>
  .stepper { display: grid; gap: var(--space-8); }
  .bar, .labels { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: var(--space-8); }
  .seg { height: var(--space-4); border-radius: var(--radius-round); background: var(--border-divider); position: relative; overflow: hidden; }
  .seg::after { content: ''; position: absolute; inset: 0; border-radius: inherit; transform-origin: left; transform: scaleX(0);
    transition: transform var(--motion-duration-base) var(--motion-easing-standard), background var(--motion-duration-fast) var(--motion-easing-standard); }
  .seg.current::after { transform: scaleX(1); background: var(--text-primary); }
  .seg.done::after { transform: scaleX(1); background: var(--state-done); }
  .step { display: flex; align-items: center; gap: var(--space-4); color: var(--text-tertiary); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .step :global(svg) { color: var(--icon-muted); transition: color var(--motion-duration-fast) var(--motion-easing-standard); }
  .step.done { color: var(--text-secondary); }
  .step.done :global(svg) { color: var(--state-done); }
  .step.current { color: var(--text-primary); }
</style>
