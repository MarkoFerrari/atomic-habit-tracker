<script lang="ts">
  // Date pill (Figma 33:176): the day strip in Calendar Day view. Zero-padded day numbers are the
  // brand motif here (a label, not a count: 061 is about counts). Selected fills with the primary action.
  interface Props { weekday: string; day: string; selected?: boolean; today?: boolean; label: string; onclick?: () => void }
  let { weekday, day, selected = false, today = false, label, onclick }: Props = $props();
</script>

<button class="pill" class:selected class:today aria-pressed={selected} aria-label={label} {onclick}>
  <span class="t-label-small wd">{weekday}</span>
  <span class="t-number-default">{day}</span>
</button>

<style>
  .pill {
    display: grid; justify-items: center; align-content: center; gap: var(--space-4);
    width: var(--size-touch); height: calc(var(--space-48) + var(--space-8));
    border-radius: var(--radius-control); color: var(--text-primary);
  }
  .wd { color: var(--text-tertiary); }
  .today:not(.selected), .today:not(.selected) .wd { color: var(--text-accent); }
  .selected { background: var(--action-primary); color: var(--action-on-primary); }
  .selected .wd { color: var(--action-on-primary); }
</style>
