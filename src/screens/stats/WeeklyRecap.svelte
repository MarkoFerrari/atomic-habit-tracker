<script lang="ts">
  // H39 Weekly recap (Figma 53:2864): one pattern to act on, not a report (Figma note). Kaizen (080): the pattern ends in
  // one adjustment to try for two weeks, then a review against the weeks before. One variable at a time, so the review can
  // say whether it worked. The app proposes from the skip reasons; the person can write their own. No streak drama (E14).
  import { onMount } from 'svelte';
  import TopBar from '../../ui/TopBar.svelte';
  import Stat from '../../ui/Stat.svelte';
  import ListRow from '../../ui/ListRow.svelte';
  import KvRow from '../../ui/KvRow.svelte';
  import Button from '../../ui/Button.svelte';
  import Icon from '../../ui/Icon.svelte';
  import Sheet from '../../ui/Sheet.svelte';
  import TextField from '../../ui/TextField.svelte';
  import { SKIP_REASON_LABEL } from '../../ui/copy';
  import { addDays, type IsoDay } from '../../domain/day';
  import { fullDate, percent, shortName, weekdayShort } from '../../domain/format';
  import { habitDays, patternSentence, rateOf, weeklyRecap, type WeeklyRecap } from '../../domain/stats';
  import { activeAdjustment, proposeAdjustment, review, reviewIsDue, reviewLine, startAdjustment, TRIAL_DAYS, type Adjustment } from '../../domain/adjust';
  import { loadStats, markRecapSeen, saveAdjustments, type StatsData } from '../../data/stats';

  interface Props { weekStart: IsoDay; onback: () => void; onhabit: (eventId: string) => void }
  let { weekStart, onback, onhabit }: Props = $props();

  let data = $state.raw<StatsData | null>(null);
  let adjustments = $state.raw<Adjustment[]>([]);
  let writing = $state(false);
  let own = $state('');
  let busy = $state(false);

  onMount(async () => {
    const d = await loadStats();
    data = d;
    adjustments = d.adjustments;
    await markRecapSeen(weekStart); // H34: the banner stays until the recap is opened
  });

  const ctx = $derived(data?.ctx ?? null);
  const recap = $derived<WeeklyRecap | null>(ctx ? weeklyRecap(ctx, weekStart) : null);
  const trial = $derived(activeAdjustment(adjustments));
  const due = $derived(!!trial && !!ctx && reviewIsDue(trial, ctx.today));

  /** done ÷ due of one habit over a stretch of days (033: only decided days count). */
  function windowRate(habitId: string, from: IsoDay, to: IsoDay) {
    if (!ctx) return { done: 0, due: 0 };
    const r = rateOf(habitDays({ ...ctx, habits: ctx.habits.filter((h) => h.id === habitId) }, from, to));
    return { done: r.done, due: r.due };
  }
  const nowRate = $derived(trial && ctx ? windowRate(trial.habitId, trial.startedOn, ctx.today) : { done: 0, due: 0 });
  const proposal = $derived(recap?.pattern
    ? proposeAdjustment({ title: recap.pattern.title, minutes: recap.pattern.minutes, reason: recap.pattern.reason },
      recap.best && recap.best.eventId !== recap.pattern.eventId ? recap.best.title : null)
    : '');

  async function persist(next: Adjustment[]) {
    busy = true;
    try { adjustments = next; await saveAdjustments(next); } finally { busy = false; }
  }
  async function begin(text: string) {
    if (!ctx || !recap?.pattern || !text.trim()) return;
    const habitId = recap.pattern.eventId;
    const baseline = windowRate(habitId, addDays(ctx.today, -TRIAL_DAYS), addDays(ctx.today, -1));
    const a = startAdjustment({ id: crypto.randomUUID(), habitId, habitTitle: recap.pattern.title, text, baseline }, ctx.today);
    writing = false;
    own = '';
    await persist([...adjustments, a]);
  }
  async function decide(choice: 'keep' | 'drop') {
    if (!trial || !ctx) return;
    await persist(review(adjustments, trial.id, choice, nowRate, ctx.today));
  }

  const pct = (r: number | null) => percent(r);
  const when = (d: IsoDay) => `${weekdayShort(d)} ${fullDate(d).split(' ').slice(1).join(' ')}`;
  const reasonLabel = SKIP_REASON_LABEL;
</script>

