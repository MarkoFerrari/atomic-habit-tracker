<script lang="ts">
  // Toggle (Figma 32:168): Track as habits, All day, the 22:30 recap. The 44 px hit area comes from the parent row.
  let { on = $bindable(false), disabled = false, label }: { on?: boolean; disabled?: boolean; label: string } = $props();
</script>

<button class="toggle" class:on role="switch" aria-checked={on} aria-label={label} {disabled} onclick={() => (on = !on)}>
  <span class="knob"></span>
</button>

<style>
  .toggle {
    position: relative; flex: none;
    width: var(--size-control); height: calc(var(--space-24) + var(--space-4));
    border-radius: var(--radius-round);
    background: var(--bg-subtle); box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control);
    transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
  }
  .on { background: var(--action-primary); box-shadow: none; }
  .knob {
    position: absolute; top: calc(var(--space-4) / 2); left: calc(var(--space-4) / 2);
    width: var(--space-24); height: var(--space-24); border-radius: var(--radius-round);
    background: var(--bg-default); box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control);
    transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
  }
  .on .knob { transform: translateX(var(--space-20)); box-shadow: none; }
  .toggle:disabled { opacity: 0.4; cursor: default; } /* Figma: disabled variants at 40% */
</style>
