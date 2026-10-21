# ATOMIC · Habit Tracker

This file is the build spec for ATOMIC. Read it before every build session; it outranks memory and habit.

ATOMIC is a habit tracker first (097): habits, a nudge when each starts, an answer, a reward. Your own calendar stays in Proton, Google or Outlook: ATOMIC holds habits only (104). It is installed onto an iPhone Home Screen from any browser that can add web apps (Safari, Chrome, DuckDuckGo). Every event in the HABITS calendar has to be answered by the end of the day: done or skipped. A push arrives when each habit starts, and the owner answers in the app (069); the in-app Evening Recap closes the day. Over months, the app shows which habits held and which didn't.

- Design (the source of truth): https://www.figma.com/design/wbZAtFDM2FazPT8wHTHJP2/Atomic-Habits
- Owner: Marko Ferrari, the designer and main user. Close friends may try it on their own phones (059): nothing is built for them, but nothing blocks them.
- Status (7 Oct 2026): **M0 passed on device (GO).** M1 deployed. **M2 built**: onboarding with the first import (065), Today, the Evening Recap; a push when each habit starts, no 22:30 recap push (069). **M3 built (0.3.0)**: Calendar day/week/month, event detail, create/edit/delete with repeats, reminders for every event. **M4 built (0.4.0)**: Settings, Calendars, Habits, Notifications, Data, About; .ics re-import (E8), backup, restore (also from Welcome), backup nudge. **M5 built (0.5.0, Playground P2–P5 in 0.5.1)**: Stats (week, month, year), habit detail, Badges with ranks, the weekly recap with Kaizen (080). **0.6.0 (8 Oct 2026): habits first**, from Figma page 14: new start flow with a stepper, Today with the week strip and the perfect-day award, the Habits tab (list, week, month), star medals, Stats with perfect days, Settings. **0.6.2 (8 Oct 2026):** the Calendar and the .ics import left the app (104), Starter is now Apprentice (105). **0.6.3:** the award plays once per day and count, and on opening Today (106, U11). **0.7.0 (8 Oct 2026):** milestone quotes (107), the comeback (108), the perfect week (109), one quote library (110). **0.7.1:** round segmented controls, no corner star in the month, one Settings list (111). **0.7.2 (12 Oct 2026):** a long second line in a habit row wraps, so Mark as done stays on screen (U12). **0.8.0 (12 Oct 2026):** delete a habit (112) and the habit detail's ring and two bars (113), from Playground 04 and 05; the chosen screens are on page 14, section 04 (H4, H4b–H4e), the options not chosen on page 15, Archived Ideas. **0.8.1 (12 Oct 2026):** a calmer welcome (U13) and Get started opens Today, with reminders offered there once a habit exists (114, U14). **0.8.2 (14 Oct 2026):** changing a habit's time no longer starts it over: a habit keeps one id and its old schedules as past versions, and habits split before are joined back once (115, U15); an (i) explains Nudge and Make it stick on New habit (116, U16). **0.9.0 (14 Oct 2026):** pause a habit ahead of time, with a reason (117, Playground 08). **0.10.0:** routines from After (118, Playground 09). **0.11.0:** Per week, “3 times a week”, any days (119, Playground 10). **0.12.0 (19 Oct 2026):** a forgiven miss keeps the run but isn't a held day, so a rank is earned by doing (120, U17). **0.13.0 (19 Oct 2026):** no invite code; the iPhone asks to allow notifications when a habit with Nudge on is saved, and Today's banner turns them on in one tap (121, U18). **0.14.0 (20 Oct 2026):** style B from Playground section 17 (122–129, 132): stone page, white cards, habits on their object's pastel field, 48 glossy 3D objects as WebP, Star 3D, Badge 3D shape ladder, one Month calendar, the pill tab bar, orange for missed and delete; reminders that aren't habits (130); "Welcome to the new ATOMIC" once per version (131). **21 Oct 2026:** the object is edited in Habits → Edit, and Settings → Habits shows archived habits only (133, U19). On the phone for UX testing; M6 (polish, edge cases) next. Open Playground proposals: quote moments and rank signature quotes (02), identity votes, opt-in (03). Component gallery at `#gallery`, build test at `#build-test`.

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
- **Events (015, 022, 023; narrowed by 097 and 104).** Habits are repeating events in the HABITS calendar, created and edited in the app. The Calendar views, other calendars and the `.ics` import left the app in 0.6.2 (104): their code stays in the repo, unrouted, and events already on a phone stay in its database and backups, but only habits show and remind.
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
- Repo secrets (owner-managed, write-only): `SCW_ACCESS_KEY`, `SCW_SECRET_KEY` (an IAM application key limited to FunctionsFullAccess and ObjectStorageFullAccess on ATOMIC; expires Oct 2027), `SCW_DEFAULT_PROJECT_ID`, `SCW_DEFAULT_ORGANIZATION_ID`. `ATOMIC_INVITE_CODE` is no longer read (121) and can be deleted.

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
- **Days held (060, proposed; amended by 120)** = calendar days from the run's first done to today, inclusive, minus the days that weren't held. Calendar days, not occurrences, so a three-times-a-week habit reaches Apprentice on the same calendar as a daily one; a weekly habit would otherwise need 7 years for Master.
- **A forgiven miss isn't a held day (120).** The miss keeps the run alive (051) but takes its day off days held, so a rank is earned by doing: Breakfast done 10 of 10 reaches Apprentice on day 10, Training done 9 of 10 on day 11, and done-miss-done-miss earns half the days, not all of them. A per-week week not held takes off all its days. Paused days were never counted (117). Ranks already reached stay (084).
- Ranks are reached by days held in a run, per habit:

  | Rank | Days held | Stars in the ring (100) |
  |---|---|---|
  | Apprentice (id `starter`, 105) | 10 | 1 |
  | Builder | 30 | 3 |
  | Keeper | 90 | 6 |
  | Artisan | 182 (6 months) | 9 |
  | Master | 365 (1 year) | 12, the full ring |

