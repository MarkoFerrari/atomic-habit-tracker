<script lang="ts" generics="T extends string">
  // Segmented control (Figma 33:111): switches views of the same data (C3).
  interface Props { options: { id: T; label: string }[]; selected: T; label: string; onselect: (id: T) => void }
  let { options, selected, label, onselect }: Props = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as o (o.id)}
    <button class="t-body-strong" class:on={o.id === selected} role="radio" aria-checked={o.id === selected} onclick={() => onselect(o.id)}>
      {o.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex; gap: var(--space-4); padding: var(--space-4); min-height: var(--size-touch);
    background: var(--bg-subtle); border-radius: var(--radius-control);
  }
  button { flex: 1; border-radius: var(--radius-control-inner); color: var(--text-tertiary); }
  .on { background: var(--bg-default); color: var(--text-accent); box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control); }
</style>
