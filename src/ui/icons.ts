// Icons: Lucide (ISC), self-hosted from lucide-static at build time (030). Never loaded from a CDN.
// Names follow the Figma Components board (Icon/*); where Figma renamed a Lucide icon, the map says which.
// Only the icons ATOMIC uses are bundled. Adding one: add it to UI or HABIT_ICONS, then to this list.
const files = import.meta.glob(
  '/node_modules/lucide-static/icons/{apple,armchair,award,bed,bell,biceps-flexed,bike,book,book-open,book-open-text,brain,brick-wall,brush,calendar,camera,chart-column,check,chef-hat,chevron-left,chevron-right,circle-check,clock,coffee,cooking-pot,crown,cup-soda,download,dumbbell,flower-2,footprints,gamepad-2,gem,glass-water,graduation-cap,hammer,headphones,heart,heart-pulse,hourglass,info,laugh,link,lock,milk,moon,moon-star,mountain,music,notebook-pen,palette,party-popper,pen-line,pencil,person-standing,pill,plus,refresh-cw,salad,sandwich,settings-2,shield-check,smile,sofa,soup,sparkles,sprout,stethoscope,sun,timer,trash-2,trees,triangle-alert,undo-2,upload,utensils,video,waves,x}.svg',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Figma name → Lucide name, for the UI icons on the Components board. */
const UI = {
  check: 'check', close: 'x', plus: 'plus', 'chevron-right': 'chevron-right', 'chevron-left': 'chevron-left',
  calendar: 'calendar', stats: 'chart-column', settings: 'settings-2', today: 'sun', bell: 'bell', clock: 'clock',
  video: 'video', link: 'link', award: 'award', download: 'download', upload: 'upload', lock: 'lock',
  alert: 'triangle-alert', refresh: 'refresh-cw', spark: 'sparkles', 'perfect-day': 'circle-check', undo: 'undo-2',
  trash: 'trash-2', edit: 'pencil', info: 'info',
  'rank-starter': 'footprints', 'rank-builder': 'brick-wall', 'rank-keeper': 'shield-check', 'rank-artisan': 'gem', 'rank-master': 'crown',
} as const;

/** 043: habit icons, Lucide names as in Figma, in the order of the icon picker (H45b). */
export const HABIT_ICONS = [
  'dumbbell', 'biceps-flexed', 'bike', 'person-standing', 'timer',
  'coffee', 'glass-water', 'cup-soda', 'milk',
  'book-open', 'book', 'book-open-text', 'notebook-pen', 'graduation-cap', 'brain', 'pen-line',
  'moon', 'bed', 'sofa', 'armchair', 'moon-star', 'hourglass',
  'smile', 'laugh', 'party-popper', 'music', 'headphones', 'gamepad-2',
  'utensils', 'salad', 'apple', 'sandwich', 'soup', 'chef-hat', 'cooking-pot',
  'heart-pulse', 'heart', 'pill', 'stethoscope',
  'sprout', 'mountain', 'trees', 'waves', 'palette', 'brush', 'hammer', 'camera', 'flower-2',
] as const;

export type UiIcon = keyof typeof UI;
export type HabitIcon = (typeof HABIT_ICONS)[number];
export type IconName = UiIcon | HabitIcon;

const inner = (lucide: string): string => {
  const raw = files[`/node_modules/lucide-static/icons/${lucide}.svg`];
  if (!raw) throw new Error(`Missing Lucide icon: ${lucide}`);
  return raw.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
};

export function iconMarkup(name: IconName): string {
  return inner((UI as Record<string, string>)[name] ?? name);
}

export function isHabitIcon(name: string): name is HabitIcon {
  return (HABIT_ICONS as readonly string[]).includes(name);
}