<main class="screen recap">
  <TopBar type="navigation" title="" leftLabel="Stats" onleft={onback} />
  {#if data && !recap && !trial}
    <h1 class="t-heading-large">Weekly recap</h1>
    <p class="t-body-default secondary">Not enough days yet. A recap needs a few answered days in a week, and days before the start are never counted as missed.</p>
  {/if}

  {#if recap}
    <header>
      <p class="t-body-small tertiary">{recap.label}</p>
      <h1 class="t-heading-large">{recap.title}</h1>
    </header>
    <Stat value={pct(recap.rate.rate)} caption="{recap.rate.done} of {recap.rate.due} due{recap.previous.due ? ` · week ${recap.number - 1} was ${pct(recap.previous.rate)}` : ''}" />
    <div class="rows">
      {#if recap.best}<ListRow label="Best habit" value="{shortName(recap.best.title)} · {pct(recap.best.rate.rate)}" onclick={() => onhabit(recap!.best!.eventId)} />{/if}
      {#if recap.weakest}<ListRow label="Weakest" value="{shortName(recap.weakest.title)} · {pct(recap.weakest.rate.rate)}" onclick={() => onhabit(recap!.weakest!.eventId)} />{/if}
      {#if recap.bestDay}<KvRow label="Best day" value="{fullDate(recap.bestDay.day).split(' ')[0]} · {recap.bestDay.rate.done} of {recap.bestDay.rate.due}" />{/if}
      {#if recap.parts}<KvRow label="Morning vs evening" value="{pct(recap.parts.morning.rate)} vs {pct(recap.parts.evening.rate)}" />{/if}
    </div>
  {/if}

  {#if recap?.pattern}
    <section class="card">
      <Icon name="info" />
      <div class="text">
        <p class="t-body-strong">One pattern</p>
        <p class="t-body-default secondary">{patternSentence(recap.pattern, (r) => reasonLabel[r])}</p>
      </div>
    </section>
  {:else if recap}
    <section class="card">
      <Icon name="check" />
      <div class="text">
        <p class="t-body-strong">Nothing to change</p>
        <p class="t-body-default secondary">{recap.rate.rate === 1 ? 'Every habit held this week.' : 'No habit stood out this week.'} Keep going.</p>
      </div>
    </section>
  {/if}

  <!-- 080: one adjustment at a time -->
  {#if trial && due}
    <section class="card kaizen">
      <Icon name="refresh" />
      <div class="text">
        <p class="t-body-strong">Review · {shortName(trial.habitTitle)}</p>
        <p class="t-body-default secondary">{trial.text}</p>
        {#if reviewLine(trial, nowRate)}<p class="t-number-small tertiary">{reviewLine(trial, nowRate)}</p>{/if}
        <p class="t-body-small tertiary">Keep it for two more weeks, or drop it and look at the next pattern.</p>
      </div>
    </section>
    <div class="actions">
      <Button variant="secondary" disabled={busy} onclick={() => decide('keep')}>Keep for 2 more weeks</Button>
      <Button variant="tertiary" disabled={busy} onclick={() => decide('drop')}>Drop it</Button>
    </div>
  {:else if trial}
    <section class="card kaizen">
      <Icon name="refresh" />
      <div class="text">
        <p class="t-body-strong">Trying until {when(trial.reviewOn)}</p>
        <p class="t-body-default secondary">{trial.text}</p>
        <p class="t-body-small tertiary">One change at a time. The review compares it with the two weeks before.</p>
      </div>
    </section>
  {:else if recap?.pattern}
    <section class="card kaizen">
      <Icon name="spark" />
      <div class="text">
        <p class="t-body-strong">One adjustment to try</p>
        <p class="t-body-default secondary">{proposal}</p>
      </div>
    </section>
    <div class="actions">
      <Button variant="secondary" disabled={busy} onclick={() => begin(proposal)}>Try for 2 weeks</Button>
      <Button variant="tertiary" onclick={() => { own = proposal; writing = true; }}>Write my own</Button>
    </div>
  {/if}

  <div class="spacer"></div>
  {#if recap?.pattern}
    <Button variant="secondary" onclick={() => onhabit(recap!.pattern!.eventId)}>See {shortName(recap.pattern.title)}</Button>
  {/if}
  <Button onclick={onback}>Done</Button>
</main>

<Sheet open={writing} title="Your adjustment" onclose={() => (writing = false)}>
  <div class="sheet">
    <p class="t-body-small secondary">One small change to one habit, for two weeks. After that, ATOMIC shows how it went.</p>
    <TextField bind:value={own} placeholder="For example: only the first 5 minutes" autocapitalize="sentences" />
    <Button disabled={!own.trim() || busy} onclick={() => begin(own)}>Try for 2 weeks</Button>
  </div>
</Sheet>

<style>
  .recap { display: flex; flex-direction: column; gap: var(--space-16); padding-bottom: var(--space-32); }
  .tertiary { color: var(--text-tertiary); }
  .secondary { color: var(--text-secondary); }
  .rows { display: grid; }
  .card { display: flex; gap: var(--space-12); padding: var(--space-16); background: var(--bg-subtle); border-radius: var(--radius-control); }
  .text { display: grid; gap: var(--space-4); min-width: 0; }
  .actions { display: grid; gap: var(--space-8); }
  .spacer { flex: 1; min-height: var(--space-16); }
  .sheet { display: grid; gap: var(--space-16); padding-bottom: var(--space-40); }
</style>
