<script lang="ts">
  // A calendar in a list (H07, H08): marker dot, name, one line of detail, and an optional toggle.
  // 034: the colour is a marker only, always next to the calendar's name.
  import Toggle from './Toggle.svelte';
  import type { CalendarToken } from '../data/schema';

  interface Props {
    name: string;
    detail: string;
    color: CalendarToken;
    toggle?: { on: boolean; caption: string; label: string; onchange: (on: boolean) => void };
  }
  let { name, detail, color, toggle }: Props = $props();
</script>

<div class="row">
  <span class="dot" style:background="var(--calendar-{color})" aria-hidden="true"></span>
  <span class="text">
    <span class="t-body-strong name">{name}</span>
    <span class="t-label-small detail">{detail}</span>
  </span>
  {#if toggle}
    <span class="control">
      <Toggle on={toggle.on} label={toggle.label} onchange={toggle.onchange} />
      <span class="t-label-small detail" aria-hidden="true">{toggle.caption}</span>
    </span>
  {/if}
</div>

<style>
  .row { display: flex; align-items: center; gap: var(--space-12); padding: var(--space-12) 0; min-height: var(--size-touch); }
  .dot { flex: none; width: var(--space-12); height: var(--space-12); border-radius: var(--radius-round); }
  .text { flex: 1; min-width: 0; display: grid; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } /* E21 */
  .detail { color: var(--text-tertiary); white-space: nowrap; }
  .control { flex: none; display: grid; justify-items: end; gap: var(--space-4); }
</style>
