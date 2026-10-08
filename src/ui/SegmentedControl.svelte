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
    background: var(--bg-subtle); border-radius: var(--radius-round); /* 111: fully rounded, like the app's other round elements */
  }
  button { flex: 1; border-radius: var(--radius-round); color: var(--text-tertiary); }
  .on { background: var(--action-primary); color: var(--action-on-primary); } /* 103: filled, no border (owner, 8 Oct 2026) */
</style>
