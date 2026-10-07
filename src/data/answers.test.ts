import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, wipeDbForTests } from './db';
import { answer, answersOn, ReadOnlyAnswerError, undoAnswer } from './answers';
import type { IsoDay } from '../domain/day';

const d = (s: string) => s as IsoDay;
beforeEach(() => wipeDbForTests());

describe('answers', () => {
  it('keeps an append-only history when an answer changes (E4)', async () => {
    await answer('h1', d('2026-10-06'), 'skipped', d('2026-10-06'), 'no-time');
    await answer('h1', d('2026-10-06'), 'done', d('2026-10-07'));
    const [a] = await answersOn(d('2026-10-06'));
    expect(a).toMatchObject({ status: 'done', eventId: 'h1' });
    expect(a!.reason).toBeUndefined();
    expect(a!.history.map((h) => [h.from, h.to])).toEqual([[null, 'skipped'], ['skipped', 'done']]);
  });
  it('undo restores what was there, or removes a fresh answer (H12)', async () => {
    const first = await answer('h1', d('2026-10-06'), 'done', d('2026-10-06'));
    expect(first).toBeNull();
    await undoAnswer('h1', d('2026-10-06'), first);
    expect(await answersOn(d('2026-10-06'))).toEqual([]);

    await answer('h1', d('2026-10-06'), 'skipped', d('2026-10-06'));
    const before = await answer('h1', d('2026-10-06'), 'done', d('2026-10-06'));
    await undoAnswer('h1', d('2026-10-06'), before);
    expect((await (await db()).get('answers', 'h1|2026-10-06'))?.status).toBe('skipped');
  });
  it('answers older than 7 days are read-only (R2)', async () => {
    await expect(answer('h1', d('2026-09-29'), 'done', d('2026-10-06'))).rejects.toBeInstanceOf(ReadOnlyAnswerError);
  });
});
