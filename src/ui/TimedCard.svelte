<script lang="ts">
  // B3 Reminder card (130): a reminder on Today and in Habits. White, not the habit's field, and with nothing to tick,
  // so it never reads as something due; "Reminder · not counted" says so in words. Tap opens the reminder (B4).
  import HabitObject from './HabitObject.svelte';
  import Icon from './Icon.svelte';

  interface Props { title: string; icon: string; line: string; eyebrow?: string; onopen?: () => void }
  let { title, icon, line, eyebrow = 'Reminder · not counted', onopen }: Props = $props();
</script>

<button class="timed card" onclick={onopen} aria-label="{title}, reminder, not counted. {line}">
  <HabitObject {icon} size="md" />
  <span class="text">
    {#if eyebrow}<span class="t-label-section eyebrow">{eyebrow}</span>{/if}
    <span class="t-body-strong name">{title}</span>
    <span class="t-label-small line">{line}</span>
  </span>
  <span class="chevron"><Icon name="chevron-right" /></span>
</button>

<style>
  .timed { width: 100%; display: flex; align-items: center; gap: var(--space-12); padding: var(--space-12) var(--space-16) var(--space-12) var(--space-12); text-align: left; }
  .text { flex: 1; min-width: 0; display: grid; gap: var(--space-4); }
  .eyebrow, .line { color: var(--text-secondary); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } /* E21 */
  .chevron { display: flex; color: var(--icon-muted); }
</style>
