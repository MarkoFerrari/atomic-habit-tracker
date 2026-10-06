<script lang="ts">
  // Component gallery (open with #gallery): every core component in its Figma states, for side-by-side review.
  // Sample content only (045).
  import Button from '../../ui/Button.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import StateIcon from '../../ui/StateIcon.svelte';
  import MasteryRing from '../../ui/MasteryRing.svelte';
  import HabitRow from '../../ui/HabitRow.svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import TabBar, { type Tab } from '../../ui/TabBar.svelte';
  import Banner from '../../ui/Banner.svelte';
  import type { HabitState } from '../../domain/states';

  const states: HabitState[] = ['open', 'running', 'done', 'skipped', 'missed'];
  const trailing: Record<HabitState, string | undefined> = { open: undefined, running: undefined, done: '06:31', skipped: 'No time', missed: undefined };
  let tab = $state<Tab>('today');
  let demo = $state<HabitState>('running');
  let justDone = $state(false);
</script>

<main class="screen">
  <TopBar title="Components" eyebrow="Sample · gallery" action={{ icon: 'plus', label: 'New event' }} />

  <SectionLabel text="Buttons" />
  <div class="stack">
    <Button>Mark as done</Button>
    <Button variant="secondary" icon="download">Back up now</Button>
    <Button variant="tertiary">Restore from a backup</Button>
    <Button disabled>Primary disabled</Button>
    <Button variant="secondary" disabled>Secondary disabled</Button>
  </div>

  <SectionLabel text="State icon · mastery ring" />
  <div class="line">{#each states as s (s)}<StateIcon status={s} icon="dumbbell" />{/each}</div>
  <div class="line">{#each [0, 1, 2, 3, 4, 5] as l (l)}<span class="ring"><MasteryRing level={l} /></span>{/each}</div>

  <SectionLabel text="Habit rows" />
  {#each states as s (s)}
    <HabitRow name="Sample habit" meta="08:00 · 30 min" status={s} icon="dumbbell" trailing={trailing[s]} showMarkDone={s === 'open' || s === 'running'} />
  {/each}
  <HabitRow name="A sample habit with a very long name that must truncate on one line" meta="All day" status="open" icon="book-open" level={2} />

  <SectionLabel text="Try it: tap Mark as done, or swipe" />
  <HabitRow name="Sample habit" meta="08:00 · 30 min" status={demo} icon="coffee" level={3} justDone={justDone}
    showMarkDone={demo === 'running'} trailing={demo === 'done' ? '08:02' : demo === 'skipped' ? 'No reason given' : undefined}
    ondone={() => { demo = 'done'; justDone = true; }} onskip={() => { demo = 'skipped'; justDone = false; }} onopen={() => { demo = 'running'; justDone = false; }} />

  <SectionLabel text="Top bars" />
  <TopBar type="navigation" title="Habit" rightLabel="Edit" />
  <TopBar type="modal" title="New event" leftLabel="Cancel" rightLabel="Save" />

  <SectionLabel text="Banners" />
  <div class="stack">
    <Banner message="Your last backup was 9 days ago." action="Back up now" />
    <Banner tone="info" message="This is a preview with sample data." />
  </div>
  <div class="spacer"></div>
</main>
<div class="tabbar"><TabBar active={tab} onselect={(t) => (tab = t)} /></div>

<style>
  .stack { display: grid; gap: var(--space-8); }
  .line { display: flex; gap: var(--space-16); flex-wrap: wrap; padding: var(--space-8) 0; }
  .ring { position: relative; display: block; width: var(--size-touch); height: var(--size-touch); }
  .spacer { height: var(--space-64); }
  .tabbar { position: sticky; bottom: 0; }
</style>
