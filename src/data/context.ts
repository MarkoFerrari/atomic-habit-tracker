// Where is ATOMIC running? Build test 0 records this next to every entry,
// because on iPhone a browser tab and the installed app keep separate storage (031, 058).
export type Browser = 'Safari' | 'DuckDuckGo' | 'Chrome' | 'Firefox' | 'Edge' | 'Home Screen app' | 'Unknown';
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
  const installed = isInstalled();
  // Build test 0 finding (6 Oct 2026): an app installed from DuckDuckGo reports a plain Safari user agent,
  // because iOS runs Home Screen web apps in its own WebKit container, not inside the browser that added them.
  // So the installing browser can't be detected once installed; say what it is instead of guessing.
  const browser = installed ? 'Home Screen app' : detectBrowser(navigator.userAgent);
  return { installed, browser, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
