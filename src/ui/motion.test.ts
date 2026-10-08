import { describe, expect, it } from 'vitest';
import { durationMs } from './motion';

describe('durationMs (U10)', () => {
  it('reads ms and the minified s form alike', () => {
    expect(durationMs('250ms')).toBe(250);
    expect(durationMs('.25s')).toBe(250);
    expect(durationMs('5s')).toBe(5000);
    expect(durationMs(' 1.2s ')).toBe(1200);
    expect(durationMs('')).toBe(0);
  });
});
