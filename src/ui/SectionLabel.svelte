<script lang="ts">
  // Section label (Figma 36:333): Label/Section, tertiary, 16 on top and 8 below (050).
  let { text }: { text: string } = $props();
</script>

<h2 class="t-label-section">{text}</h2>

<style>
  h2 { padding: var(--space-16) 0 var(--space-8); color: var(--text-tertiary); }
</style>
