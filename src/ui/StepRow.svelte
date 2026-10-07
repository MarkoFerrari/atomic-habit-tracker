<script lang="ts">
  // A numbered instruction (H02, H05, H06, H10). The number is a step label, shown as designed ("01").
  let { n, text }: { n: number; text: string } = $props();
</script>

<li class="step">
  <span class="n t-number-default" aria-hidden="true">{String(n).padStart(2, '0')}</span>
  <span class="t-body-default">{text}</span>
</li>

<style>
  .step { display: flex; align-items: center; gap: var(--space-16); padding: var(--space-8) 0; }
  .n { color: var(--text-accent); flex: none; }
</style>
