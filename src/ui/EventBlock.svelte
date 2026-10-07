<script lang="ts">
  // Event block (Figma 36:285): one event in Day view and in the Month list.
  // Past: subtle fill, grey bar. Now: outlined and tinted in the calendar colour. Upcoming: lightly tinted.
  // 034: the calendar colour is a marker (bar, outline, tint), and the calendar's name always travels in
  // the time line. Habit events carry a state dot: filled = done.
  import type { CalendarToken } from '../data/schema';

  interface Props {
    title: string;
    time: string; // "10:00–11:00 · MARKO. WORK"
    calendar: CalendarToken;
    state?: 'past' | 'now' | 'upcoming';
    size?: 'regular' | 'compact';
    habit?: 'done' | 'open' | null;
    join?: boolean;
    fill?: boolean; // stretch to the parent's height (Day view positions it)
    onclick?: () => void;
  }
  let { title, time, calendar, state = 'upcoming', size = 'regular', habit = null, join = false, fill = false, onclick }: Props = $props();
</script>

<button class="block {state} {size}" class:fill class:has-dot={!!habit} style:--cal="var(--calendar-{calendar})" {onclick}>
  <span class="bar" aria-hidden="true"></span>
  <span class="body">
    {#if size === 'compact'}
      <span class="t-number-small">{time.split(' · ')[0]!.split('–')[0]}</span>
      <span class="t-body-small title">{title}</span>
    {:else}
      <span class="t-body-small title">{title}</span>
      <span class="t-label-small meta">{time}</span>
    {/if}
  </span>
  {#if join}<span class="t-body-small join">Join</span>{/if}
  {#if habit}<span class="dot {habit}" role="img" aria-label={habit === 'done' ? 'Done' : 'Not done yet'}></span>{/if}
</button>

<style>
  .block {
    position: relative; display: flex; align-items: stretch; width: 100%; overflow: hidden; text-align: left;
    border-radius: var(--radius-event);
    min-height: var(--size-control);
  }
  .compact { min-height: calc(var(--space-20) + var(--space-4)); }
  .fill { height: 100%; min-height: 0; }
  .bar { flex: none; width: var(--space-4); background: var(--cal); }
  .body {
    flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;
    padding: var(--space-4) var(--space-8); color: var(--text-primary); white-space: nowrap;
  }
  .compact .body { flex-direction: row; align-items: center; justify-content: flex-start; gap: var(--space-8); padding-block: 0; }
  .title { overflow: hidden; text-overflow: ellipsis; } /* E21 */
  .meta { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; }

  /* Tints keep the Figma layer opacities: upcoming 8%, now 16%. */
  .upcoming { background: color-mix(in srgb, var(--cal) 8%, var(--bg-default)); }
  .now {
    background: color-mix(in srgb, var(--cal) 16%, var(--bg-default));
    box-shadow: inset 0 0 0 var(--stroke-icon) var(--cal);
  }
  .past { background: var(--bg-subtle); }
  .past .bar { background: var(--icon-muted); }
  .past .body, .past .meta { color: var(--text-secondary); }

  .join { position: absolute; right: var(--space-12); top: 50%; transform: translateY(-50%); color: var(--text-accent); }
  .dot {
    position: absolute; right: var(--space-8); top: var(--space-8);
    width: var(--space-12); height: var(--space-12); border-radius: var(--radius-round);
  }
  .compact .dot { top: 50%; transform: translateY(-50%); }
  .has-dot .body { padding-right: calc(var(--space-12) + var(--space-12)); }
  .dot.done { background: var(--state-done); } /* 008 */
  .dot.open { box-shadow: inset 0 0 0 var(--stroke-icon) var(--border-control); }
</style>
