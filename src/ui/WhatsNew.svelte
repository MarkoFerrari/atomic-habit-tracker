<script lang="ts" module>
  // U1 Welcome to the new ATOMIC (131): after an update, once per version, a sheet over Today. Generic on purpose: four
  // short lines, the version, Continue. Few people read release notes; the sheet says something changed, nothing more.
  import type { IconName } from './icons';
  /** The lines for this version. Change them with each release that deserves the sheet. */
  export const NEWS: { icon: IconName; text: string }[] = [
    { icon: 'palette', text: 'New visual style' },
    { icon: 'bell', text: 'Reminders' },
    { icon: 'smile', text: 'Usability improvements' },
    { icon: 'wrench', text: 'Bug fixes' },
  ];
</script>

<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  let { open, version, onclose }: { open: boolean; version: string; onclose: () => void } = $props();
</script>

<Sheet {open} title="Welcome to the new ATOMIC" {onclose}>
  <div class="news">
    <ul>
      {#each NEWS as n (n.text)}
        <li class="t-body-default"><span class="tile"><Icon name={n.icon} /></span>{n.text}</li>
      {/each}
    </ul>
    <p class="t-label-small version">Version {version}</p>
    <Button onclick={onclose}>Continue</Button>
  </div>
</Sheet>

<style>
  .news { display: grid; gap: var(--space-16); padding-bottom: var(--space-16); }
  ul { display: grid; gap: var(--space-12); }
  li { display: flex; align-items: center; gap: var(--space-12); }
  .tile { flex: none; display: grid; place-items: center; width: var(--space-40); height: var(--space-40); border-radius: var(--radius-tile); background: var(--bg-app); color: var(--icon-default); }
  .version { text-align: center; color: var(--text-secondary); }
</style>
