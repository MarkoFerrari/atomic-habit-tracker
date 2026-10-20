import { describe, expect, it } from 'vitest';
import { HABIT_ICONS } from './icons';
import { MISSING_OBJECTS, OBJECT_GROUPS, fieldColor } from './objects';

describe('habit objects (122, 123)', () => {
  it('every habit icon has its 3D object and exactly one group', () => {
    expect(MISSING_OBJECTS).toEqual([]);
    const grouped = OBJECT_GROUPS.flatMap((g) => g.icons);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...HABIT_ICONS].sort());
  });
  it('the field comes from the group, never chosen', () => {
    expect(fieldColor('glass-water')).toBe('var(--field-drink)');
    expect(fieldColor(undefined)).toBe('var(--field-make)');
  });
});
