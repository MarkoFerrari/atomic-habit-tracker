// Style B (decision 122): every habit icon has a glossy 3D object, cut from the Figma Playground section 14
// (Habit object/<lucide name>), exported at 2x and shipped as small WebP files bundled with the app (030: nothing
// is fetched from elsewhere). The object's group gives the habit its colour field, so a colour is never chosen and
// never means good or bad (123). Below 32 px, and for icons without an object, the 2D Lucide icon stays.
import { HABIT_ICONS, type HabitIcon } from './icons';

const files = import.meta.glob('/src/assets/objects/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export type FieldGroup = 'move' | 'drink' | 'learn' | 'rest' | 'joy' | 'food' | 'health' | 'make';

/** The picker's groups, in order, each with its field token (Figma variables field/*). */
export const OBJECT_GROUPS: { id: FieldGroup; label: string; icons: HabitIcon[] }[] = [
  { id: 'move', label: 'Move', icons: ['dumbbell', 'biceps-flexed', 'bike', 'person-standing', 'timer'] },
  { id: 'drink', label: 'Drink', icons: ['coffee', 'glass-water', 'cup-soda', 'milk'] },
  { id: 'learn', label: 'Learn', icons: ['book-open', 'book', 'book-open-text', 'notebook-pen', 'graduation-cap', 'brain', 'pen-line'] },
  { id: 'rest', label: 'Rest', icons: ['moon', 'bed', 'sofa', 'armchair', 'moon-star', 'hourglass'] },
  { id: 'joy', label: 'Joy', icons: ['smile', 'laugh', 'party-popper', 'music', 'headphones', 'gamepad-2'] },
  { id: 'food', label: 'Food', icons: ['utensils', 'salad', 'apple', 'sandwich', 'soup', 'chef-hat', 'cooking-pot'] },
  { id: 'health', label: 'Health', icons: ['heart-pulse', 'heart', 'pill', 'stethoscope'] },
  { id: 'make', label: 'Make and outdoors', icons: ['sprout', 'mountain', 'trees', 'waves', 'palette', 'brush', 'hammer', 'camera', 'flower-2'] },
];

const GROUP_OF = new Map<string, FieldGroup>(OBJECT_GROUPS.flatMap((g) => g.icons.map((i) => [i, g.id] as const)));

/** The URL of an icon's 3D object, or undefined when it has none (UI icons). */
export function objectUrl(icon: string): string | undefined {
  return files[`/src/assets/objects/${icon}.webp`];
}

/** The group of a habit icon; habits without an icon use the Make group (sprout is the default icon). */
export function groupOf(icon: string | undefined): FieldGroup {
  return GROUP_OF.get(icon ?? 'sprout') ?? 'make';
}

/** The CSS colour of a habit's field: its object's group. */
export function fieldColor(icon: string | undefined): string {
  return `var(--field-${groupOf(icon)})`;
}

// Every picker icon has its object; a missing file is a build mistake, caught by the test.
export const MISSING_OBJECTS = HABIT_ICONS.filter((i) => !objectUrl(i));
