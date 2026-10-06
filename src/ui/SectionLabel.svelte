<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<h2 class="t-label-section">{text}</h2>

<style>
  h2 { padding: var(--space-16) 0 var(--space-8); color: var(--text-secondary); }
</style>
