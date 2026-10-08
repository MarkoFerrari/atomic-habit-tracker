<script lang="ts">
  // 07 Badges and ranks (Figma 65:3832): H38 Badges, H38b How ranks work, H38c first days. One medal per habit (055),
  // drawn as the star medal (100): the habit's icon ringed by twelve slots, filled with stars rank by rank. A rank is held while the habit is never missed twice
  // in a row (051), and it is never lost (047). The rank-up moment lives in the Recap (H22), never a push (E15).
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import Badge from '../../ui/Badge.svelte';
  import SectionLabel from '../../ui/SectionLabel.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import Button from '../../ui/Button.svelte';
  import RankMedal from '../../ui/RankMedal.svelte';
  import type { IconName } from '../../ui/icons';
  import { RANKS, STARS } from '../../domain/ranks';
  import { addDays } from '../../domain/day';
  import { fullDate, plural, shortName } from '../../domain/format';
  import { nextUp, sortMedals, type Medal } from '../../domain/stats';
  import { loadStats, medals, type StatsData } from '../../data/stats';

  let { onback, onhabit }: { onback: () => void; onhabit: (eventId: string) => void } = $props();

  let data = $state.raw<StatsData | null>(null);
  let list = $state.raw<Medal[]>([]);
  let how = $state(false);
  onMount(async () => { const d = await loadStats(); data = d; list = await medals(d); });

  const sorted = $derived(sortMedals(list));
  const labelOf = (id: string) => RANKS.find((r) => r.id === id)!;
  const anyRank = $derived(sorted.some((m) => m.rank));
  const next = $derived(nextUp(sorted));
  const sub = (m: Medal) => {
    const run = m.held > 0 ? `run of ${plural(m.held, 'day')}` : 'no run now';
    if (!m.rank) return m.held > 0 ? `No medal yet · day ${m.held}` : 'No medal yet';
    return `${m.rank === 'master' ? 'Mastered' : labelOf(m.rank).label} · ${run}`;
  };
  const progress = (m: Medal) => (m.next ? { value: m.held, of: m.next.days } : null);
  const nextTitle = $derived(!next ? '' : anyRank ? `Next · ${shortName(next.title)} becomes ${labelOf(next.next!.rank).label}` : `Next · ${labelOf(next.next!.rank).label}`);
  const nextBody = $derived.by(() => {
    if (!next || !data) return '';
    const days = next.next!.daysLeft;
    if (anyRank) return `In ${plural(days, 'day')}, if it is never missed twice in a row.`;
    return `In ${plural(days, 'day')}, on ${fullDate(addDays(data.ctx.today, days))}: each habit that is not missed twice in a row gets its first medal.`;
  });
  const sample = $derived(sorted.find((m) => m.icon)?.icon ?? 'sprout');
  const WHEN: Record<string, string> = { starter: '10 days', builder: '30 days', keeper: '90 days', artisan: '6 months', master: '1 year' };
</script>

<main class="screen badges">
  <TopBar type="navigation" title="Badges" leftLabel="Stats" rightLabel="How it works" onleft={onback} onright={() => (how = true)} />
  <p class="t-body-small intro">Each habit has its own medal. Its shape and colour show the rank; the icon is the one you picked. A rank is held while you never miss twice in a row, and it is never lost.</p>
  {#if sorted.length}
    <SectionLabel text="Your medals · {sorted.length}" />
    <ul>
      {#each sorted as m (m.eventId)}
        <li><Badge title={m.title} sub={sub(m)} rank={m.rank} icon={m.icon as IconName} progress={progress(m)} onclick={() => onhabit(m.eventId)} /></li>
      {/each}
    </ul>
    {#if next}
      <section class="next">
        <p class="t-body-strong">{nextTitle}</p>
        <p class="t-body-small secondary">{nextBody}</p>
      </section>
    {/if}
  {:else}
    <p class="t-body-default secondary">No habits yet. Medals appear here once a calendar is tracked as habits.</p>
  {/if}
</main>

<Sheet open={how} title="How ranks work" onclose={() => (how = false)}>
  <div class="sheet">
    <p class="t-body-default secondary">Your {sorted.length ? shortName(sorted[0]!.title) : 'habit'} medal at each rank. The stars fill the ring; the icon stays yours.</p>
    <ul class="ladder">
      {#each RANKS as r (r.id)}
        <li>
          <RankMedal rank={r.id} icon={sample as IconName} label="{r.label} medal" />
          <span class="t-body-strong grow">{r.label}</span>
          <span class="t-number-small tertiary">{STARS[r.id]} {STARS[r.id] === 1 ? "star" : "stars"} · {WHEN[r.id]}</span>
        </li>
      {/each}
    </ul>
    <p class="t-body-small secondary">A run grows every day the habit is not missed twice in a row; the second miss in a row ends it. The rank you reached stays. At Master the medal is yours for good and the run keeps counting.</p>
    <Button onclick={() => (how = false)}>Done</Button>
  </div>
</Sheet>

<style>
  .badges { display: flex; flex-direction: column; gap: var(--space-8); padding-bottom: var(--space-40); }
  .intro, .secondary { color: var(--text-secondary); }
  .tertiary { color: var(--text-tertiary); }
  .next { display: grid; gap: var(--space-4); margin-top: var(--space-16); padding: var(--space-12) var(--space-16); background: var(--bg-subtle); border-radius: var(--radius-control); }
  .sheet { display: grid; gap: var(--space-16); padding-bottom: var(--space-40); }
  .ladder li { display: flex; align-items: center; gap: var(--space-12); border-bottom: var(--stroke-hairline) solid var(--border-divider); }
  .ladder li:last-child { border-bottom: none; }
  .ladder :global(.medal) { width: calc(var(--size-control) + var(--space-8)); height: calc(var(--size-control) + var(--space-8)); }
  .grow { flex: 1; }
</style>