- **Ranks are never lost.** A lapsed habit keeps its rank, and the current run shows the real state. The one exception: deleting the habit itself (112).
- **One medal per habit (055), Badge 3D (128, replaces the star medal of 100).** The habit's 3D object on its field, in a container that gains corners rank by rank: Apprentice a circle (bronze rim), Builder a rounded square (silver), Keeper a pentagon (gold), Artisan a hexagon (gold), Master the hexagon crowned with the Star 3D. No rank yet: stone, object faded. Shape carries the rank, the metal backs it up, and the rank's name always travels with the medal.
- **At Master** the star crowns the medal for good, the run keeps counting, and nothing else unlocks (H22b).
- Rows no longer draw the 5-segment mastery ring (101); they name the next rank instead ("Builder in 6 days", 098), with a green bar in the Habits list.
- A rank reached opens H5 full screen the next time Today loads (`settings.ranksSeen`), never a push (E15).
- When several habits reach a rank on the same day, one sheet lists them all. Ranks never trigger a push (E15).
- **Perfect day** (every due habit done) is the daily celebration (093): the award star turns in on a dark stage (`bg/stage`), holds (`motion/duration/hold`, 094), and lands in today's cell of the week strip (096). Once per day and count (`settings.awardShown`, 106): after the last habit is marked done, or on opening Today when the day was finished elsewhere; undo and redo don't replay it, a habit added later and done earns it again. Skippable with a tap; reduced motion fades. The ring stays green and holds a small star (option A, owner 8 Oct 2026); `state/perfect` is kept for now (owner).
- **Milestones (107):** on the way to the next rank, halfway on Apprentice and Builder, every quarter on Keeper, Artisan and Master (Apprentice 5 · Builder 20 · Keeper 45, 60, 75 · Artisan 113, 136, 159 · Master 228, 274, 319 days held). Shown on Today under the week strip, for the rest of the habit day, once the habit that reached it is done; fresh for 7 days so a habit that isn't daily still meets it. The next-rank bar carries the milestone ticks; the habit detail keeps the last milestone's quote.
- **Comeback (108):** a done right after a single miss, with the run alive, saves the run. Today shows "Comeback · Read" with a quote and "Back after a miss: your 50-day run holds."; the week strip marks the day; the habit detail counts runs saved and draws the current run. The morning after a miss, a quote sits above the 099 line.
- **Perfect week (109):** every due habit, every day, Monday to Sunday, in a week begun after tracking started (a weekday habit closes its week on Friday). On the last due day, one line: "One more habit closes a perfect week." When it closes, after the day's star lands, the week's seven stars rise from the strip into a constellation on the dark stage with a quote; once a week (`settings.weekAwardShown`), tap skips, reduced motion fades. Stats → Year shows the sky: a star per perfect week, a row per quarter, neighbours joined.
- **Quotes (110):** one per moment, kept for good (`settings.quotes`), so Today shows the same words all day and a backup carries them; each pool turns without repeats. At most one quote on Today: milestone, then comeback, then the morning after a miss. Never in a push. Public domain (translations before 1929) or written for ATOMIC; no exclamation marks.
- **Never miss twice, made visible (099):** the morning after a miss, Today says "Walk slipped yesterday. Do it today and your 23-day run holds."

### Reminders that aren't habits (130)
- New habit's first row, **Count it as a habit**, is on by default. Off makes a reminder ("Drink water, 6 times a day"): Times a day (2–12) and suggested times, every 2 hours from Starts when that ends by 21:00, otherwise spread to 21:00 in 15-minute steps; each time a tap to change. Every day or on chosen days; never per week. No Lasts, no Make it stick, always a nudge.
- A reminder is never due, answered or counted: not in the day's count, rates, runs, ranks, perfect days or the recap (005). Today shows it on a white card ("Reminder · not counted", "Next at 13:00 · 2 of 6 so far"); Habits lists it under "Reminders · not counted"; its detail (B4) shows today's times, Pause reminders and Delete reminder. Edit opens the same form; switching Count on there turns it into a habit.
- Push: one per time, encrypted like every reminder (021): "Drink water" · "13:00 · 3 of 6 today", tag `nudge.<id>` so each replaces the last; it opens Today. Stored in the settings record (`timedReminders`), so backups carry it.
- Open after testing (owner): a daily cap, actions on the push, how reminder pushes count for the self-check (027).

### Calendars
- Each calendar has a name, a marker colour and a "Track as habits" toggle (off by default).
- Calendar colours are markers only (bars, dots, chips), always shown with the calendar name, and never used as fills (034).
- Twelve marker colours (046, 081): Green, Crimson, Blue, Olive (the original four, stored as `marko`, `work`, `family`, `habits`) plus Violet, Orange, Teal, Brown, Slate, Plum, Gold, Sky. A thirteenth calendar shares a hue (E13).

