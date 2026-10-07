# ATOMIC · Habit Tracker

This file is the build spec for ATOMIC. Read it before every build session; it outranks memory and habit.

ATOMIC is a calendar and habit tracker in one, installed onto an iPhone Home Screen from any browser that can add web apps (Safari, Chrome, DuckDuckGo). Every event in the HABITS calendar has to be answered by the end of the day: done or skipped. A push arrives when each habit starts, and the owner answers in the app (069); the in-app Evening Recap closes the day. Over months, the app shows which habits held and which didn't.

- Design (the source of truth): https://www.figma.com/design/wbZAtFDM2FazPT8wHTHJP2/Atomic-Habits
- Owner: Marko Ferrari, the designer and main user. Close friends may try it on their own phones (059): nothing is built for them, but nothing blocks them.
- Status (7 Oct 2026): **M0 passed on device (GO).** M1 deployed. **M2 built**: onboarding with the first import (065), Today, the Evening Recap; a push when each habit starts, no 22:30 recap push (069). **M3 built (0.3.0)**: Calendar day/week/month, event detail, create/edit/delete with repeats, reminders for every event. **M4 built (0.4.0)**: Settings, Calendars, Habits, Notifications, Data, About; .ics re-import (E8), backup, restore (also from Welcome), backup nudge. On the phone for UX testing; M5 (Stats, ranks) next. Component gallery at `#gallery`, build test at `#build-test`.

---

## 1. Ground rules

1. **The design is the spec.** Build from Figma pages 08 (hi-fi screens), 09 (charts), 10 (edge cases) and 11 (motion), together with the Decision Log on page 02. If the code needs something the design doesn't cover, ask, then log it as a decision. Never quietly improvise.
2. **No hardcoded values.** Every colour, space, radius, stroke, type style, duration and easing comes from a token (section 6). A raw `#hex`, `px` or `ms` in a component is a bug.
3. **Zero third-party requests (030).** No CDNs, analytics, web fonts from Google or tracking pixels. Geist, Geist Mono and Lucide are self-hosted. A strict Content Security Policy allows `'self'` plus the push function's origin, and nothing else.
4. **The data never leaves the phone (020).** The only outside connection is the push function, and it never receives a readable event title (021).
5. **This repo is public.** It holds code and sample data only. Real habits, schedules, calendar exports and backups never get committed. `.gitignore` covers `*.ics`, `atomic-backup-*.json` and `.env*`.
6. **Never invent facts about the owner's life.** Fixtures and demo states use clearly labelled sample data (045).
7. **Decisions are referenced by number** (for example `// 051: a skip counts as a miss`). A new decision gets the next number in the Decision Log on Figma page 02 and in section 12.
8. **Usability changes are logged (057).** Every change made after real use gets a row on Figma page 13 (U01, U02 and so on): what happened, what changed, why. That log becomes the case study.

---

## 2. Architecture

```
iPhone (installed PWA, any browser)                   Push function (EU, CRON)
┌──────────────────────────────────────┐              ┌──────────────────────────┐
│ UI (Svelte)                          │  subscribe   │ stores: push subscription│
│ Domain rules (pure TS, tested)       │ ───────────► │         timezone         │
│ IndexedDB  ◄── the only data store   │  reminders   │         encrypted queue  │
│ Service worker: offline + push       │ ───────────► │ every minute: send due   │
│ Backup/restore: JSON via share sheet │ ◄─────────── │ (recap push: off, 069)   │
└──────────────────────────────────────┘   Web Push   └──────────────────────────┘
          ▲  static files
   GitHub Pages (this repo)
```

- **PWA (001, 029, 058).** Installed from any iPhone browser that can add to the Home Screen; the installed app is the product, whichever browser installed it. A browser tab shows a sample-data preview and the install guide; nothing is saved in a tab (031).
- **Storage (020).** IndexedDB, on the phone only, with no sync. Backup and restore use one JSON file through the share sheet (Files, Proton Drive). Restore replaces everything after a preview, and never merges (026).
- **Events (015, 022, 023).** ATOMIC is a full calendar. Events arrive once, through `.ics` import from Proton, and are created and edited in the app from then on. Re-importing matches events by UID (E8).
- **Push (016, 021, 039, 069).**
  - The function holds the Web Push subscription, the phone's time zone and a queue of upcoming reminders.
  - A CRON trigger runs every minute. It sends due reminders. The 22:30 recap push is built but switched off per phone (069).
  - Habit reminders (069): the app plans a push at each timed habit's start for the next 14 days, skipping answered occurrences, and replaces the queue every time Today loads or an answer changes. All-day habits get none. Tapping one opens Today.
  - Reminder titles are encrypted on the phone with a key that never leaves it. The service worker decrypts them when the push arrives.
  - The recap push, when on, is generic; the app builds the recap from local data when it opens (025).
- **Self-monitoring (027).** The app logs every push it receives. After 2 silent evenings, Today shows a banner with Send a test (E1). With the recap push off (069), "silent" has to be measured on reminders instead: decide before E1 is built (M6).

