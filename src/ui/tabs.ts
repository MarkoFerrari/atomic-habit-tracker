// Root tabs, and which of them have screens (TabBar greys out the rest until they're built).
export type Tab = 'today' | 'calendar' | 'stats' | 'settings';
export const READY_TABS: Tab[] = ['today', 'calendar', 'settings'];