### Data model (proposed; finalise at M1)
```ts
Calendar   { id, name, color: CalendarToken, trackAsHabits: boolean, createdAt }
Event      { id, icsUid?, calendarId, title, icon?, start, end, allDay,
             timeMode: 'clock' | 'zoned', tz?, rrule?, exdates[], overrides{}, reminders: minutes[],
             past?: { title, start, end, allDay, rrule?, exdates[], overrides? }[] }   // 115: earlier schedules, oldest first
Answer     { eventId, occurrence: 'YYYY-MM-DD', status: 'done'|'skipped'|'missed',
             reason?, answeredAt, history: {ts, from, to}[] }       // append-only history
RankRecord { eventSeriesId, rank, reachedOn }                        // never deleted, unless its habit is (112)
PushLog    { receivedAt, kind: 'recap'|'reminder'|'test' }
TimedReminder { id, title, icon, times: 'HH:mm'[], days?: number[], paused?, createdAt }   // 130, in Settings.timedReminders
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

### Style B additions (0.14.0, 122–124; Figma variables, mirrored in tokens/tokens.json)
- **Primitives:** color/stone/100 #F4F4F1 · color/orange/700 #B45309 · color/green/800 · color/field/{sky, butter, sage, lilac, blush, peach, aqua, clay} · color/rank/gold-900 #7A5400 · color/rank/gold-100 #FFE9A8
- **bg/app** → stone/100 (every page) · **bg/card** → white (ATOMIC's own boxes) · **field/{move, drink, learn, rest, joy, food, health, make}** → the field primitives, chosen by the object's group, never by hand (123)
- **state/missed**, **action/destructive**, **text/destructive** → orange/700 (124: 5.02:1 on white, 4.56:1 on stone) · state/skipped → orange/700 · action/primary → ink/900 · text/accent → ink/900
- **award/facet-shadow**, **award/facet-highlight** for Star 3D (127) · **shadow/card** #0F0F10 at 8%, the empty-Today card only (not yet a Figma variable: add it)
- **radius:** card 24 · tile 12 · sheet 28

### Semantic colours (use these in components, never the primitives)
- **bg:** default → white · subtle → ink/50 · inverse → ink/900 · scrim → #0F0F10 at 40%
- **text:** primary → ink/900 · secondary → ink/700 · tertiary → ink/600 · disabled → ink/500 · inverse → white · accent → crimson/600 · done → green/700
- **icon:** default → ink/900 · muted → ink/500 · inverse → white
- **border:** divider → ink/100 · control → ink/500 · strong → ink/900
- **action:** primary → crimson/600 · primary-pressed → crimson/800 · on-primary → white
- **state:** done → green/700 · open → ink/500 · running → ink/900 · skipped → ink/500 · perfect → crimson/600
- **celebrate:** spark → orange/500
- **award (093):** facet-light → rank/gold-300 · facet-mid → rank/gold-500 · facet-dark → rank/gold-700 · bg/stage → ink/900 at 88%
- **heat:** 0 white · 1 green/100 · 2 green/200 · 3 green/400 · 4 green/700. Every cell is outlined and labelled (038).
- **calendar:** marko → calendar/green · work → calendar/crimson · family → calendar/blue · habits → calendar/olive
- **rank:** {starter, builder, keeper, artisan, master}/fill and /rim · master/frame → ink/900 · master/gem → crimson/600 · locked/fill → ink/50 · locked/rim → ink/500 · illustration → ink/900 · illustration-locked → ink/500

### Dimension
- **space:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 · `layout/gutter` → space/16 · `layout/block-gap` → space/32, between blocks of information (092, 40 until 0.6.1)
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
- **duration:** instant 100 · fast 150 · base 250 · slow 400 · celebrate 600 · hold 1200 (094) · toast-hold 5000 (ms)
- **easing:**
  - standard `cubic-bezier(0.2, 0, 0, 1)`
  - enter `cubic-bezier(0, 0, 0, 1)`
  - exit `cubic-bezier(0.3, 0, 1, 1)`
  - spring `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Only three things may overshoot (spring): the check-off icon, the perfect-day star (it replaces the ring, 093) and the rank medal.
- Script reads durations with `src/ui/motion.ts`: the build minifies `250ms` to `.25s` (U10).
- Celebration stays rare so it keeps its meaning.
- `prefers-reduced-motion: reduce` turns every movement into a 150 ms fade.
- Animate `transform` and `opacity` only. Tune on a real iPhone, not in the desktop browser (056).

### Icons
- Lucide (ISC licence), self-hosted, on a 24 px grid.
- Habit icons: 48 glossy 3D objects in 8 groups (132, amends 043), Playground section 14, shipped as WebP in `src/assets/objects` (about 270 kB, precached). Lucide stays for UI icons and as a fallback.

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
| 05 Calendar | 65:3824 | day, week and month views, event detail, create/edit, repeats (removed from the app by 104; the habit editor H30 still applies) |
| 06 Stats | 65:3828 | week, month, year, habit detail, weekly recap |
| 07 Badges and ranks | 65:3832 | medals per habit (H38, H38b, H38c) |
| 08 Settings and habits | 65:3836 | settings, edit habit, icon picker |
| 09 Calendars and import | 65:3840 | calendars, colours, .ics import, re-import |
| 10 Notifications and data | 65:3844 | push status and test, backup, restore |
| **Page 14 Habits First** | 219:7 | the habits-first redesign (097), built in 0.6.0: 00 new components (Stepper, Award star, Week strip, Star medal), 01 Start, 02 Today, 03 Perfect day award (motion spec), 04 Habits and progress, 05 Edit and settings; add-ons built in 0.7.0: 06 Milestones (107), 07 Comeback (108), 08 Perfect week (109). Where it differs from page 08, page 14 wins |

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
| E13 | More than twelve calendars | Twelve colours (081); the thirteenth shares a hue and the screen says so. | H43 | Designed |

