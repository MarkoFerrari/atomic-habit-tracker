import { describe, expect, it } from 'vitest';
import { detectBrowser } from './context';

describe('detectBrowser', () => {
  it('recognises iPhone browsers', () => {
    expect(detectBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1')).toBe('Safari');
    expect(detectBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Ddg/18.5 Safari/604.1')).toBe('DuckDuckGo');
    expect(detectBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1')).toBe('Chrome');
  });
  it('admits when it cannot tell (installed apps may drop the browser token)', () => {
    expect(detectBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148')).toBe('Unknown');
  });
});
