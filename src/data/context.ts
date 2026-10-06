// Where is ATOMIC running? Build test 0 records this next to every entry,
// because on iPhone a browser tab and the installed app keep separate storage (031, 058).
export type Browser = 'Safari' | 'DuckDuckGo' | 'Chrome' | 'Firefox' | 'Edge' | 'Unknown';
export interface RunContext { installed: boolean; browser: Browser; timeZone: string }

export function detectBrowser(ua: string): Browser {
  if (/Ddg\//.test(ua) || /DuckDuckGo/.test(ua)) return 'DuckDuckGo';
  if (/CriOS/.test(ua)) return 'Chrome';
  if (/FxiOS/.test(ua)) return 'Firefox';
  if (/EdgiOS/.test(ua)) return 'Edge';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
  return 'Unknown';
}

export function isInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || matchMedia('(display-mode: standalone)').matches;
}

export function runContext(): RunContext {
  return { installed: isInstalled(), browser: detectBrowser(navigator.userAgent), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
