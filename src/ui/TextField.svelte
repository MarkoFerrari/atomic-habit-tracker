<script lang="ts">
  // Text field (Figma 36:329): single-line input. Help text optional, except in Error.
  interface Props {
    value?: string;
    label?: string;
    placeholder?: string;
    help?: string;
    error?: string;
    readonly?: boolean;
    autocomplete?: HTMLInputElement['autocomplete'];
    autocapitalize?: 'none' | 'sentences' | 'words';
    spellcheck?: boolean;
    /** Style B: the label inside a stone box, no outline, for fields on a white card (N1). */
    filled?: boolean;
  }
  let { value = $bindable(''), label, placeholder, help, error, readonly = false, autocomplete = 'off', autocapitalize = 'none', spellcheck = false, filled = false }: Props = $props();
  const id = `field-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="field" class:filled>
  {#if label}<label class="t-label-small label" for={id}>{label}</label>{/if}
  <input
    {id} class="t-body-default" class:error={!!error} bind:value {placeholder} {readonly} {autocomplete}
    {autocapitalize} {spellcheck} aria-invalid={!!error} aria-describedby={error || help ? `${id}-help` : undefined}
  />
  {#if error || help}<p id="{id}-help" class="t-label-small help" class:error={!!error}>{error ?? help}</p>{/if}
</div>

<style>
  .field { display: grid; gap: var(--space-4); }
  .filled { gap: 0; padding: var(--space-12) var(--space-16); background: var(--bg-app); border-radius: var(--radius-tile); }
  .filled:focus-within { box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-strong); }
  .filled input { min-height: var(--size-icon); padding: 0; background: none; box-shadow: none; }
  .filled input:focus, .filled input:focus-visible { box-shadow: none; }
  .label { color: var(--text-secondary); }
  input {
    min-height: var(--size-control); padding: 0 var(--space-12); width: 100%;
    border: 0; border-radius: var(--radius-control); background: var(--bg-default); color: var(--text-primary);
    box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-control); /* 019: a meaningful outline at 3:1 */
  }
  /* U07: no heavy ring on focus; the same hairline just gets darker */
  input:focus, input:focus-visible { outline: none; box-shadow: inset 0 0 0 var(--stroke-hairline) var(--border-strong); }
  input.error { box-shadow: inset 0 0 0 var(--stroke-icon) var(--action-primary); }
  input::placeholder { color: var(--text-disabled); }
  .help { color: var(--text-tertiary); }
  .help.error { color: var(--text-accent); }
</style>
