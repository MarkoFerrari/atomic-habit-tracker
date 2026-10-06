import { describe, expect, it } from 'vitest';
import { percent, progress, rateLabel } from './format';

describe('number formatting (061)', () => {
  it('never pads with zeros', () => {
    expect(percent(0.82)).toBe('82%');
    expect(percent(0.075)).toBe('8%');
    expect(percent(0)).toBe('0%');
    expect(percent(1)).toBe('100%');
    expect(progress(10, 30)).toBe('10/30');
  });
  it('shows no rate, not 0%, when nothing was due (033)', () => {
    expect(percent(null)).toBe('–');
  });
  it('keeps the number due next to the rate (006)', () => {
    expect(rateLabel({ done: 3, due: 4, rate: 0.75 })).toBe('75% · 4 due');
  });
});