### Push host: Scaleway (decided 7 Oct 2026)
GitHub can't send the push. Pages only serves static files, and scheduled Actions are best effort: they often fire late, and they are disabled after 60 days without repo activity (011, 016).
- **Scaleway Serverless Functions**, Paris (`fr-par`), project ATOMIC. An EU company; CRON triggers count as ordinary invocations within the free tier.
- Memory: one JSON file per phone in a private Object Storage bucket (062). The serverless database was ruled out: an every-minute timer would never let it idle, so it would never be free.
- `.github/workflows/function.yml` builds, tests and deploys `/function` (bucket, namespace, function, secrets, timer, health check) with `function/deploy.sh`. It runs on changes to `/function` on `main`, or by hand. The Pages deploy runs after it and looks up the function's URL.
- Repo secrets (owner-managed, write-only): `SCW_ACCESS_KEY`, `SCW_SECRET_KEY` (an IAM application key limited to FunctionsFullAccess and ObjectStorageFullAccess on ATOMIC; expires Oct 2027), `SCW_DEFAULT_PROJECT_ID`, `SCW_DEFAULT_ORGANIZATION_ID`, `ATOMIC_INVITE_CODE`.

---

## 3. Stack and layout (proposed, confirm at M1)

- Vite + TypeScript (strict) + Svelte 5. Svelte compiles to small vanilla JS, which keeps the app fast on the iPhone and easy to audit.
- IndexedDB through a thin typed wrapper (`idb` is acceptable, ~1 kB, bundled), or hand-written.
- A hand-written service worker, with no Workbox, so caching is explicit.
- Vitest for domain rules; Playwright (WebKit) for smoke tests.
- Token export: a script turns the Figma variables (Primitives, Color, Dimension, Motion) into `src/styles/tokens.css`, keeping Figma's names (`--text-primary`, `--space-16`, `--motion-duration-base`).
- Deploy: a GitHub Action builds and publishes to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`). The build looks up the push function's URL on Scaleway (`VITE_PUSH_URL`) and adds that one origin to the CSP (030). The VAPID public key is fetched from the function (063).
- Branches: every session's work goes to `wip`, which never deploys; only `main` deploys.

Commands:
- `npm run dev`: local server · `npm run build`: tokens + production build into `dist/`
- `npm run check` types · `npm test` domain rules · `npm run lint:tokens` no raw values
- `npm run tokens`: regenerate `src/styles/tokens.css` from `tokens/tokens.json` (refreshed from Figma through the Figma connector)
- `npm run icons`: re-render the app icons from `design/app-icon.svg` (set `CHROMIUM_PATH` if Playwright's browser isn't installed)

```
/src
  /domain      pure rules: day boundary, states, runs, ranks, rates (no DOM, no IndexedDB)
  /data        IndexedDB stores, backup/restore, .ics import
  /push        subscription, reminder encryption, recap log
  /ui          components (Button, HabitRow, EventBlock, Sheet, TopBar, TabBar, MasteryRing, RankMedal, HeatCell, YearBar)
  /screens     one folder per Figma section (Today, Recap, Calendar, Stats, Badges, Settings, Calendars, Data)
  /styles      tokens.css (generated), base.css, motion.css
  /sw          sw.js, the service worker template (precache list injected at build)
