<script lang="ts" module>
  // U1 What's new (131, amended by 138): after an update, once per version, a sheet over Today. Generic on purpose:
  // one short line per KIND of change this release holds, and only the kinds it holds. A release with only fixes
  // lists only Bug fixes. Kinds, in this order: Visual improvements, Usability improvements, Reminders, Bug fixes.
  import type { IconName } from './icons';
  /** The lines for this version. Rewrite them with each release that deserves the sheet; never carry old ones over. */
  export const NEWS: { icon: IconName; text: string }[] = [
    { icon: 'palette', text: 'Visual improvements' },
    { icon: 'smile', text: 'Usability improvements' },
    { icon: 'bell', text: 'Reminders' },
    { icon: 'wrench', text: 'Bug fixes' },
  ];
</script>

<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  let { open, version, onclose }: { open: boolean; version: string; onclose: () => void } = $props();
</script>

<Sheet {open} title="What’s new in ATOMIC" {onclose}>
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
