<script lang="ts">
  // Toast (Figma 37:448): "Breakfast marked done · Undo". Holds for toast-hold (5 s), then leaves on its own.
  // Motion (page 11, 01 Check-off): enters in 250 ms (enter); reduced motion fades (motion.css).
  interface Props { message: string; actionLabel?: string; onaction?: () => void; ondismiss: () => void }
  let { message, actionLabel = 'Undo', onaction, ondismiss }: Props = $props();
  let el: HTMLElement;

  $effect(() => {
    const token = '--motion-duration-toast-hold';
    const hold = parseFloat(getComputedStyle(el).getPropertyValue(token) || getComputedStyle(document.documentElement).getPropertyValue(token)) || 0;
    const timer = setTimeout(ondismiss, hold);
    return () => clearTimeout(timer);
  });
</script>

<div class="toast" role="status" bind:this={el}>
  <span class="t-body-small">{message}</span>
  {#if onaction}<button class="t-body-strong" onclick={() => { onaction?.(); ondismiss(); }}>{actionLabel}</button>{/if}
</div>

<style>
  .toast {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-16);
    min-height: var(--size-control); padding: 0 var(--space-16);
    background: var(--bg-inverse); color: var(--text-inverse); border-radius: var(--radius-control);
    animation: toast-in var(--motion-duration-base) var(--motion-easing-enter);
  }
  button { color: var(--text-inverse); min-height: var(--size-touch); }
  @keyframes toast-in { from { transform: translateY(var(--space-24)); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>
