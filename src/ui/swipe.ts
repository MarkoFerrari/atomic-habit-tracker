// A horizontal swipe on a strip or a grid: left goes forward in time, right goes back.
// Vertical scrolling is left alone: the swipe only counts when it is clearly sideways.
interface Options { onleft: () => void; onright: () => void }

export function swipe(node: HTMLElement, options: Options) {
  let opts = options;
  let start: { x: number; y: number; id: number } | null = null;
  const MIN = 48; // px, about a fingertip and a half

  const down = (e: PointerEvent) => { if (e.isPrimary) start = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
  const up = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) < MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) opts.onleft(); else opts.onright();
  };
  const cancel = () => { start = null; };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', cancel);
  return {
    update(next: Options) { opts = next; },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
    },
  };
}