/function      push function (host-specific adapter + shared core)
/scripts       export-tokens, lint-tokens, make-icons
/tokens        tokens.json (Figma variables and text styles)
/design        logo and app icon SVGs exported from Figma
/public        icons, manifest, fonts (self-hosted)
```

---

## 4. Domain rules

The rules live in `/src/domain` as pure functions, each with tests.

### The day
- **A day closes at 04:00 local time (R1).** Between 00:00 and 04:00, the recap shows yesterday, titled by its day ("Close Tuesday").
- At 04:00, every habit still open for the closing day becomes **missed** (052). Nobody has to answer "rest day": the one forgiven miss covers it.
- Answers can be changed for 7 days, then become read-only (R2, E4). Rates and runs recalculate; ranks already reached are never taken back.
- Habits keep **clock time**: Breakfast at 08:00 stays at 08:00 in any time zone. Other events keep **real time** and show their original zone (028, E6).
- An all-day habit sits at the top of Today with no time. A habit belongs to the day it starts (E7).

### Habit states
`open` → `running` (inside its time slot) → `done` | `skipped` | `missed`
- Skip takes an optional reason from 4 choices (007). Skipped is drawn differently from open.
- Only the habit that is running or next shows "Mark as done"; every row stays tappable and swipeable (040).
- Done always uses `state/done` green, never crimson (008).

### Rates (006)
- Completion rate = done ÷ due, with the number due always shown beside it.
- Days before tracking started, and days ahead, are outlined and excluded from rates. They never count as zero (033).

### Runs and ranks (047, 051, 055)
- A run lasts as long as the habit is **never missed twice in a row**. A skip counts as a miss (051). One miss is forgiven; a second miss in a row sends the run back to day 1.
- **Days held (060, proposed)** = calendar days from the run's first done to today, inclusive. Calendar days, not occurrences, so a three-times-a-week habit reaches Starter on the same calendar as a daily one; a weekly habit would otherwise need 7 years for Master.
- Ranks are reached by days held in a run, per habit:

  | Rank | Days held | Medal shape | Fill / rim tokens |
  |---|---|---|---|
  | Starter | 10 | circle | `rank/starter/*` (stone) |
  | Builder | 30 | rounded square | `rank/builder/*` (bronze) |
  | Keeper | 90 | pentagon (the shield of 049) | `rank/keeper/*` (silver) |
  | Artisan | 182 (6 months) | hexagon | `rank/artisan/*` (gold) |
  | Master | 365 (1 year) | framed hexagon with a crimson gem | `rank/master/*` (platinum) |

- **Ranks are never lost.** A lapsed habit keeps its rank, and the current run shows the real state.
- **One medal per habit (055).** Shape and colour show the rank; the icon inside is the habit's own icon (a dumbbell for Train). Locked medals use `rank/locked/*` in grey.
- **At Master** the medal keeps the top shape and colour for good, the run keeps counting, and nothing else unlocks (H22b).
- The mastery ring has 5 segments, one per rank; the fifth is `state/perfect` crimson.
- When several habits reach a rank on the same day, one sheet lists them all. Ranks never trigger a push (E15).
- Perfect Day (every due habit done) is the daily celebration.

### Calendars
- Each calendar has a name, a marker colour and a "Track as habits" toggle (off by default).
- Calendar colours are markers only (bars, dots, chips), always shown with the calendar name, and never used as fills (034).
- A fifth calendar colour is still open (046, E13).

### Data model (proposed; finalise at M1)
```ts
Calendar   { id, name, color: CalendarToken, trackAsHabits: boolean, createdAt }
Event      { id, icsUid?, calendarId, title, icon?, start, end, allDay,
             timeMode: 'clock' | 'zoned', tz?, rrule?, exdates[], overrides{}, reminders: minutes[] }
Answer     { eventId, occurrence: 'YYYY-MM-DD', status: 'done'|'skipped'|'missed',
             reason?, answeredAt, history: {ts, from, to}[] }       // append-only history
RankRecord { eventSeriesId, rank, reachedOn }                        // never deleted
PushLog    { receivedAt, kind: 'recap'|'reminder'|'test' }
Settings   { recapTime: '22:30', timezone, backupNudgeDays, lastBackupAt, onboardingDone }
```
A backup is `{ app: 'atomic', schemaVersion, exportedAt, ...all stores }`. Restore checks `schemaVersion` and migrates forward.

---

## 5. Layout and type rules

- Frame 393 × 852 (iPhone 15/16). 16 px side gutter (`layout/gutter`) and a 4 px grid.
- 32 px top padding under the status bar on every screen body (050).
- Touch targets are at least 44 px. Visuals may be smaller inside a 44 px hit area (041).
- 12 px is the smallest text, and every line height is a multiple of 4 (036).
- Light mode only (012). No boxes or cards; use one radius system and one text-case rule (014).
- `#E5E5E5` is for decorative dividers only. Meaningful outlines use `border/control` at 3:1 or higher (019).
- Root screens show the tab bar. Pushed detail screens and modals hide it and show Back or Cancel (044, proposed).
- Names truncate to one line with an ellipsis in rows; the full name appears in sheets and detail screens (E21).

---

## 6. Design tokens (from Figma variables, 5 Oct 2026)

Generated into CSS by `scripts/export-tokens`. If a value here and Figma disagree, Figma wins: re-export.

### Primitives
| Token | Value | Token | Value |
|---|---|---|---|
| color/white | #FFFFFF | color/green/700 | #1E7F3A |
| color/ink/900 | #0F0F10 | color/green/400 | #6DAC7F |
| color/ink/700 | #4F4F5A | color/green/200 | #B0D2BA |
| color/ink/600 | #70706B | color/green/100 | #E4F0E7 |
| color/ink/500 | #8F8F8A | color/orange/500 | #FF2E00 |
| color/ink/100 | #E5E5E5 | color/calendar/green | #13856B |
| color/ink/50 | #F7F7F5 | color/calendar/crimson | #C2185B |
| color/crimson/600 | #B9091A | color/calendar/blue | #2F5BD3 |
| color/crimson/800 | #8D0714 | color/calendar/olive | #6E7B1F |
| color/rank/stone-100 | #E6E6E1 | color/rank/gold-300 | #F3CD5A |
| color/rank/bronze-200 | #EBC29A | color/rank/gold-500 | #C49A1F |
| color/rank/bronze-700 | #8E5426 | color/rank/gold-700 | #8F6400 |
| color/rank/silver-200 | #D5DAE1 | color/rank/platinum-50 | #F4F1E9 |
| color/rank/silver-700 | #5A6270 | | |

### Semantic colours (use these in components, never the primitives)
- **bg:** default → white · subtle → ink/50 · inverse → ink/900 · scrim → #0F0F10 at 40%
- **text:** primary → ink/900 · secondary → ink/700 · tertiary → ink/600 · disabled → ink/500 · inverse → white · accent → crimson/600 · done → green/700
- **icon:** default → ink/900 · muted → ink/500 · inverse → white
- **border:** divider → ink/100 · control → ink/500 · strong → ink/900
- **action:** primary → crimson/600 · primary-pressed → crimson/800 · on-primary → white
- **state:** done → green/700 · open → ink/500 · running → ink/900 · skipped → ink/500 · perfect → crimson/600
- **celebrate:** spark → orange/500
- **heat:** 0 white · 1 green/100 · 2 green/200 · 3 green/400 · 4 green/700. Every cell is outlined and labelled (038).
- **calendar:** marko → calendar/green · work → calendar/crimson · family → calendar/blue · habits → calendar/olive
- **rank:** {starter, builder, keeper, artisan, master}/fill and /rim · master/frame → ink/900 · master/gem → crimson/600 · locked/fill → ink/50 · locked/rim → ink/500 · illustration → ink/900 · illustration-locked → ink/500

### Dimension
- **space:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 · `layout/gutter` → space/16
- **size:** touch 44 · icon 24 · state-icon 32 · control 48
- **radius:** control 8 · control-inner 6 · chip 6 · event 6 · sheet 16 · round 999
- **stroke:** hairline 1 · icon 1.5 · ring 8 · illustration 2 · medal 3

### Type (Geist and Geist Mono, self-hosted)
| Style | Font | Size/Line | Tracking |
|---|---|---|---|
| Heading/Large | Geist SemiBold | 32/40 | −2% |
| Heading/Medium | Geist SemiBold | 24/32 | −1% |
| Heading/Small | Geist SemiBold | 20/28 | 0 |
| Body/Default | Geist Regular | 16/24 | 0 |
| Body/Strong | Geist Medium | 16/24 | 0 |
| Body/Small | Geist Regular | 14/20 | 0 |
| Label/Small | Geist Medium | 12/16 | 0 |
| Label/Section | Geist Medium | 12/16 | +6%, uppercase |
| Number/Display | Geist Mono Medium | 40/48 | −2% |
| Number/Large | Geist Mono Medium | 28/36 | −1% |
| Number/Default | Geist Mono Medium | 16/24 | 0 |
| Number/Small | Geist Mono Regular | 12/16 | 0 |

Numbers are plain whole numbers, never zero-padded (061): 82%, 18, 10/30. Geist Mono keeps columns aligned.

### Motion (053, proposed; Figma page 11 has the specs per interaction)
- **duration:** instant 100 · fast 150 · base 250 · slow 400 · celebrate 600 · toast-hold 5000 (ms)
- **easing:**
  - standard `cubic-bezier(0.2, 0, 0, 1)`
  - enter `cubic-bezier(0, 0, 0, 1)`
  - exit `cubic-bezier(0.3, 0, 1, 1)`
  - spring `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Only three things may overshoot (spring): the check-off icon, the perfect-day ring and the rank medal.
- Celebration stays rare so it keeps its meaning.
- `prefers-reduced-motion: reduce` turns every movement into a 150 ms fade.
- Animate `transform` and `opacity` only. Tune on a real iPhone, not in the desktop browser (056).

### Icons
- Lucide (ISC licence), self-hosted, on a 24 px grid.
- Habit icons: 44 in 8 groups (043), listed in the Figma Components board, Edit habit sheet (H45b).

### Accessibility
- Text meets WCAG AA (4.5:1). Meaningful graphics meet 3:1 (1.4.11). Colour is never the only carrier of meaning.
- Accepted exceptions: the crimson gem on the Master medal (2.84:1, decorative) and heatmap steps 1–2 (below 3:1, which is why every cell carries a label).

---

## 7. Screens (Figma page 08, one section per journey, 048)

| Section | Figma node | Covers |
|---|---|---|
| 01 Install | 65:3808 | browser-tab preview, install guide per browser (Safari, Chrome, DuckDuckGo) (058) |
| 02 Onboarding | 65:3812 | notifications, import, choose habit calendar |
| 03 Today | 65:3816 | day list, check-off, skip with reason, habit sheet (H11–H13) |
| 04 Evening Recap | 65:3820 | 22:30 recap: all at once / one by one, day result, ranks reached (H22), Mastered (H22b) |
| 05 Calendar | 65:3824 | day, week and month views, event detail, create/edit, repeats |
| 06 Stats | 65:3828 | week, month, year, habit detail, weekly recap |
| 07 Badges and ranks | 65:3832 | medals per habit (H38, H38b, H38c) |
| 08 Settings and habits | 65:3836 | settings, edit habit, icon picker |
| 09 Calendars and import | 65:3840 | calendars, colours, .ics import, re-import |
| 10 Notifications and data | 65:3844 | push status and test, backup, restore |

- Components to build first: Rank medal 76:479, Badge 110:581, Mastery ring 31:41, Habit row 34:213, Event block 36:285, Heat cell 38:441, Year bar 38:462, Top bar 37:270, Section label 36:333, Tab bar 37:410.
- Edge-case screens: page 10, section 89:5011 (X1 run ends, X2 time zone, X3 long names and many habits).

---

## 8. Edge cases (Figma page 10)

**Time and the day**

| ID | Case | Behaviour | Screens | Status |
|---|---|---|---|---|
| R1 | The day closes at 04:00 | Shows yesterday, titled by the day (“Close Tuesday”). After 04:00, yesterday’s open habits become missed. | H24 | Designed |
| E4 | Changing yesterday’s answer | Answers change for 7 days (R2), then read-only. Rates and runs recalculate; ranks already reached are never taken back. | H16, H34 | Build rule |
| E5 | Daylight-saving change | The function’s timer runs in UTC and converts to Europe/Athens, so the recap stays at 22:30 local in summer and in winter. | — | Build rule |
| E6 | Travelling to another time zone | Meetings keep their real time and show the origin zone; habits keep their clock time (Breakfast stays 08:00); the function is told the new zone; the day closes at local 04:00. | X2 | Designed |
| E7 | All-day habits and midnight | An all-day habit sits at the top of Today with no time. A habit belongs to the day it starts. Both answerable until 04:00. | — | Build rule |

**Notifications**

| ID | Case | Behaviour | Screens | Status |
|---|---|---|---|---|
| E1 | The recap push stops arriving | Today banner names the last arrival; Send a test; when the test arrives, the push address is renewed and the banner clears. | H15, H46 | Designed |
| R3 | Notifications denied | ATOMIC still works; the Settings path is shown once and Notifications keeps a warning. | H05 | Designed |

**Data and storage**

| ID | Case | Behaviour | Screens | Status |
|---|---|---|---|---|
| E2 | App removed or storage cleared | Welcome opens empty with Restore from a backup; everything after the last backup is gone, as warned in onboarding and Data (R7). | H01, H48 | Designed |
| E3 | Phone lost or replaced | Install from any browser, allow push, restore from Files or Proton Drive. | H02, H48 | Designed |
| E10 | DuckDuckGo clears its data | A browser tab only ever holds sample data (R9); real data lives in the installed app. Verified on device in build test 0. | H03 | Test on device |
| R6 | Restoring a backup | Preview first, then replace everything on the phone. Never merge. | H48 | Designed |
| R7 | Backup getting old | Today banner with Back up now. Nudge at 7 days (O7) or 14 days (H15): still open. | H15, H47 | Open |

**Import and calendars**

| ID | Case | Behaviour | Screens | Status |
|---|---|---|---|---|
| E8 | Re-importing a file | Events matched by ID: duplicates skipped, changed events listed for approval; answers stay on their events. | H44 | Designed |
| E11 | Wrong file type | Says what went wrong and how to export from Proton. | H07b | Designed |
| E12 | Deleting a calendar | Shows how many events go; Back up first is the primary action. | H49 | Designed |
| E13 | A fifth calendar | No distinct colour available yet (046). | H43 | Open |

**Habits and ranks**

| ID | Case | Behaviour | Screens | Status |
|---|---|---|---|---|
| E9 | Archived habit | Stops counting from today; history, ranks and the frozen ring stay. | H32, H45 | Designed |
| E14 | A run ends | The run goes back to day 1; the rank stays. The Recap says so once, plainly, with no streak-loss drama. | X1 | Designed |
| E15 | Several ranks on one day | One sheet lists them all; never a push. | H22 | Designed |
| E16 | Editing a repeating habit | This event · this and following · all events; past answers keep their original time and title. | H31 | Designed |

**Empty and first use**

| ID | Case | Behaviour | Screens | Status |
|---|---|---|---|---|
| E17 | No habits tracked | Empty Today with Choose a calendar; the zero is typographic (000), not an illustration. | H14 | Designed |
| E18 | A day with no events | Empty day with New event. | H33 | Designed |
| E19 | The first days | Stats shows only what exists; days before the start are dimmed, never counted as missed; Badges show every rank locked with day counts. | H40, H38c | Designed |
| E20 | Opened in a browser tab | Preview with sample data and Install ATOMIC. | H03 | Designed |

**Content limits**

| ID | Case | Behaviour | Screens | Status |
|---|---|---|---|---|
| E21 | Long names | One line with an ellipsis in rows; the full title in the sheet and detail screens. | X3 | Designed |
| E22 | Many habits | The list scrolls; the ring counts them all (“1 of 10”); open habits come first, then Next up, then Done. | X3 | Designed |
| E23 | Busy days | Month shows up to three dots; Day view shows overlapping events side by side (rule for the build). | H28 | Build rule |

---

## 9. Milestones

Each milestone ends on a real iPhone, with the app installed from the Home Screen, before the next one starts.

### M0 · Build test 0: the go/no-go gate
The riskiest assumptions get tested before any screen is built.
1. Publish a minimal installable shell (manifest, icons, service worker, one page) to GitHub Pages.
2. Install it onto the Home Screen from DuckDuckGo. The owner's iPhone has no Safari installed, so the Safari install path is checked later, on a friend's phone (058, 059).
3. Write test records to IndexedDB.
4. Clear DuckDuckGo: the Fire button and automatic data clearing. Then reopen the installed app, the same day and again a day later. **The data must still be there.**
5. Subscribe to Web Push and send a test push from the function at a set time. **It must arrive while the app is closed.**
6. Record: is `navigator.vibrate` available for haptics (expected no on iOS)? Does a scheduled time hold across a time-zone change?
- **Go:** data survives and the push arrives → M1.
- **If DuckDuckGo loses data:** check the same flow from Safari on another iPhone; if Safari keeps it, document Safari as the install path (058).
- **No-go (data lost in both, or no push):** stop and revisit 020 (storage) or 016 (push) before building anything else.

### M1 · Foundations
- Token export, base styles, self-hosted fonts and icons.
- Core components: button, rows, sheet, top bar, tab bar.
- Motion utilities, with reduced-motion support.
- Domain rules with tests.
- Data layer with schema versioning.

### M2 · Core loop
- Onboarding and a first import (065): import the HABITS calendar from a Proton `.ics` export, so Today runs on real habits from the end of M2. Matching by UID skips duplicates; the full import (every calendar, changed-event approval, E8) stays in M4.
- Today, check-off with undo, skip with reason, habit sheet.
- The Evening Recap and the day result (opened from Today's Close the day row; the 22:30 push is off, 069).
- The 04:00 day close (computed: an unanswered occurrence of a closed day is missed, 052; nothing is written at 04:00).
- Built in M2 (7 Oct 2026). Moved on, by design: Next up / First event (event blocks) → M3; restore from a backup, the browser-tab preview (H02, H03) → M4; new rank sheets (H22, H22b) → M5, recomputed from answers so none are lost; warning banners (H15) → M6.

### M3 · Calendar
- Day, week and month views; event detail.
- Create and edit events, including repeats ("this event / this and following / all", E16).
- Event reminders for non-habit events (the encrypted channel itself shipped in M2, 069).
- Built 7 Oct 2026 (0.3.0): `src/domain/agenda.ts` (every event expanded in the phone's zone, overlap layout, free bands), `src/domain/series.ts` (scoped edits), `src/data/events.ts`, screens in `src/screens/calendar`. DB v3 sets habits' reminders to [0] (069). Tapping a reminder opens its event (H29).

### M4 · Data
- Full .ics import: every calendar, re-import with changed events listed for approval (E8).
- Settings and Calendars.
- Built 7 Oct 2026 (0.4.0): `src/screens/settings` (H41–H49, About), `src/data/{calendars,habits,reimport,restore}.ts`. Track as habits converts a calendar's times (clock ⇄ real, 028). Restore keeps this phone's push device and reminder key.
- Backup and restore, plus the backup nudge.

### M5 · Progress
- Stats: week, month, year, habit detail and weekly recap.
- Runs, ranks and medals per habit (055).

### M6 · Polish
- Edge cases E1–E23.
- Accessibility pass.
- Motion tuning on the device.
- Daily use begins, and the usability log starts at U01.

---

## 10. Push function contract (host-agnostic)

| Endpoint | Body | Purpose |
|---|---|---|
| `GET /` | — | Health check: `{ ok, service: 'atomic-push' }` |
| `GET /vapid-public-key` | — | The VAPID public key the app subscribes with (063) |
| `POST /subscribe` | `{ subscription, timezone, invite?, recap? }` | Store or renew the Web Push subscription and the time zone (E1, E6). A new phone needs the invite code. `recap: false` turns the 22:30 recap push off for this phone (069); left out, the last choice stays. Replies `{ ok, recap }` so the app records only a confirmed choice. |
| `PUT /reminders` | `{ items: [{ id, fireAt (UTC ISO), ciphertext }] }` | Replace the whole queue of upcoming reminders (the next 14 days) |
| `POST /test` | `{ at? }` | Send a test push now, or schedule it up to 24 h ahead so it arrives with the app closed (E1, 064) |
| `POST /` | `{ tick: true }` | The CRON trigger's call: one timer run |

- **CRON every minute** (Scaleway CRON runs in UTC):
  - Send reminders and scheduled tests whose `fireAt` ≤ now, then delete them (failed ones leave after an hour).
  - Send the recap push once per habit day, from 22:30 local until the day closes at 04:00, so a late timer run still sends it. Skipped for a phone with `recap: false` (069).
  - Daylight saving is handled by converting from UTC with the zone rules (E5).
  - If the push service says an address is gone, the device is paused, not deleted: its queue stays, and the app renews it without the invite code (E1).
- **Recap payload:** `{ kind: 'recap' }`. It carries no data (025).
- **Reminder payload:** `{ kind: 'reminder', ciphertext }`. The service worker decrypts it with a key held only in IndexedDB on the phone: 256-bit AES-GCM, stored as raw bytes under `settings/reminder-key`, never in a backup. Ciphertext = base64url(iv ‖ sealed `{ t: title, b: "08:00 · 30 min", g: tag }`).
- **Devices (059):** one record per device, keyed by a random device token created at subscribe time and sent as a header on every call. No accounts, no user table: each phone is independent, and its data never leaves it.
- **Invite code (059):** `/subscribe` also needs a short invite code, kept in the host's secret store, so strangers who find the URL in this public repo can't use the free tier. Rate-limit every endpoint per device token.
- **The function stores nothing else.** No logs containing payloads.
- **Secrets:** the invite code and storage keys live in the function's secret environment variables. The VAPID key pair is made by the function on first use and kept in its private bucket (063), so no person ever handles the private key. Neither is ever in this repo.

---

## 11. Open items

| Item | Needed by |
|---|---|
| M0 step 6: does a scheduled time hold across a time-zone change? (vibration: not available on iOS, as expected) | M3 |
| 034 calendar colours, 044 detail screens hide tab bar, 053 motion tokens, 060 days held: confirm | M1 |
| 046 fifth calendar colour | M4 |
| O7 backup nudge after 7 or 14 days | M4 |
| A short privacy note (what stays on the phone, what the push function holds): drafted in About (074), owner to confirm | before the first friend installs |
| Name: trademark check for "ATOMIC" before any public launch (018) | launch |

---

## 12. Decision index (full rows on Figma page 02)

| No. | Decision | Status |
|---|---|---|
| 001 | PWA installed to the Home Screen, not a native app | Decided |
| 002 | Read Proton, don't replace it | Superseded by 015 |
| 003 | A dedicated HABITS calendar, sport included | Decided |
| 004 | Habits written as actions with an end point ("Diorama - 45 min") | Decided |
| 005 | Water is not tracked (a bottle on the desk) | Decided |
| 006 | Completion rate (done ÷ due) instead of streaks | Decided |
| 007 | Skipped is distinct from not-yet-done; 4 optional reasons | Decided |
| 008 | Done = green #1E7F3A, never crimson | Decided |
| 009 | One push a day | Superseded by 021 |
| 010 | Start with 4 habits; add a wave after 2 weeks above 80% | Decided |
| 011 | GitHub + GitHub Pages, free tier | Amended by 016 |
| 012 | Light mode only | Decided |
| 013 | "Atomic Habits" is a working name only | Superseded by 018 |
| 014 | No boxes, one radius system, one text-case rule, 4 px grid | Decided |
| 015 | A full calendar that replaces Proton's app | Decided |
| 016 | One free serverless function for push | Amended by 022 |
| 017 | Recap push at 21:00 | Superseded by 039 |
| 018 | The name is ATOMIC | Decided |
| 019 | #E5E5E5 for dividers only; meaningful lines ≥ 3:1 | Decided |
| 020 | Events live on the phone only (IndexedDB), no sync | Decided |
| 021 | Event reminders as pushes with the title, encrypted on the phone | Decided |
| 022 | Move off Proton with a one-time .ics import | Decided |
| 023 | All calendars move into ATOMIC; SPORT merges into HABITS | Decided |
| 024 | Logo direction C: the O as a five-segment ring | Decided |
| 025 | The recap is built by the app when it opens | Proposed |
| 026 | Restore replaces, never merges | Proposed |
| 027 | The app watches its own push (banner after 2 silent evenings) | Proposed |
| 028 | Habits keep clock time, meetings keep real time | Proposed |
| 029 | Designed for DuckDuckGo on iPhone | Amended by 058 |
| 030 | Zero third-party requests, strict CSP | Proposed |
| 031 | Nothing is saved in a browser tab | Proposed |
| 032 | Recap: all at once by default, one by one on request | Proposed |
| 033 | Charts never draw missing days as zero | Proposed |
| 034 | Calendar colours as markers only, tuned away from semantic colours | Proposed |
| 035 | #F7F7F5 for tracks and chips, never boxes | Proposed |
| 036 | 12 px smallest text; line heights in multiples of 4 | Proposed |
| 037 | One light app icon; reduced mark at 32 px and below | Proposed |
| 038 | Heatmap in 5 steps, with outlines and labels | Proposed |
| 039 | Recap push at 22:30, after the last habit; the day closes at 04:00 | Decided (push part switched off by 069) |
| 040 | "Mark as done" only on the habit due now | Proposed |
| 041 | 44 px hit areas, lighter visuals | Proposed |
| 042 | The Evening Recap looks the same every evening | Decided |
| 043 | Habit icons: enlarged Lucide set (44 icons, 8 groups) | Decided |
| 044 | Pushed detail screens hide the tab bar | Proposed |
| 045 | Stats use labelled sample data | Decided |
| 046 | A fifth calendar colour | Open |
| 047 | Gamification: consistency ranks, Starter → Master | Decided (tiers dropped by 055) |
| 048 | Delivery: one Figma section per journey | Decided |
| 049 | Rank medal shape and colour progression | Revised by 055 |
| 050 | 32 px top padding on every screen | Decided |
| 051 | A skip counts as a miss for runs | Decided |
| 052 | No rest-day answer: unanswered = missed at 04:00 | Decided |
| 053 | Motion tokens: 5 durations, 4 curves, reduced motion = fade | Proposed |
| 054 | Prototype page | Superseded by 056 |
| 055 | One medal per habit: shape/colour = rank, icon = habit icon | Decided |
| 056 | No prototype: build the real product, motion in code | Decided |
| 057 | Build first; log usability changes; case study after | Decided |
| 058 | Install from any iPhone browser; DuckDuckGo is not required | Decided |
| 059 | For the owner; close friends may try it (push keyed per device, invite code) | Decided |
| 060 | Days held = calendar days since the run's first done, not occurrences | Proposed |
| 061 | Numbers without leading zeros (82%, not 082%) | Decided |
| 062 | The push function's memory is Object Storage (one JSON file per phone), not a database | Decided |
| 063 | The function makes its own VAPID keys and keeps them in its private bucket; the app fetches the public key | Proposed |
| 064 | A test push can be scheduled up to 24 h ahead (`POST /test { at }`) | Proposed |
| 065 | M2 includes a first .ics import of the HABITS calendar, so daily use starts at the end of M2 | Decided |
| 066 | One habit calendar; switching on a second one in the review merges it in (023 generalised) | Proposed |
| 067 | H04 asks for the invite code only when the push function doesn't know the phone yet | Proposed |
| 068 | Copy not in the design, proposed: day-result lines other than the one-slip example ("Every habit done.", "None held today. Tomorrow starts clean.", "2 of 4 held. A and B slipped."), "Nothing due today", the H08 merge hint; the H25 and H21 texts drop the parts about Stats and motion | Proposed |
| 069 | A push when each habit starts; no 22:30 recap push for now. The owner answers in the app; the recap stays in the app. Built as a per-phone switch so the recap push can come back | Decided (owner, 7 Oct 2026) |
| 070 | Day view free bands: gaps of 1 h or more between two events, inside 08:00–20:00 | Proposed |
| 071 | Editor details not in the design: Calendar, Repeat (Never, Every day, Weekdays, Every week with days, Every 2 weeks, Every month, Every year, an end date), Reminder, Place and Notes open sheets; Starts and Ends open the iPhone's own date and time wheels; a new event starts at the next whole hour (09:00 on other days) in the habit calendar; H33 keeps the date strip and chips | Proposed |
| 072 | Every event can remind (021): minutes before its start, 0 = at the start. A new event takes its calendar's default (R5): habits at the start (069), other calendars 15 min (Proton's default in the imported files) | Proposed |
| 073 | "All events" on a habit that already has answers splits the series at today, so past answers keep their original time and title (E16) | Proposed |
| 074 | Not designed, built to the system: About (version, privacy note, licences); "Bring back from today" for an archived habit; the Changed list sheet in Import; H46 for 069 (the 22:30 toggle is off by default, Last arrived has no chevron, a Turn on notifications banner); a calendar's default reminder can also be applied to the events already in it; Welcome has Restore from a backup (E2) | Proposed |
| 075 | Backup nudge on Today (R7): "Last backup 9 days ago. If ATOMIC is removed, everything since is gone." with Back up now, after 7 days (O7 still open), or 7 days after tracking starts with no backup | Proposed |
| 076 | Sheets (U02, U03): slide up from the bottom in 400 ms and slide down the same way (standard curve, scrim fades with them), for every modal sheet. The handle follows the finger: down freely, up with resistance, past 30% of the height or 500 px/s closes. No X by default (`showClose` stays available). Secondary buttons are a `bg/subtle` fill with no outline (035). No focus ring on a sheet's first button when it opens. The dialog never scrolls (`overflow: clip`): scrolling made iOS show the sheet mid-screen first (U03). Replaces the 150 ms close of page 11 | Proposed |
| 077 | Event detail has Duplicate (U04): it opens the editor with a copy, and Save is refused until the date or time differs from the original. The Repeat sheet has Custom (U05): every 1–4 weeks, on the weekdays chosen, at a time (the event's start time); one time per series, so different times on different days are separate events | Proposed |
| 078 | About ends with the website, markoferrari.eu, in place of the "Made with" list; the font and icon licences stay in the repo (`public/fonts/OFL.txt`) | Proposed |
| 079 | The empty Today asks for a habit, not a calendar: primary New habit (it creates the HABITS calendar), Import from Proton (.ics) as a tertiary link. Figma H14 updated; code follows | Decided (owner, 7 Oct 2026) |
| 080 | Kaizen: the weekly recap (H39) ends with one adjustment to try for 2 weeks (one variable, then review). Identity, cue, smallest version and plan B (Figma Playground P2–P5) stay proposals, not decided | Decided (owner, 7 Oct 2026) |

Note: "Proposed" means designed and built as specified, but not yet confirmed by the owner. Treat it as the spec until it changes.

---

## 13. Working agreement for build sessions

- Work one milestone at a time. Open a short PR per slice, written for a designer to review: what changed, the screens it touches, the decisions it implements.
- Before a slice is called done:
  - `npm run check` (types), `npm test` (domain rules) and `npm run build` pass;
  - no raw hex, px or ms values outside `tokens.css` (a lint rule enforces it);
  - the slice is tested on the iPhone once a milestone closes.
- When the design and reality disagree (iOS limits, performance), stop, explain it in plain words, propose an option, and log the decision.
