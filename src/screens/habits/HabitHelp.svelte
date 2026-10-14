<script lang="ts" module>
  export type HelpTopic = 'nudge' | 'stick';
</script>

<script lang="ts">
  // 116: what Nudge and Make it stick mean, from the (i) beside each on New habit (U16). Plain words, no exclamation
  // marks (110). The three parts of Make it stick are 085 (cue, smallest version, identity) and 086 (it counts as done).
  import Sheet from '../../ui/Sheet.svelte';
  import Button from '../../ui/Button.svelte';

  // `topics`: which sheets this screen carries (HabitWhen has the nudge, New habit has Make it stick)
  let { topic = $bindable(null), topics }: { topic: HelpTopic | null; topics: HelpTopic[] } = $props();
  const close = () => (topic = null);
</script>

{#if topics.includes('nudge')}
<Sheet open={topic === 'nudge'} title="Nudge at the start" onclose={close}>
  <div class="sheet">
    <p class="t-body-default">One notification when the habit starts, so the reminder finds you instead of you remembering it. Tap it and Today opens, ready for Done or Skip.</p>
    <p class="t-body-default secondary">Turn it off for a habit that already has a strong cue, like the first coffee of the day. Nudges need reminders on in Settings → Notifications.</p>
    <Button onclick={close}>Got it</Button>
  </div>
</Sheet>
{/if}

{#if topics.includes('stick')}
<Sheet open={topic === 'stick'} title="Make it stick" onclose={close}>
  <div class="sheet">
    <dl class="parts">
      <div><dt class="t-body-strong">After</dt><dd class="t-body-default secondary">Tie the habit to one you already do: after Breakfast, read. The old habit becomes the cue.</dd></div>
      <div><dt class="t-body-strong">Smallest version</dt><dd class="t-body-default secondary">What it looks like in 2 minutes, for the bad days. Doing it counts as done and keeps the run alive.</dd></div>
      <div><dt class="t-body-strong">I’m becoming</dt><dd class="t-body-default secondary">Who this habit makes you. Today counts every done as a vote for that person.</dd></div>
    </dl>
    <p class="t-body-small tertiary">All three are optional, and you can add them later in Edit habit.</p>
    <Button onclick={close}>Got it</Button>
  </div>
</Sheet>
{/if}

<style>
  .sheet { display: grid; gap: var(--space-16); padding-bottom: var(--space-40); }
  .parts { display: grid; gap: var(--space-16); }
  dd { margin: 0; }
  .secondary { color: var(--text-secondary); }
  .tertiary { color: var(--text-tertiary); }
</style>
