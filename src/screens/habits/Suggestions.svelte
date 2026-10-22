<script lang="ts">
  // 136 Suggested habits (Playground section 19, S1): before the empty New habit form, eight common habits to start
  // from. A tap opens the same form with that habit filled in, every row editable (S2); "Create new habit" opens it
  // blank. Each card sits on its object's field (123). The last one is a reminder, not a habit (130), and says so.
  import TopBar from '../../ui/TopBar.svelte';
  import Button from '../../ui/Button.svelte';
  import HabitObject from '../../ui/HabitObject.svelte';
  import { fieldColor } from '../../ui/objects';
  import { SUGGESTED, type Suggestion } from '../../data/suggestions';

  interface Props { onback: () => void; onpick: (s: Suggestion) => void; onblank: () => void }
  let { onback, onpick, onblank }: Props = $props();
</script>

<main class="screen suggest">
  <TopBar type="navigation" title="New habit" leftLabel="Back" onleft={onback} />
  <p class="t-body-default secondary">Pick one to start from. You can change everything.</p>
  <ul class="grid">
    {#each SUGGESTED as s (s.id)}
      <li>
        <button class="pick" style:--field={fieldColor(s.icon)} onclick={() => onpick(s)} aria-label="{s.title}. {s.meta}">
          <HabitObject icon={s.icon} size="sm" />
          <span class="t-body-strong name">{s.title}</span>
          <span class="t-label-small secondary">{s.meta}</span>
        </button>
      </li>
    {/each}
  </ul>
  <div class="cta"><Button variant="card" onclick={onblank}>Create new habit</Button></div>
</main>

<style>
  .suggest { display: flex; flex-direction: column; gap: var(--space-16); padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-40)); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-12); }
  .pick { width: 100%; height: 100%; display: grid; align-content: start; justify-items: start; gap: var(--space-4); text-align: left;
    padding: var(--space-16); background: var(--field); border-radius: var(--radius-card); min-height: var(--size-touch); }
  .pick :global(.object) { margin-bottom: var(--space-8); }
  .name { overflow-wrap: anywhere; }
  .cta { padding-top: var(--space-8); }
  .secondary { color: var(--text-secondary); }
</style>