**Habits and ranks**

| ID | Case | Behaviour | Screens | Status |
|---|---|---|---|---|
| E9 | Archived habit | Stops counting from today; history, ranks and the frozen ring stay. Settings → Archived habits lists them and brings one back (133). | H32, H45 | Designed |
| E24 | Deleting a habit (112) | Habit detail, Delete this habit: with a rank, Archive instead comes first (A); without one, a plain question (B). The series, answers and rank records go; an active trial ends as dropped; perfect days stay as earned. Undo for 5 s. | H4b–H4e | Designed |
| E25 | Pausing a habit (117) | Habit detail, Pause habit: a start day, 3 days / 1 week / 2 weeks, and why (Travel, Ill or injured, Busy stretch, Other with a few words). Only ahead, 14 days at most, one at a time. Paused days aren’t due, missed or nudged; the run waits without growing. Today names it until when, with Bring it back today; the day after, one line says it’s back. | Playground 08 (P1, P2) | Built |
| E14 | A run ends | The run goes back to day 1; the rank stays. The Recap says so once, plainly, with no streak-loss drama. | X1 | Designed |
| E15 | Several ranks on one day | One sheet lists them all; never a push. | H22 | Designed |
| E16 | Editing a repeating habit | This event · this and following · all events; past answers keep their original time and title. The habit stays one habit: its run, ranks and stats carry on (115). | H31 | Designed |

**Empty and first use**

| ID | Case | Behaviour | Screens | Status |
|---|---|---|---|---|
| E17 | No habits tracked | Empty Today with New habit (it makes the HABITS calendar) and Import from Proton as a link (079); the zero is typographic (000), not an illustration. | H14 | Designed |
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
- Built 7 Oct 2026 (0.5.0): `src/domain/stats.ts` (week, month, year, habit detail, medals, weekly recap), `src/domain/adjust.ts` (Kaizen trial and review), `src/data/stats.ts`, screens in `src/screens/stats`. Real data only (045 sample data is not used; E19 first days are dimmed, never zero, 033). Playground P2–P5 built in 0.5.1 (085–087), with the Kaizen line on Today. Not built: the browser-tab preview.

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
| `POST /subscribe` | `{ subscription, timezone, recap? }` | Store or renew the Web Push subscription and the time zone (E1, E6). Any new phone may join until the function holds 25 (121); after that a new phone gets 403 `ATOMIC is full`, and known phones still renew. `recap: false` turns the 22:30 recap push off for this phone (069); left out, the last choice stays. Replies `{ ok, recap }` so the app records only a confirmed choice. |
| `PUT /reminders` | `{ items: [{ id, fireAt (UTC ISO), ciphertext }] }` | Replace the whole queue of upcoming reminders (the next 14 days) |
| `POST /test` | `{ at? }` | Send a test push now, or schedule it up to 24 h ahead so it arrives with the app closed (E1, 064) |
| `POST /` | `{ tick: true }` | The CRON trigger's call: one timer run |

- **CRON every minute** (Scaleway CRON runs in UTC):
  - Send reminders and scheduled tests whose `fireAt` ≤ now, then delete them (failed ones leave after an hour).
  - Send the recap push once per habit day, from 22:30 local until the day closes at 04:00, so a late timer run still sends it. Skipped for a phone with `recap: false` (069).
  - Daylight saving is handled by converting from UTC with the zone rules (E5).
  - If the push service says an address is gone, the device is paused, not deleted: its queue stays, and the app renews it (E1).
- **Recap payload:** `{ kind: 'recap' }`. It carries no data (025).
- **Reminder payload:** `{ kind: 'reminder', ciphertext }`. The service worker decrypts it with a key held only in IndexedDB on the phone: 256-bit AES-GCM, stored as raw bytes under `settings/reminder-key`, never in a backup. Ciphertext = base64url(iv ‖ sealed `{ t: title, b: "08:00 · 30 min", g: tag }`).
- **Devices (059):** one record per device, keyed by a random device token created at subscribe time and sent as a header on every call. No accounts, no user table: each phone is independent, and its data never leaves it.
- **Phone cap (121, replaces the invite code of 059):** no code is asked. So strangers who find the URL in this public repo can't drain the free tier, the function holds at most 25 phones (`MAX_DEVICES`); a new phone past that is refused, a known one always renews. Rate-limit every endpoint per device token.
- **The function stores nothing else.** No logs containing payloads.
- **Secrets:** the storage keys live in the function's secret environment variables. The VAPID key pair is made by the function on first use and kept in its private bucket (063), so no person ever handles the private key. Neither is ever in this repo.

---

## 11. Open items

