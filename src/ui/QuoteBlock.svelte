<script lang="ts">
  // Quote block (Figma Playground Q1, C1, C2; 107, 108, 110): a quote and its source, then one line of proof from
  // the habit itself. No box (014): a section label, words, a bar. The quote is the frame; the proof is the content.
  import SectionLabel from './SectionLabel.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import type { Quote } from '../domain/quotes';

  interface Props {
    label?: string;
    quote: Quote;
    line?: string;
    bar?: { value: number; of: number; stops: readonly number[]; rank: string };
    onopen?: () => void;
  }
  let { label, quote, line, bar, onopen }: Props = $props();
</script>

<section class="quote-block" aria-label={label ?? 'Quote'}>
  {#if label}<SectionLabel text={label} />{/if}
  <figure>
    <blockquote class="t-heading-small">“{quote.text}”</blockquote>
    <figcaption class="t-label-small source">{quote.source}</figcaption>
  </figure>
  {#if line || bar}
    <button class="proof" disabled={!onopen} onclick={onopen}>
      {#if line}<span class="t-body-small line">{line}</span>{/if}
      {#if bar}<ProgressBar value={bar.value} of={bar.of} ticks={bar.stops} label="Toward {bar.rank}" />{/if}
    </button>
  {/if}
</section>

<style>
  .quote-block { display: grid; gap: var(--space-8); }
  figure { display: grid; gap: var(--space-4); margin: 0; }
  blockquote { margin: 0; color: var(--text-primary); }
  .source { color: var(--text-tertiary); }
  .proof { display: grid; gap: var(--space-4); width: 100%; text-align: left; padding-top: var(--space-4); }
  .proof:disabled { cursor: default; }
  .line { color: var(--text-secondary); }
</style>
