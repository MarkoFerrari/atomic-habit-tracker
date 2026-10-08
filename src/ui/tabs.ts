// Root tabs (097, habits first): Today, Habits, Stats, Settings. The Calendar left the tab bar; it opens from
// Settings when "Show my events" is on.
export type Tab = 'today' | 'habits' | 'stats' | 'settings';
export const READY_TABS: Tab[] = ['today', 'habits', 'stats', 'settings'];
