<script lang="ts">
  import Sheet from '../Sheet.svelte';
  let row = $state<{ title: string } | null>(null);
  export function openIt() { row = { title: 'Read a book' }; }
  export function closeIt() { row = null; }
</script>
<Sheet open={row !== null} title={row?.title ?? ''} onclose={() => (row = null)}>
  {#if row}<p data-testid="body">Body of {row.title}</p>{/if}
</Sheet>
