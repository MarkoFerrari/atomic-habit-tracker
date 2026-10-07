<script lang="ts">
  // Component gallery (open with #gallery): every core component in its Figma states, for side-by-side review.
  // Sample content only (045).
  import Button from '../../ui/Button.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import StateIcon from '../../ui/StateIcon.svelte';
  import MasteryRing from '../../ui/MasteryRing.svelte';
  import HabitRow from '../../ui/HabitRow.svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import TabBar from '../../ui/TabBar.svelte';
  import type { Tab } from '../../ui/tabs';
  import Banner from '../../ui/Banner.svelte';
  import RankMedal from '../../ui/RankMedal.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import IconButton from '../../ui/IconButton.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Toast from '../../ui/Toast.svelte';
  import Chip from '../../ui/Chip.svelte';
  import { RANKS } from '../../domain/ranks';
  import { SKIP_REASONS } from '../../domain/states';
  import type { HabitState } from '../../domain/states';

  const states: HabitState[] = ['open', 'running', 'done', 'skipped', 'missed'];
  const trailing: Record<HabitState, string | undefined> = { open: undefined, running: undefined, done: '06:31', skipped: 'No time', missed: undefined };
  let tab = $state<Tab>('today');
  let demo = $state<HabitState>('running');
  let justDone = $state(false);
  let sheetOpen = $state(false);
  let toast = $state<string | null>(null);
  let recapOn = $state(true);
  const reasonLabel = { 'no-time': 'No time', forgot: 'Forgot', 'low-energy': 'Low energy', 'not-relevant-today': 'Not relevant today' } as const;
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
    ondone={() => { demo = 'done'; justDone = true; toast = 'Sample habit marked done'; }}
    onskip={() => { sheetOpen = true; }} onopen={() => { sheetOpen = true; }} />

  <SectionLabel text="Rank medals" />
  <div class="line medals">{#each RANKS as r (r.id)}<RankMedal rank={r.id} icon="dumbbell" label="{r.label}, earned" />{/each}</div>
  <div class="line medals">{#each RANKS as r (r.id)}<RankMedal rank={r.id} icon="dumbbell" earned={false} label="{r.label}, locked" />{/each}</div>

  <SectionLabel text="List rows" />
  <ListRow label="Calendars" value="4" icon="calendar" />
  <ListRow type="toggle" label="22:30 recap" bind:on={recapOn} />
  <ListRow type="destructive" label="Delete habit series" />

  <SectionLabel text="Chips" />
  <div class="chips">
    <Chip kind="filter" label="Sample calendar" selected calendar="marko" />
    <Chip kind="filter" label="Sample calendar" calendar="marko" />
    <Chip label="Reason" selected />
    <Chip label="Reason" />
  </div>

  <SectionLabel text="Icon buttons" />
  <div class="line"><IconButton icon="plus" label="New event" /><IconButton icon="plus" label="New event" variant="plain" /></div>

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
<div class="tabbar">
  {#if toast}<div class="toast-slot"><Toast message={toast} onaction={() => { demo = 'running'; justDone = false; }} ondismiss={() => (toast = null)} /></div>{/if}
  <TabBar active={tab} onselect={(t) => (tab = t)} />
</div>

<Sheet open={sheetOpen} title="Why skip Sample habit?" showClose onclose={() => (sheetOpen = false)}>
  <p class="t-body-small hint">Optional. The skip counts either way.</p>
  <div class="chips">
    {#each SKIP_REASONS as r (r)}
      <Chip label={reasonLabel[r]} onclick={() => { demo = 'skipped'; justDone = false; sheetOpen = false; }} />
    {/each}
  </div>
  <Button variant="tertiary" onclick={() => { demo = 'skipped'; justDone = false; sheetOpen = false; }}>Skip without a reason</Button>
</Sheet>

<style>
  .stack { display: grid; gap: var(--space-8); }
  .line { display: flex; gap: var(--space-16); flex-wrap: wrap; padding: var(--space-8) 0; }
  .ring { position: relative; display: block; width: var(--size-touch); height: var(--size-touch); }
  .spacer { height: var(--space-64); }
  .medals { gap: var(--space-8); }
  .chips { display: flex; flex-wrap: wrap; column-gap: var(--space-8); }
  .tabbar { position: sticky; bottom: 0; }
  .toast-slot { padding: 0 var(--layout-gutter) var(--space-8); }
  .hint { color: var(--text-secondary); padding-bottom: var(--space-8); }
</style>
