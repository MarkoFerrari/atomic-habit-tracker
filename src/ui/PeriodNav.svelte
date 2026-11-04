<script lang="ts">
  // The header of a period you can step through (Habits → Week and Month, Stats, habit detail: 142–144): a chevron each side of the title and
  // the count under it, so the percentage keeps its own line. A chevron with nowhere to go is disabled, never hidden.
  import Icon from './Icon.svelte';
  interface Props {
    title: string; count?: string; unit: 'week' | 'month' | 'year';
    onprev: () => void; onnext: () => void; prevDisabled?: boolean; nextDisabled?: boolean;
  }
  let { title, count, unit, onprev, onnext, prevDisabled = false, nextDisabled = false }: Props = $props();
</script>

<header>
  <button class="step" aria-label="Previous {unit}" disabled={prevDisabled} onclick={onprev}><Icon name="chevron-left" /></button>
  <div class="heading">
    <h2 class="t-body-strong">{title}</h2>
    {#if count}<span class="t-number-default count">{count}</span>{/if}
  </div>
  <button class="step" aria-label="Next {unit}" disabled={nextDisabled} onclick={onnext}><Icon name="chevron-right" /></button>
</header>

<style>
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-8); }
  .heading { display: grid; gap: var(--space-4); justify-items: center; text-align: center; }
  .count { color: var(--text-done); }
  .step { width: var(--size-touch); height: var(--size-touch); display: grid; place-items: center; border-radius: var(--radius-round); color: var(--icon-default); }
  .step:disabled { color: var(--icon-muted); }
</style>
