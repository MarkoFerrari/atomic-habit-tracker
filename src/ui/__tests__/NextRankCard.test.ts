// @vitest-environment jsdom
// 135: the next-rank card, option B: the bar runs from the rank held to the next rank, with a tick at each milestone.
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import NextRankCard from '../NextRankCard.svelte';

afterEach(cleanup);

describe('Next rank card (135)', () => {
  it('Builder at day 49: 41 days to Keeper, 19 of 60 in, three ticks (45, 60, 75 held)', () => {
    const { container } = render(NextRankCard, { rank: 'builder', next: { rank: 'keeper', daysLeft: 41, days: 90 }, held: 49, icon: 'book-open' });
    expect(screen.getByText('Next rank · Keeper')).toBeTruthy();
    expect(screen.getByText('41 days to go')).toBeTruthy();
    const fill = container.querySelector('.fill') as HTMLElement;
    expect(parseFloat(fill.style.width)).toBeCloseTo((19 / 60) * 100, 1);
    expect(container.querySelectorAll('.tick')).toHaveLength(3);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('49');
  });
  it('starts from zero before any rank', () => {
    const { container } = render(NextRankCard, { rank: null, next: { rank: 'starter', daysLeft: 7, days: 10 }, held: 3, icon: 'sprout' });
    expect(parseFloat((container.querySelector('.fill') as HTMLElement).style.width)).toBeCloseTo(30, 1);
    expect(container.querySelectorAll('.tick')).toHaveLength(1);
  });
});