| Item | Needed by |
|---|---|
| M0 step 6: does a scheduled time hold across a time-zone change? (vibration: not available on iOS, as expected) | M3 |
| 034 calendar colours, 044 detail screens hide tab bar, 053 motion tokens, 060 days held: confirm | M1 |
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
| 046 | A fifth calendar colour | Decided by 081 |
| 047 | Gamification: consistency ranks, Starter (Apprentice since 105) → Master | Decided (tiers dropped by 055) |
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
| 059 | For the owner; close friends may try it (push keyed per device, invite code) | Decided (invite code replaced by a phone cap, 121) |
| 060 | Days held = calendar days since the run's first done, not occurrences | Proposed (amended by 120) |
| 061 | Numbers without leading zeros (82%, not 082%) | Decided |
| 062 | The push function's memory is Object Storage (one JSON file per phone), not a database | Decided |
| 063 | The function makes its own VAPID keys and keeps them in its private bucket; the app fetches the public key | Proposed |
| 064 | A test push can be scheduled up to 24 h ahead (`POST /test { at }`) | Proposed |
| 065 | M2 includes a first .ics import of the HABITS calendar, so daily use starts at the end of M2 | Decided |
| 066 | One habit calendar; switching on a second one in the review merges it in (023 generalised) | Proposed |
| 067 | H04 asks for the invite code only when the push function doesn't know the phone yet | Superseded by 121 |
| 068 | Copy not in the design, proposed: day-result lines other than the one-slip example ("Every habit done.", "None held today. Tomorrow starts clean.", "2 of 4 held. A and B slipped."), "Nothing due today", the H08 merge hint; the H25 and H21 texts drop the parts about Stats and motion | Proposed |
| 069 | A push when each habit starts; no 22:30 recap push for now. The owner answers in the app; the recap stays in the app. Built as a per-phone switch so the recap push can come back | Decided (owner, 7 Oct 2026) |
| 070 | Day view free bands: gaps of 1 h or more between two events, inside 08:00–20:00 | Proposed |
| 071 | Editor details not in the design: Calendar, Repeat (Never, Every day, Weekdays, Every week with days, Every 2 weeks, Every month, Every year, an end date), Reminder, Place and Notes open sheets; Starts and Ends open the iPhone's own date and time wheels; a new event starts at the next whole hour (09:00 on other days) in the habit calendar; H33 keeps the date strip and chips | Proposed |
| 072 | Every event can remind (021): minutes before its start, 0 = at the start. A new event takes its calendar's default (R5): habits at the start (069), other calendars 15 min (Proton's default in the imported files) | Proposed |
| 073 | "All events" on a habit that already has answers splits the series at today, so past answers keep their original time and title (E16) | Amended by 115 (the split stays inside the habit) |
| 074 | Not designed, built to the system: About (version, privacy note, licences); "Bring back from today" for an archived habit; the Changed list sheet in Import; H46 for 069 (the 22:30 toggle is off by default, Last arrived has no chevron, a Turn on notifications banner); a calendar's default reminder can also be applied to the events already in it; Welcome has Restore from a backup (E2) | Proposed |
| 075 | Backup nudge on Today (R7): "Last backup 9 days ago. If ATOMIC is removed, everything since is gone." with Back up now, after 7 days (O7 still open), or 7 days after tracking starts with no backup | Proposed |
| 076 | Sheets (U02, U03): slide up from the bottom in 400 ms and slide down the same way (standard curve, scrim fades with them), for every modal sheet. The handle follows the finger: down freely, up with resistance, past 30% of the height or 500 px/s closes. No X by default (`showClose` stays available). Secondary buttons are a `bg/subtle` fill with no outline (035). No focus ring on a sheet's first button when it opens. The dialog never scrolls (`overflow: clip`): scrolling made iOS show the sheet mid-screen first (U03). Replaces the 150 ms close of page 11 | Proposed |
| 077 | Event detail has Duplicate (U04): it opens the editor with a copy, and Save is refused until the date or time differs from the original. The Repeat sheet has Custom (U05): every 1–4 weeks, on the weekdays chosen, at a time (the event's start time); one time per series, so different times on different days are separate events | Proposed |
| 078 | About ends with the website, markoferrari.eu, in place of the "Made with" list; the font and icon licences stay in the repo (`public/fonts/OFL.txt`) | Proposed |
| 079 | The empty Today asks for a habit, not a calendar: primary New habit (it creates the HABITS calendar), Import from Proton (.ics) as a tertiary link. Figma H14 updated; code follows | Decided (owner, 7 Oct 2026) |
| 080 | Kaizen: the weekly recap (H39) ends with one adjustment to try for 2 weeks (one variable, then review). Identity, cue, smallest version and plan B (Figma Playground P2–P5) stay proposals, not decided | Decided (owner, 7 Oct 2026) |
| 081 | Twelve calendar colours, so up to twelve calendars each keep a hue: the original four plus Violet #7A3FC0, Orange #C25A0A, Teal #0E7490, Brown #8A5A3C, Slate #5B6B7D, Plum #9C2F9A, Gold #A37A00, Sky #3A8FD0 (markers only, 034; all ≥ 3:1 on white). The picker wraps to two rows. Resolves 046 | Proposed |
| 082 | Weekly recap (H39, 080): shown from Monday for the week before, only if 3 or more habit days were due; the Stats banner stays until it is opened. It names one pattern (the most common skip reason, else the weakest habit) and proposes one adjustment by reason (smaller version, earlier slot, and so on) | Proposed |
| 083 | Kaizen trial (080): one adjustment at a time, 14 days, then a review against the 14 days before (done ÷ due, with the due count). The owner keeps it for 2 more weeks or drops it; nothing is ever deleted. Stored in the Settings record (`adjustments`, `recapSeen`), so a backup carries it | Proposed |
| 084 | Ranks are computed from answers and written to `ranks` the first time they are seen, so they are never taken back (047, E4). Days held counts calendar days (060) | Proposed |
| 085 | Habit design (Playground P2, P3, owner approved 7 Oct 2026): a habit can have a cue ("After Breakfast", stored as that habit's title), a smallest version and an identity ("I'm becoming: A reader"), all optional, in "Make it stick" in the habit editor. Today shows the cue in the row and "Voting for: …" under the ring | Proposed |
| 086 | The 2-min version (P4): the habit sheet offers "Did the 2-min version" when a smallest version is set. It counts as done for rates, runs and ranks (a plain `done` with `small: true`); habit detail shows full and small apart | Proposed |
| 087 | Plan B (P5): Skip first offers "Move to HH:MM today", with scrollable hour and minute wheels (5-minute steps, later than now, same habit day), stored as a one-day override. Moving answers nothing; skipping stays below and still counts as a miss (051) | Proposed |
| 088 | The name on the Home Screen, in the browser tab and in push titles is "Atomic" in Title Case, like the other icons (U06). The wordmark and 018 are unchanged; iOS keeps the old label until the app is added again | Proposed |
| 089 | The Calendar views scroll one step at a time (U08): Day's date strip by day, Week by week and Month by month (a pager of full-width pages, seven kept in memory). Day's strip: seven days visible, the middle one is the chosen day, it snaps like a wheel, and each step plays a very quiet synthesized tick (the time wheel too). The web can't use the system wheel sound or haptics; the tick is silent until the first touch and when the mute switch is on | Proposed |
| 090 | Text fields have no heavy focus ring (U07): when focused, the same 1 px border turns from `border/control` to `border/strong`. Sheets' and buttons' keyboard focus ring stays | Proposed |
| 091 | Calendar (U09): a "Today" link beside + when the chosen day is not today; the Day strip and the Week and Month pagers take horizontal drags only (`touch-action: pan-x`) and the page no longer rubber-bands, so touching them no longer pulls the whole screen | Proposed |
| 092 | Blocks of information sit 32 apart (`layout/block-gap`, was 40); 16 or less inside a block (Gestalt proximity) | Decided (owner, 8 Oct 2026) |
| 093 | Perfect-day award: a faceted gold star (award/* tokens, `bg/stage`) turns in, holds and lands in today's week-strip cell; once a day, tap skips, reduced motion fades. The ring stays green with a small star inside (option A); success is never crimson | Decided (owner, 8 Oct 2026) |
| 094 | `motion/duration/hold` = 1200 ms, the award's still moment | Proposed |
| 095 | A stepper (segment + label + check per step: grey, green when done) replaces "1 of X" on every flow with steps; Back sits above it, the chevron flush left | Decided (owner, 8 Oct 2026) |
| 096 | Week strip under the Today ring (perfect, partial, missed, open, ahead) and as the header of the Habits week grid | Proposed |
| 097 | Habits first: tabs Today · Habits · Stats · Settings. Start is welcome → reminders → your habit → when; no import or account on the way in. The Calendar was an optional view (Settings → Show my events) until 104 removed it. Supersedes 015, 022 and 023 as the product's centre; the calendar code stays | Decided (owner, 8 Oct 2026) |
| 098 | Every habit row names its next rank ("Builder in 6 days"); progress bars are always green | Decided (owner, 8 Oct 2026) |
| 099 | The morning after a miss, one line on Today says today keeps the run | Proposed |
| 100 | Star medal: the habit's icon ringed by 12 slots; Apprentice (was Starter) 1, Builder 3, Keeper 6, Artisan 9, Master 12. Replaces the shapes and colours of 049/055 | Decided (owner, 8 Oct 2026) |
| 101 | The 5-segment mastery ring leaves the rows (two systems for one idea); "Per week" goals wait for rules on rates and runs (006, 051) | Proposed (Per week: rules in 119) |
| 102 | No number without a picture: Stats drops the big rate line, and the Habits week and month drop their summaries; the strip, stars and green bars carry it. Habits week rows are divided. Today's heat cell loses the strong outline once it is coloured. Star medal stars sit like a watch: star n at n o'clock, so the 6th is opposite the 12th and the 9th opposite the 3rd | Decided (owner, 8 Oct 2026) |
| 103 | The selected segment of every segmented control is filled with `action/primary`, no border, label in `action/on-primary` | Decided (owner, 8 Oct 2026) |
| 104 | The Calendar leaves the app: no Show my events, no Calendar views, no Calendars and import, no .ics import from Today. Imported calendars go stale the day after the import and nothing syncs them back (020), so they promised more than they gave. Only habits show and remind; other events already on a phone stay in IndexedDB and backups. The habit editor hides the Calendar row and says Edit habit. The code stays, unrouted, in case a read-only overlay comes back. Confirmed by a test session with 5 people (the first 3 plus 2 new, 8 Oct 2026): all five wanted habits only | Decided (owner, 8 Oct 2026) |
| 105 | The first rank is Apprentice, not Starter: "Starter in 6 days" read as "starts in 6 days". Label only; the stored id stays `starter`, so ranks already reached keep their records | Decided (owner, 8 Oct 2026) |
| 106 | The perfect-day award plays whenever Today shows a perfect day it hasn't celebrated: right after the last habit is done, or when Today opens after the day was finished elsewhere (the Recap). It is stored as day and number done, so undo and redo don't replay it but a habit added later earns it again; a pending rank sheet (H5) goes first (U11) | Proposed |
| 107 | Milestone quotes (Playground 02, Q1 and Q3): halfway to Apprentice and Builder, every quarter to Keeper, Artisan and Master; on Today under the strip once the habit is done, ticks on the next-rank bar, the last quote kept on the habit detail. The sheet alternative (Q2) was not chosen | Decided (owner, 8 Oct 2026) |
| 108 | Comeback (Playground 04): a done right after one miss saves the run; a quote and "your N-day run holds" on Today, a mark in the week strip, runs saved on the habit detail; the morning after a miss gets a quote above the 099 line | Decided (owner, 8 Oct 2026) |
| 109 | Perfect week (Playground 05): the last-day line, the constellation award after the day's star (once a week), and the year's sky on Stats | Decided (owner, 8 Oct 2026) |
| 110 | Quotes: one pool per moment (milestone, morning after a miss, comeback, week), given once per moment and never repeated until the pool turns; at most one on Today; public domain or ATOMIC only, no modern authors; none on the daily perfect-day award, none in pushes | Proposed |
| 111 | Small tweaks after use: segmented controls are fully rounded (`radius/round`, container and selected segment, with 103's fill); a perfect day in the Habits month grid is the full green cell, the corner star left; Settings is one list with every row the same distance apart | Decided (owner, 8 Oct 2026) |
| 112 | A habit can be deleted, not only archived (Playground 04): Delete this habit at the bottom of the habit detail, beside Archive habit. With a rank, the sheet offers Archive instead first (A); without one, a plain question (B); either way a toast keeps Undo for 5 s. Delete removes the series, its answers and its rank records (the one exception to 084); an active Kaizen trial on it ends as dropped (083); perfect days and weeks already celebrated stay | Decided (owner, 12 Oct 2026) |
| 113 | Habit detail (Playground 05, V2): done of due as the ring, done/due inside with the rate and its window; beside it This run (green) and Best run (`border/control`) on one scale. The best run is never shorter than the run in progress | Decided (owner, 12 Oct 2026) |
| 114 | Get started opens the empty Today (U14): no reminders step and no invite code on the way in. Once a habit exists, Today shows Turn on reminders until they are on; it opens Settings → Notifications, where the invite code is asked only for a phone the push function doesn't know (067). The invite code stays (059). S2–S4 on page 14 are kept as the record of the first start | Decided (owner, 12 Oct 2026); invite code removed by 121 |
| 115 | A habit keeps one id for life (U15). A time or repeat change ("this and following", or "all events" with past answers) keeps the old schedule inside the habit as a past version (`past`, oldest first) instead of making a new series with a new id, which started the run, ranks and stats over. Past days keep their original time and title (E16). Habits split this way before 0.8.2 are joined back once on each phone (same calendar, name and icon; the new part starts within 14 days of the old end; no answers on the wrong side): answers, rank records and the ids in settings move to the first habit. Meetings still split (073). Amends 073 | Proposed |
| 116 | New habit has an (i) beside Nudge at the start and Make it stick (U16): it opens a sheet that explains the row in plain words (the nudge: one notification at the start; Make it stick: After, Smallest version, I'm becoming, all optional). The (i) is `icon/muted` at 16 inside its own 44 hit area, right after the label; the row keeps its own tap. The helper line under Make it stick goes: the (i) carries it. Figma page 14, E1b–E1d | Decided (owner, 14 Oct 2026); copy proposed |
| 117 | A habit can be paused ahead of time (Playground 08, owner 14 Oct 2026, with a reason). Habit detail → Pause habit: a start day (today or later), 3 days, 1 week or 2 weeks, and a reason (Travel, Ill or injured, Busy stretch, Other with a short note). If the habit has a 2-min version, the sheet offers it first. Paused days are not due: no miss, no nudge, out of done ÷ due (033); the run waits, so days held skip them (060). One pause at a time, 14 days at most, never backwards. Today says “Walk is paused until …” with Bring it back today, and the day after a pause ends “Walk is back today”. Pauses stay on the habit (`pauses`) after they end, so backups keep why | Decided (owner, 14 Oct 2026); copy proposed |
| 118 | Routines from After (Playground 09, owner 14 Oct 2026): habits whose After names another habit due the same day (by its short name, any case; exactly one match) form a routine, two or more habits, named by when its first one starts (Morning 04–12, Afternoon 12–18, Evening). Today shows each routine first, “Morning routine · 1 of 3”, in the order the habits follow each other, then Later and Done. A done in a routine hands Mark as done to the next open habit, whatever its clock time (040). One nudge per routine and day, on its first habit not yet answered (“Morning routine” · “Stretch first · 07:00”); the others stay quiet. The Habits list groups routines, then On its own; a habit after the first shows “After Stretch” in place of its time. Runs, rates and ranks stay per habit. Nothing is stored: routines are read from After. Renaming a routine: not built | Decided (owner, 14 Oct 2026); copy proposed |
| 119 | Per week (Playground 10, owner 14 Oct 2026): New habit → Per week asks Times a week (1–6) and a usual time; the habit repeats every day (FREQ=DAILY, `perWeek`). It is not due on a single day: on Today it sits under This week, outside the day's count, with “1 of 3 this week · 4 days left” and Mark as done (no Skip); it leaves Today once the week's target is met. On its must-do days (times still to do = days left in the week) it is due like any habit and can be missed. A week (Monday–Sunday, R1) is held when the target is met; the target never exceeds the days the habit could be done that week (start, pause, archive). Runs in weeks: a week not held is one miss, two in a row end the run (051); days held stay calendar days (060), and a week not held adds none of its days (120). Habit detail counts weeks held ÷ weeks over the last 12, and each week bar is its share of the target. Nudges at the usual time on days still open, none once the target is met. No comeback and no morning-after line for it (they are counted in days). Edit habit shows Times a week in place of Repeat | Decided (owner, 14 Oct 2026); copy proposed |
| 120 | A forgiven miss keeps the run but isn't a held day (U17). Never missing twice keeps the run alive (051), but each missed or skipped due day inside a run comes off days held (060), so a rank needs the habit actually done: Breakfast 10 of 10 reaches Apprentice on day 10, Training 9 of 10 on day 11. It closes a hole where done-miss-done-miss, never two in a row, reached Master in a year on half the work. A per-week week not held takes off all its available days (119). Milestones, next-rank lines, the comeback's "N-day run" and the best run follow, since they read days held. Ranks already reached stay (084); a new run starts clean | Decided (owner, 19 Oct 2026) |
| 121 | No invite code (U18): new users were stopped by the code field before their first nudge. Any phone may join the push function, up to 25 phones (`MAX_DEVICES`), so the free tier stays safe; a known phone always renews. iOS asks only in answer to a tap, and only once, so the app asks when it explains itself: saving a habit with Nudge on, on a phone never asked (the question starts inside the tap on Save, then the phone joins and its reminders are planned). Not now leaves Today's Turn on reminders, which now turns them on in place with one tap; a no or a failure opens Notifications (R3). Notifications keeps one Turn on notifications button, no field. Supersedes 067; amends 059 and 114 | Decided (owner, 19 Oct 2026) |

| 122 | Style B (Playground sections 11–17): one stone background (`bg/app`); ATOMIC's own boxes are white cards (`bg/card`, `radius/card` 24); pastel fields belong to habits only. No decorative shadows (the empty-Today card keeps one). 4 px grid, 10 → 12. Amends 014 (cards return, as white surfaces, never as borders) | Decided (owner, 19–20 Oct 2026) |
| 123 | A habit's field colour comes from its object's group (Move sky, Drink butter, Learn sage, Rest lilac, Joy blush, Food peach, Health aqua, Make clay): never chosen, never good or bad | Decided (owner, 19 Oct 2026) |
| 124 | Crimson leaves the UI: orange #B45309 marks missed, skipped and destructive actions (AA on white and stone, white on it 5.02:1). Primary actions are ink. The logo's red stays | Decided (owner, 20 Oct 2026) |
| 125 | Tab bar: the floating ink pill, the active tab in a white capsule with its label, gliding between tabs (Playground 12, version B). The capsule is a fourth thing that may overshoot (amends 053) | Decided (owner, 20 Oct 2026) |
| 126 | A skip or a miss is one orange circle with a white minus, whatever the reason; the reason is not shown on rows | Decided (owner, 20 Oct 2026) |
| 127 | Star 3D: one faceted gold star everywhere (perfect day, week strip, sky, Master) | Decided (owner, 19 Oct 2026) |
| 128 | Badge 3D replaces the star medal of 100: circle → rounded square → pentagon → hexagon → hexagon with the star; rims bronze, silver, gold; the habit's object on its field | Decided (owner, 20 Oct 2026) |
| 129 | One Month calendar (week by week, Monday first) on the habit detail, Habits month and Stats month: Done, Some done (hidden for one habit), Missed, Today, Ahead. Stats month drops the 5-step heat (amends 038). The habit detail (D1) drops the ring, the 12 week bars and the time buckets of 113; the best run stays as a line | Decided (owner, 20 Oct 2026) |
| 130 | Reminders that aren't habits: Count it as a habit off. A nudge at each time, nothing to tick, never counted (005). Amends 069 and 072 | Decided (owner, 20 Oct 2026); cap and push actions after testing |
| 131 | "Welcome to the new ATOMIC" after an update: a sheet over Today once per version, four generic lines, the version, Continue. A fresh install doesn't see it | Decided (owner, 20 Oct 2026) |
| 132 | 48 3D habit objects in 8 groups replace the 44 Lucide habit icons (amends 043); picked from "Choose an object" with a search | Decided (owner, 19 Oct 2026) |
| 133 | A habit's object is changed where the habit is edited (U19): Habits → the habit → Edit shows the object beside the name, with Change opening "Choose an object" (N2); until one is chosen it follows the name. Changing only the object saves at once with no "this event or all events" question, and through "Only this event" it still reaches the whole habit, since an object never belongs to one day. Settings → Habits is now Settings → Archived habits: it lists archived habits only (E9) and offers Bring back from today; renaming and the object left it. Amends 074 | Decided (owner, 21 Oct 2026) |

Note: "Proposed" means designed and built as specified, but not yet confirmed by the owner. Treat it as the spec until it changes.

---

## 13. Working agreement for build sessions

- Work one milestone at a time. Open a short PR per slice, written for a designer to review: what changed, the screens it touches, the decisions it implements.
- Before a slice is called done:
  - `npm run check` (types), `npm test` (domain rules) and `npm run build` pass;
  - no raw hex, px or ms values outside `tokens.css` (a lint rule enforces it);
  - the slice is tested on the iPhone once a milestone closes.
- When the design and reality disagree (iOS limits, performance), stop, explain it in plain words, propose an option, and log the decision.
