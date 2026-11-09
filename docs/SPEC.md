# AMS Garmin MCP — Specification (1.1.0, 9 Nov 2026; board 1.4.0)

## 1. Purpose
Read-only MCP server giving Claude access to the owner's Garmin Connect data via Garmin's official Personal API (spec: `docs/garmin-personal-openapi.json`, title "Garmin Connect Personal API" 1.0.0, 26 paths, all GET). Base URL `https://personal.connectapi.garmin.com` (the spec also lists `.garmin.cn`; unused). Nothing is ever written to Garmin.

## 2. Architecture
- Transport: stdio MCP server. Node >= 20, plain JavaScript, ES modules. Dependencies: `@modelcontextprotocol/sdk`, `zod`.
- `src/server.js` — entry point; creates the server, registers tools, connects stdio.
- `src/garmin-client.js` — key lookup, token minting/caching, HTTP requests, error mapping.
- `src/tools.js` — tool definitions (name, zod input schema, handler, endpoint mapping, trimming, chunking).
- `board/board-data.js` — `buildBoard(client, { today, now })`, aggregates Garmin data into one JSON object (section 9).
- `board/server.js` — local HTTP server for the board (Node `http`, no new dependencies).
- `board/public/index.html`, `board.css`, `board.js` — the board page.
- `scripts/open-board.sh`, `scripts/build-board-app.sh` — launcher and app builder for "AMS Garmin Bridge Board" (named "AMS Garmin Board" before 1.2.0).
- stdout is reserved for the MCP protocol; all logs go to stderr.

## 3. Authentication
1. `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token` with header `Authorization: ApiKey <key>` and NO Accept header (Garmin answers HTTP 406 when asked for JSON). The answer is the bare access token as plain text (a JWT); the server reads its expiry from the JWT `exp` claim, falling back to 24 h.
2. Response: access token valid 24 h or until the key expires. No refresh tokens.
3. Data requests send the access token as bearer token.
4. Cache: `token.json` next to the key file, used until 5 minutes before expiry (safety margin).
5. On HTTP 401 the server re-mints a token once and retries; a second 401 is reported as a rejected key.

### Key lookup order
1. Environment variable `GARMIN_PERSONAL_API_KEY`.
2. Key file `~/Library/Application Support/AMS Garmin MCP/api-key` (mode readable only by the user).

### File locations
Directory `~/Library/Application Support/AMS Garmin MCP/`: `api-key`, `token.json`. A Mac dialog saves the key to `api-key`. The key never enters chat, logs or the (public) repository.

## 4. Errors (plain words)
- Missing key: says no key is saved and how to create and save one.
- Rejected key (401 after re-mint / token request refused): says the key was rejected or expired; make a new key and run the save-key dialog.
- 404: "no data" for that date/item (not a failure of the key).
- 429: "slow down" — Garmin rate limit; try again shortly.
- Other errors: HTTP status plus short message; never the key or token.

## 5. Conventions
- Dates are `YYYY-MM-DD` in the user's local calendar. Defaults of "today" use the Mac's local date.
- Range limits: see tools. Longer ranges are split into consecutive chunks of the allowed size, fetched one after another, and the results concatenated in date order.

## 6. Response trimming
- null, empty strings, empty arrays and empty objects are removed recursively.
- Large time series are dropped unless asked for: `heartRateValues`, `bodyBatteryValuesArray`, `hrvReadings`, SpO2 values (`includeSeries` / `includeReadings` = true keeps them).
- Activity lists are reduced to an allowlist of fields unless `full=true`: activityId, activityName, activityType key, eventType key, startTimeLocal, duration, movingDuration, distance, calories, averageHR, maxHR, elevationGain, averageSpeed, maxSpeed, steps, aerobicTrainingEffect, anaerobicTrainingEffect, trainingEffectLabel, activityTrainingLoad, vO2MaxValue, avgPower, normPower, totalSets, totalReps, summarizedExerciseSets, moderateIntensityMinutes, vigorousIntensityMinutes, locationName, isFavorite, isPR.
- Output is compact JSON.

## 7. Tools
All dates `YYYY-MM-DD`; `?` = optional.

| Tool | Arguments | Garmin endpoint | Notes |
|---|---|---|---|
| garmin_status | none | GET /userprofile-service/userprofile/settings | Tells whether the key works. Returns displayName, measurementSystem, timeZone, key file location, cached token expiry. No key: the plain-words message. |
| garmin_profile | none | same | Full settings, compacted. |
| garmin_activities | startDate?, endDate?, activityType? (running, cycling, strength_training, walking, swimming …), search?, limit? (default 20, max 99), start? (offset, default 0), sortOrder? (asc\|desc, default desc), full? | GET /activitylist-service/activities/search/activities | Trimmed list (allowlist in section 6). |
| garmin_activity | activityId (number), includeWorkouts?, full? | GET /activity-service/activity/{activityId}; includeWorkouts adds GET /activity-service/activity/{id}/workouts | Details and splits; exercise sets via workouts. |
| garmin_activity_file | activityId, folder? (default ~/Downloads/Garmin) | GET /download-service/files/activity/{activityId} | Saves the original file (a zip containing the .FIT); returns path and bytes. |
| garmin_day | date? (default today), full? | GET /usersummary-service/usersummary/daily?calendarDate= | Trimmed: steps, distance, calories (total/active/bmr), floors, intensity minutes, heart rate (min/max/resting/7-day avg resting), stress (avg/max, durations), Body Battery (highest/lowest/charged/drained/most recent/at wake), SpO2, respiration, hydration, sleepingSeconds, goals. |
| garmin_days | startDate, endDate | GET /usersummary-service/v2/dailysummaries?startDate=&endDate= | Up to 1 year per Garmin call; per-day compact summaries, series stripped. |
| garmin_sleep | date? OR startDate?+endDate?, full? | date: GET /sleep-service/sleep/dailySleep?date=; range: GET /sleep-service/sleep/dailySleepSummariesByDate?startDate=&endDate= | Range max 31 days per call, chunked. |
| garmin_hrv | date? OR startDate?+endDate?, includeReadings? | date: GET /hrv-service/hrv/{calendarDate}; range: GET /hrv-service/hrv/daily/{fromDate}/{toDate} | Range chunked by 31. |
| garmin_stress | startDate, endDate | GET /usersummary-service/stats/stress/daily/{startDate}/{endDate} | Max 28, chunked. |
| garmin_steps | startDate, endDate | GET /usersummary-service/stats/steps/daily/{startDate}/{endDate} | Max 28, chunked. |
| garmin_body_battery | startDate, endDate, includeSeries? | GET /wellness-service/wellness/bodyBattery/reports/daily?startDate=&endDate= | Max 31, chunked. |
| garmin_heart_rate | date?, includeSeries? | GET /wellness-service/wellness/dailyHeartRate?date= | |
| garmin_spo2 | date?, includeSeries? | GET /wellness-service/wellness/daily/spo2acclimation/{calendarDate} | |
| garmin_weight | startDate, endDate, includeAll?, includeGoal? | GET /weight-service/weight/range/{startDate}/{endDate}?includeAll= | includeGoal adds GET /goal-service/goal/user/effective/weightgoal/{startDate}/{endDate}. |
| garmin_hydration | startDate, endDate | GET /usersummary-service/stats/hydration/daily/{startDate}/{endDate} | Max 31, chunked. |
| garmin_fitness_age | date? | GET /fitnessage-service/fitnessage/v2/{calendarDate} | |
| garmin_heart_rate_zones | none | GET /biometric-service/heartRateZones/v2 | |
| garmin_nutrition | date? | GET /nutrition-service/food/logs/{date} | |
| garmin_wellness_activities | startDate, endDate | GET /wellnessactivity-service/activity/summary/range/{fromDate}/{untilDate} | Chunked by 31. |
| garmin_menstrual_cycle | date?, detailed? | GET /periodichealth-service/menstrualcycle/summary/{calendarDate}, or with detailed: /dayview/{calendarDate} | |
| garmin_raw | path, query? | any GET matching one of the 26 paths in the spec | Compact JSON back. Any other path is refused. |

### The 26 allowed raw paths
Exactly the paths in `docs/garmin-personal-openapi.json`: activity/{activityId}, activity/{activityId}/workouts, activitylist search, heartRateZones/v2, download-service activity file, fitnessage v2, weightgoal range, hrv/{date}, hrv/daily range, nutrition logs, menstrualcycle summary and dayview, dailySleep, dailySleepSummariesByDate, userprofile settings, hydration/steps/stress daily stats, usersummary daily, v2 dailysummaries, weight/all range, weight/range, bodyBattery reports daily, spo2acclimation, dailyHeartRate, wellnessactivity summary range. Path parameters are matched as templates.
Note: `/weight-service/weight/all/{startDate}/{endDate}` has no dedicated tool; reachable via `garmin_raw` (or `garmin_weight` with includeAll).

## 8. Tests and CI
- `npm test` = `node --test test/`.
- A fake `fetch` replaces the network; no real Garmin calls, no keys in tests.
- Every tool is found by its name and exercised (arguments, endpoint, chunking, trimming, error wording, 401 re-mint once).
- GitHub Actions runs `npm test` on every push.

## 9. Board
"AMS Garmin Board" 1.4.0: an LCARS-inspired instrument board (calm colours on a mid-grey background, rounded bars, condensed uppercase lettering) showing the owner's Garmin data live in the browser. Read-only towards Garmin. Own data (settings, Captain's log, travel note) is stored only on the owner's Mac, outside the repository. Plain JavaScript, Node 20 or newer, no dependencies, no build step.

### Files
- `board/board-data.js` — `buildBoard(client, { today, now, settings, log, travel })` returns one JSON object. Uses `GarminClient`.
- `board/server.js` — HTTP server on Node's built-in `http`. `createBoardServer({ client, now, cacheMs, today, storeDir, fetchFn, remoteAddressOf, homeZone, notify })`. `notify({ title, text, alerts })` is called when a red alert fires for the first time that day (see Formulas); `startBoard` defaults it to a Mac notification via `osascript` (`display notification … with title … sound name "Basso"`) and rebuilds the board every 30 minutes (`watchMs`); tests pass their own `notify` and none by default. CLI: `node board/server.js --port N` (default 7788).
- `board/fit.js` — own tiny FIT decoder: file header, definition and data messages, little and big endian, record (20) and lap (19) messages; developer fields skipped; CRC not checked.
- `board/store.js` — atomic JSON files (temporary file, then rename). Since 1.4.0 also `BoardStore.notified()` → `{ date, keys }` and `BoardStore.saveNotified(date, keys)` for `alerts-notified.json`, and `BoardStore.saveSettings({ targets, plan, notify, accessCode })`.
- `board/public/index.html`, `board.css`, `board.js`, `explain.js` — the page. Fonts: Google Fonts "Antonio" with a system condensed fallback.
- `scripts/open-board.sh` — if `/api/health` does not answer, starts the server; waits up to 5 s; opens `http://127.0.0.1:7788/`. Log: `~/Library/Logs/AMS Garmin Board.log`.
- `scripts/build-board-app.sh` — builds `~/Applications/AMS Garmin Bridge Board.app` with `osacompile` (bundle id `com.ams.garmin.board`, heart icon from the AMS Icon Library, ad-hoc codesign) and a Desktop alias of the same name; it removes the pre-1.2 "AMS Garmin Board" app and alias.
- `scripts/install-agents.sh`, `scripts/report.sh` — see "Launch agents".

### Colour schemes
Chosen with `<html data-scheme="…">`. `board.css` has one `:root[data-scheme="…"]` block per scheme; the plain `:root` block holds the default (calm-dusk). `--ok` is #66cc99 (#2e8b57 in calm-day). `color-scheme` is light for calm-day, dark for the others.

| scheme | bg | ink | text | dim | track | grid | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| calm-dusk (default) | #3d3a44 | #1a171c | #f7efe4 | #b3a899 | #524e59 | #5e5964 | #ff9966 | #ffcc99 | #cc99cc | #ff9966 | #ffcc99 | #ffcc99 | #cc6666 | #ffcc99 |
| calm-dark | #000000 | #000000 | #f3e9dc | #9a8f84 | #1d1a17 | #2a2520 | #ff9966 | #ffcc99 | #cc99cc | #ff9966 | #ffcc99 | #ffcc99 | #cc6666 | #ffcc99 |
| calm-day | #f1ebe3 | #fff8f0 | #2b2420 | #7a6e63 | #e0d6c9 | #d4c8b8 | #e0702e | #c9873a | #8e62a0 | #e0702e | #c9873a | #c9873a | #b84a4a | #c9873a |
| ice | #05080f | #000000 | #e6f0fa | #7d8da1 | #0f1724 | #182236 | #8fd3ff | #5aa9e6 | #b8c7d9 | #5aa9e6 | #8fd3ff | #e0f0ff | #ff6b6b | #b8c7d9 |
| ember | #000000 | #000000 | #ffe9c4 | #8a6a3a | #1a1208 | #2a1d0c | #ffb000 | #ff8c00 | #c47a1a | #ffb000 | #ffd27a | #ffd27a | #ff5a36 | #ffd27a |
| forest | #0a0f0d | #000000 | #e8efe9 | #7f8f86 | #141c18 | #1e2a24 | #7fbf9e | #4f9a7a | #c9b78a | #4f9a7a | #9fd6bb | #c9b78a | #d98a6a | #c9b78a |
| graphite | #0b0b0c | #000000 | #f0f0f0 | #7a7a7a | #1a1a1b | #262628 | #ff7a59 | #d9d9d9 | #a6a6a6 | #8c8c8c | #d9d9d9 | #ff7a59 | #ff7a59 | #e6e6e6 |

The footer `<select id="palette-select">` has exactly these seven option values. The choice is saved in `localStorage` under `ams-garmin-board.scheme` and applied before first paint by a small inline script in `<head>`.

### Page: panels and element ids
Existing ids (unchanged): `board`, `clock-local`, `clock-utc`, `clock-date`, `stardate`, `steps-gauge`, `steps-value`, `body-battery-bar`, `resting-hr`, `stress-bar`, `intensity-gauge`, `floors-value`, `calories-value`, `month-steps-chart`, `month-hr-chart`, `activities-list`, `activities-total`, `sleep-panel`, `hrv-panel`, `weight-thermo`, `link-status`, `last-refresh`, `refresh-button`, `version-label`.

Every panel heading is a `<button type="button" class="label" id="explain-<key>">`. The 31 keys: chrono, steps, body-battery, heart, intensity, energy, bb-curve, fitness, sleep, hrv, sleep-debt, weight, training, zones, streaks, weather, targets, log, month-steps, month-hr, activities, month-totals, activity-detail, year, red-alert, link, rhythm, plan, resting-trend, hydration, stress. The key `link` has no button on the page (the footer status gets none); it is used by the help texts only, so the page carries 30 `explain-*` buttons.

Panels in order inside `<main class="panels">` (12-column grid, sN = span N):
1. `red-alert` (s12, `hidden` unless alerts): `red-alert-text`.
2. `chrono-panel` (s3): clocks, `sunrise-value`, `sunset-value`, `travel-row` (hidden at home) with `travel-days`, `travel-km`, `travel-zone`.
3. `steps-panel` (s3): also `steps-chip` (today's steps against the same weekday four weeks ago, e.g. "▲ +1 240 · MON 12 OCT"; "—" without data). 4. `body-battery-panel` (s2). 5. `heart-panel` (s4).
6. `intensity-panel` (s3). 7. `energy-panel` (s2).
8. `bb-curve-panel` (s4): `bb-curve-chart` (today's line; sleep and workout spans shaded).
9. `fitness-panel` (s3): `vo2max-value`, `vo2max-trend`, `fitness-age-value`, `fitness-age-trend`, `chrono-age-value`.
10. `sleep-panel` (s3): new in 1.4.0 `sleep-strip` (`<div class="strip" id="sleep-strip" hidden>`, inside the panel above the body; text `LAST NIGHT · BED 23:10 · UP 06:45 · GOOD`, or with `sleep.firstNight` `FIRST NIGHT WITH THE WATCH · WELL DONE · BED 23:10 · UP 06:45`; hidden when no sleep is recorded, the NO SLEEP DATA text stays). 11. `hrv-panel` (s2).
12. `sleep-debt-panel` (s3): `sleep-debt-value`, `sleep-debt-chart`, `sleep-debt-note`. With `missingRecent` = 3 the note reads "WEAR THE WATCH TONIGHT · 3 EMPTY NIGHTS" and `sleep-nudge` (a small note inside `sleep-panel`) is shown.
13. `weight-panel` (s4): `weight-thermo`, `weight-trend-chart` (90 days, dots, 7-day average line, goal line), `weight-date`, `weight-delta`, `weight-goal`.
14. `training-panel` (s3): `training-load-bar`, `training-acute`, `training-chronic`, `training-ratio`, `training-status`.
15. `zones-panel` (s3): `zones-chart` (stacked bar, five zones), `zones-total`, `zones-total-label` ("IN ZONES" or "IN ZONES · LAST 7 DAYS"), `zones-note` (heading note; with `period` 'last7': "LAST 7 DAYS · NO WORKOUT YET THIS WEEK").
16. `streaks-panel` (s3): `streak-steps-current`, `streak-steps-longest`, `streak-workout-current`, `streak-workout-longest`.
17. `weather-panel` (s3): `weather-place`, `weather-temp`, `weather-text`, `weather-wind`, `weather-rain`, `weather-hours`, `weather-locate-button`.
18. `targets-panel` (s4): `targets-list` with `target-bar-steps`, `target-bar-workouts`, `target-bar-swims`, `target-bar-runs`, `target-bar-training-minutes`, `target-bar-distance-km`; `targets-edit-button`.
19. `log-panel` (s8, CAPTAIN'S LOG): `log-today-input` (one line, max 200 characters), `log-save-button`, `log-list` (this month's lines, newest first, each `log-line-YYYY-MM-DD`).
19a. (new in 1.4.0, between `log-panel` and `month-nav`, in this order) `plan-panel` (s4, THIS WEEK'S PLAN): heading button `explain-plan`, head button `plan-edit-button` (EDIT, opens Settings), `plan-list` with one row per plan item `<div class="plan-row" id="plan-row-<key>">` (key = runs, strength, swims, rides, hikes, walks, yoga; label, ticks `<span class="ticks">` with ● done and ○ open, and `done / target`), `plan-note` (`3 OF 5 DONE · 4 DAYS LEFT`; `ALL DONE · 2 DAYS LEFT` when complete; `NO PLAN SET · EDIT TO ADD ONE` when the target is 0).
19b. `rhythm-panel` (s4, `WEEKLY RHYTHM · 12 WEEKS`): `explain-rhythm`, `rhythm-chart` (`<div class="chart">`, 7 bars MON to SUN; weakest in the alert colour, strongest in the ok colour; the overall average dashed), `rhythm-note` (`WEAKEST SUNDAY · 6 100 A DAY · STRONGEST SATURDAY · 12 400`; `NO DAYS WITH DATA YET` when empty).
19c. `resting-trend-panel` (s4, `RESTING PULSE · 90 DAYS`): `explain-resting-trend`, `resting-trend-chart` (dots per day, 7-day line, 90-day average dashed, month ticks like the weight chart), `resting-trend-note` (`AVG 51 · 46–58 · LATEST 48 ON 8 NOV`; `NO PULSE DATA YET` when empty).
19d. `stress-panel` (s8, `STRESS · TODAY AND 4 WEEKS`): `explain-stress`, `stress-word` (`<span class="chip">`, the qualifier, `—` when null), `stress-stack` (`<div class="stack">`, rest / low / medium / high as a stacked bar with a legend in hours), `stress-days-chart` (28 bars of the daily average, the 28-day average dashed; bands 0–25 rest, 25–50 low, 50–75 medium, 75–100 high), `stress-note` (`TODAY 23 · 4-WEEK AVG 27`). The stress bar `stress-bar` in the heart panel is unchanged.
19e. `hydration-panel` (s4, `WATER · TODAY`): `explain-hydration`, `hydration-gauge` (`<div class="gauge">`, arc of ml against goal; big number in litres with one decimal and a decimal comma, e.g. `1,2`, unit `LITRES`), `hydration-days` (7 small bars), `hydration-note` (`NO WATER LOGGED · LOG IT IN GARMIN CONNECT OR ON THE WATCH` when `logged` is false, else `GOAL 2,5 L · 7-DAY AVG 1,8 L`).
20. `month-nav` (s12): `month-prev`, `month-label` (e.g. "NOVEMBER 2026 · SO FAR"), `month-next` (disabled on the current month), `month-today` (hidden on the current month).
21. `month-steps-panel` (s7). 22. `month-hr-panel` (s5). 23. `activities-panel` (s8). 24. `month-totals-panel` (s4): delta cells `delta-steps`, `delta-distance`, `delta-floors`, `delta-intensity`, `delta-resting-hr`, `delta-workouts`, `delta-training-time` (arrow ▲ or ▼ with percent or difference against the previous month to the same day).
25. `activity-detail-panel` (s12, hidden until a workout row is pressed): `detail-title`, `detail-summary`, `detail-splits`, `detail-hr-chart`, `detail-map`, `detail-close`. Workout rows: `class="act"`, `id="act-<activityId>"`, `data-id`.
26. `year-panel` (s12): `year-tiles` with `year-tile-01` … `year-tile-12` (steps, workouts, resting pulse, goal days; future months dimmed). New in 1.4.0: under the tiles `last-year-line` (`<div class="sub-label">`; `SAME TIME LAST YEAR · NOVEMBER 2025 TO DAY 9 · STEPS 61 200 → 68 500 (▲ +12 %) · WORKOUTS 4 → 4 (=) · 2025 TO 9 NOV · 1 230 000 STEPS ▲ +3 %`; without data `NO DATA FOR NOVEMBER 2025`), and in each tile a faint ghost bar and `<span class="tk ly" id="year-last-01">2025 · 48 200</span>` (ids `year-last-01` … `year-last-12`; `—` when that month had no data).

Footer bar: `palette-select`, `kiosk-button`, `help-button`, `report-button`, `share-button` (SHARE, key S; new in 1.4.0), `settings-button`, `footer-version` ("1.4.0"), plus the link status and refresh controls.

Sheets (overlays, `hidden` by default; Escape closes = Cancel; the main button is full colour):
- `explain-sheet`: `explain-title`, `explain-summary` (IN SHORT), `explain-more` (LEARN MORE), `explain-close`.
- `help-sheet`: `help-tab-how`, `help-tab-new`, `help-content`, `help-close`. Content from `/api/docs`.
- `settings-sheet`: `target-steps`, `target-workouts`, `target-swims`, `target-runs`, `target-training-minutes`, `target-distance-km`, `plan-runs`, `plan-strength`, `plan-swims`, `plan-rides`, `plan-hikes`, `plan-walks`, `plan-yoga` (type=number, min 0; new in 1.4.0), `notify-toggle` (`<label class="check"><input type="checkbox" id="notify-toggle"> MAC NOTIFICATION ON RED ALERT</label>`), `access-code`, `access-code-current` (`<div class="hint" id="access-code-current">CURRENT CODE · 482913</div>`, hidden when none; filled from `settings.accessCode`, which only the loopback answer carries), `lan-address` (read-only text), `settings-cancel`, `settings-save`.
- `report-sheet`: `report-title`, `report-text`, `report-close`, `report-kind-week`, `report-kind-month`.
- `share-sheet` (new in 1.4.0): `share-canvas` (`<canvas width="1080" height="1350">`, drawn on the page with the Canvas 2D API, no libraries, in the current colour scheme: title `AMS GARMIN · BRIDGE`, the long date, steps ring with goal, resting pulse, Body Battery, sleep hours and word, intensity minutes this week and goal, workouts this month and training time, weight, the month's steps as mini bars, the Captain's log line of the day if any, footer `BOARD 1.4.0 · STARDATE 2026.313`), `share-save` (SAVE PNG: downloads `ams-garmin-board-YYYY-MM-DD.png` through `canvas.toBlob`), `share-send` (SHARE…, shown only when `navigator.canShare({ files })` is true, for example on the iPhone), `share-close`.

Behaviour:
- Clocks tick every second; data refreshes every 10 minutes and on REFRESH (`?refresh=1`).
- No sleep: "NO SLEEP DATA — WEAR THE WATCH AT NIGHT"; no HRV: "NO HRV DATA"; sleep debt with `recorded: false` shows a similar note.
- Keyboard: R refresh, F kiosk, S share, ← and → previous and next month, ? help, Escape closes any sheet.
- Print (new in 1.4.0): `board.css` has an `@media print` block: footer controls, sheets and buttons hidden, white background, no filter, panels avoid page breaks. ⌘P prints the board.
- Kiosk: body class `kiosk`. Between 21:00 and 07:00 local time the body also gets class `night` (dimmed with a CSS filter). In kiosk the cursor hides after 5 s without movement.
- The page reloads itself when `/api/board` reports a different version than the one first loaded.
- Stardate: year.dayOfYear (e.g. 2026.313).

### explain.js format
Plain script, no import or export. Sets `globalThis.AMS_EXPLAIN = { <key>: { title, summary, more } }` for all 31 keys above (since 1.4.0 the keys rhythm, plan, resting-trend, hydration and stress are at the end; titles WEEKLY RHYTHM, THIS WEEK'S PLAN, RESTING PULSE · 90 DAYS, WATER, STRESS; the entries year, sleep, red-alert and targets gained a paragraph or sentence). `title`: uppercase short title. `summary`: one or two sentences, shown under IN SHORT. `more`: array of 3 to 6 paragraphs, shown under LEARN MORE. The page opens `explain-sheet` from the button whose id is `explain-<key>`. Loadable in Node with `import()` (the tests do this).

### Routes
Loopback listener on 127.0.0.1 always; see "LAN gate" for the second listener.
- `GET /` — `index.html`. Other static files from `board/public`; unknown paths 404.
- `GET /api/health` — `{ ok: true, version }`.
- `GET /api/board` — board JSON; cached 5 minutes; `?refresh=1` bypasses the cache. Garmin errors for the core data: HTTP 503 `{ ok: false, error }` in plain words. Side-call failures do not fail the board: the part is empty and the text is added to `warnings`.
- `GET /api/month?ym=YYYY-MM` — `{ ok, ym, month, activities, compare, log }`, same shapes as in the board JSON. Past months cached 24 h; the current month is the board's own data.
- `GET /api/activity/<id>` — `{ ok, id, name, type, start, seconds, distanceM, calories, avgHr, maxHr, elevationGain, splits: [{ index, seconds, distanceM, avgHr, maxHr, ascentM }], hr: [[secondsFromStart, bpm]] (at most 600 points), trace: [[lat, lon]] (at most 1500), altitude: [[secondsFromStart, m]] (at most 600) }`. Built from Garmin `/activity-service/activity/<id>` and the original file `/download-service/files/activity/<id>` (a zip holding a .FIT), parsed by `board/fit.js`. Cached in memory per id. No GPS: `trace: []`.
- `GET /api/weather?lat=&lon=` — `{ ok, place: { lat, lon, source: 'browser' | 'workout' | 'home', name }, now: { tempC, windKmh, precipMm, code, text }, hours: [{ time, tempC, rainPct, windKmh, code }] (next 12), sun: { sunrise, sunset } }`. Via Open-Meteo `https://api.open-meteo.com/v1/forecast` with `timezone=auto`; cached 15 minutes per rounded place. Without lat and lon: the latest workout with coordinates in the last 10 days, else home (Norrköping). `fetchFn` is injectable. WMO code to text: 0 CLEAR, 1 MAINLY CLEAR, 2 PARTLY CLOUDY, 3 OVERCAST, 45 and 48 FOG, 51–57 DRIZZLE, 61–67 RAIN, 71–77 SNOW, 80–82 SHOWERS, 95–99 THUNDERSTORM.
- `GET /api/settings` — `{ ok, settings: { targets: { steps, workouts, swims, runs, trainingMinutes, distanceKm }, plan: { runs, strength, swims, rides, hikes, walks, yoga }, notify, hasAccessCode, lanAddress, accessCode? } }`. `plan` values are integers >= 0 (default all 0); `notify` is a boolean (default true). `accessCode` (the code text) is present only on a loopback request; from the home network only `hasAccessCode` is returned.
- `PUT /api/settings` — JSON body with `targets`, `plan` (object; a negative or non-number value is rejected with a `RangeError`, HTTP 400), `notify` (boolean) and/or `accessCode` (`""` clears). Same answer as GET. Only from loopback, else 403.
- `GET /api/log?ym=YYYY-MM` — `{ ok, entries: { 'YYYY-MM-DD': 'text' } }`.
- `PUT /api/log/YYYY-MM-DD` — JSON `{ text }`; empty text deletes; at most 200 characters. Answer `{ ok, entries }`.
- `POST /api/travel` — JSON `{ zone }`; answer `{ ok, travel: null | { since, zone, days } }`. Home zone = Europe/Stockholm. The first day seen away is stored; back home clears it.
- `GET /api/report?kind=week|month` — `{ ok, kind, title, text }`: the previous Monday–Sunday week, or the previous calendar month, in plain words: steps and average, goal days, workouts by type and total time, resting pulse average and range, intensity minutes against goal, lowest Body Battery, latest weight and change.
- `GET /api/docs` — `{ ok, version, howItWorks, whatsNew }` (markdown): the README section "## The board" up to the next "## ", and CHANGELOG.md.
- `GET /code`, `POST /code` — see the LAN gate.

### Board JSON (`/api/board`)
Unchanged from 1.1.0: `ok, version, generatedAt, date, monthStart, weekStart, link { ok, tokenExpiresAt }, today { … }, month { days, steps, avgSteps, stepGoalDays, daysWithData, distanceM, floorsUp, intensityMinutes, restingHrAvg, restingHrMin, restingHrMax }, week { start, intensityMinutes, goal }, activities { count, seconds, distanceM, calories, elevationGain, byType, list [ { id, name, type, start, seconds, distanceM, calories, avgHr, maxHr, elevationGain, trainingEffect, aerobic, anaerobic, load } ] }, sleep, hrv, weight, warnings`. Resting pulse figures use finished days only. Intensity minutes = moderate + 2 × vigorous. Stress −1 becomes null. Weight comes in grams and is shown in kg with one decimal.

Added in 1.2.0:
```
compare: { previousMonth: 'YYYY-MM', throughDay: N,
           steps|distanceM|floorsUp|intensityMinutes|trainingSeconds|workouts: { now, before, beforeFull, pct|diff },
           restingHrAvg: { now, before, diff } }
streaks: { stepGoal: { current, longest, longestEnd }, workouts: { current, longest, longestEnd } }
alerts: [ { key: 'resting-hr' | 'body-battery' | 'no-sync', text } ]
training: { acute, chronic, ratio, status: 'RECOVERY'|'MAINTAINING'|'PRODUCTIVE'|'OVERREACHING'|'NO DATA', days: [{ date, load }] }   // last 7 days
zones: { secondsInZone: [z1..z5], total, floors: [f1..f5], maxHr }
fitness: { vo2max: { value, date, prev, trend: 'up'|'down'|'flat'|null },
           fitnessAge: { value, prev, chronological, trend } }
bodyBatteryCurve: { points: [[epochMs, level]], events: [{ type, startMs, endMs, impact }] }
sleepDebt: { recorded, nights: [{ date, needMin, sleptMin, napMin }] (7), debtMin }
weightTrend: { days: 90, points: [{ date, kg }], avg7: [{ date, kg }], goalKg }
year: { year, months: [{ ym, steps, workouts, trainingSeconds, restingHrAvg, stepGoalDays, daysWithData }] (12) }
travel: null | { since, zone, days, distanceM }
targets: { steps, workouts, swims, runs, trainingMinutes, distanceKm }
log: { 'YYYY-MM-DD': text }     // this month
lastSyncAt: iso | null
```
`compare` "before" = the previous month through the same day of the month; `beforeFull` = the whole previous month. Months in the future have steps 0, workouts 0 and daysWithData 0 in `year`. Target progress is computed on the page from `month` and `activities`.

Added in 1.3.0:
```
zones.period: 'week' | 'last7'     // 'last7' when no workout since Monday; then the last 7 days are summed
zones.since: 'YYYY-MM-DD'          // first day counted
today.stepsCompare: { date, steps, delta, pct|null }   // same weekday 4 weeks ago (28 days back); delta = today's steps − steps
sleepDebt.missingRecent: 0..3      // of the last 3 nights, how many have no sleep recorded
report JSON (/api/report): summary { steps, stepGoalDays, days, workouts, trainingSeconds, distanceKm, restingHrAvg, intensityMinutes, sleepAvgMin }
```
The report text gains a sleep line: average hours over the recorded nights, or "no nights recorded" (`sleepAvgMin` null). `report.sh` also writes `~/Library/Mobile Documents/com~apple~CloudDocs/AMS Garmin/<title>.md` (the report text) and `<title>.json` (the report JSON with `summary`) next to the Apple Notes note, creating the folder if needed. AMS WorkoutCompanion reading these files is a separate release of that app.

Added in 1.4.0:
```
sleep.qualifier: 'EXCELLENT'|'GOOD'|'FAIR'|'POOR'|null   // Garmin dailySleepDTO.sleepScores.overall.qualifierKey; if missing, from score: >=90 EXCELLENT, >=80 GOOD, >=60 FAIR, else POOR; null without a score
sleep.firstNight: boolean                                // true when this night is the ONLY recorded night among the last 7 in sleepDebt.nights
lastYear: {
  year: 2025,
  month: { ym: '2025-11', throughDay: 9, available: bool,
           steps: { now, before, pct|null }, workouts: { now, before, diff },
           trainingSeconds: { now, before, pct|null }, restingHrAvg: { now, before, diff|null } },
  toDate: { available: bool, steps: { now, before, pct|null }, workouts: { now, before, diff }, trainingSeconds: { now, before, pct|null } },
  months: [ { ym: '2025-01', steps, workouts } … 12 ]
}
rhythm: { weeks: 12, since: 'YYYY-MM-DD' (today−84), until: 'YYYY-MM-DD' (yesterday),
          days: [ { dow: 1..7 (Mon=1), name: 'MON'…'SUN', avg, count, goalDays } ] (7, Monday first),
          strongest: 'SAT'|null, weakest: 'SUN'|null, overallAvg }
plan: { weekStart: 'YYYY-MM-DD', daysLeft: 0..6 (days after today until Sunday),
        items: [ { key: 'runs', label: 'RUNS', target, done, dates: ['YYYY-MM-DD'…] } ] (only items with target > 0, order runs, strength, swims, rides, hikes, walks, yoga),
        target: sum of targets, done: sum of min(done, target), complete: bool (target > 0 and done >= target) }
restingTrend: { days: 90, since: 'YYYY-MM-DD' (today−89), points: [ { date, bpm } ] (days with a resting pulse, today EXCLUDED),
                avg7: [ { date, bpm } ] (7-day trailing mean over points, 1 decimal), avg, min, max, latest: { date, bpm } | null }
hydration: { logged: bool, todayMl: n|null, goalMl: n|null (today's goalInML, else usersummary/daily hydrationGoalInML), pct: n|null,
             days: [ { date, ml, goalMl } ] (7, today last; ml 0 when nothing logged), avgMl: n|null (over days with ml > 0), lastEntryAt: iso|null }
stress: { today: { avg, max, qualifier: 'CALM'|'BALANCED'|'STRESSFUL'|'VERY STRESSFUL'|null, restSec, lowSec, mediumSec, highSec, measuredSec },
          days: [ { date, avg, max } ] (28, today last), avg28: n|null (mean of avg over days with a value, today excluded) }
```
`lastYear.available` = at least one day with data in that last-year range. `now` = this year (same month through the same day; for `toDate` 1 January through today); last year's range runs from `YYYY-1-01-01` to the same day last year (29 Feb becomes 28 Feb). `pct` as in `compare`. `rhythm` counts only days with data (`hasData`), today excluded; `avg` = rounded mean steps, `count` = days with data, `goalDays` = of those, days with the step goal met; `strongest` and `weakest` by `avg` (null when no day has data). `plan.done` counts this week's workouts (Monday to today) of the group.

### Garmin calls per board build
- `/usersummary-service/v2/dailysummaries` — from the earliest of 1 January, the 1st of the previous month, Monday of this week and today−89 (since 1.4.0; before: the earlier of 1 January and the 1st of the previous month), to today, in chunks of at most 365 days. Core call.
- `/activitylist-service/activities/search/activities` — same range, limit 99, paged.
- `/sleep-service/sleep/dailySleep` — today.
- Last 7 nights via dailySleepSummariesByDate.
- `/hrv-service/hrv/{today}`.
- Weight range, 90 days, `includeAll=true`; and the weight goal.
- Fitness age, today. Heart-rate zones. Body Battery report, today.
- `usersummary/daily`, today (`lastSyncTimestampGMT`).
- `tokenInfo()` for the expiry.
- New in 1.4.0: `/usersummary-service/stats/hydration/daily/{today−6}/{today}` (array of `{ calendarDate, valueInML, goalInML, sweatLossInML, activityIntakeInML, lastEntryTimestampLocal }`; an EMPTY array when nothing is logged, which gives `hydration.logged: false`).
- New in 1.4.0: last year, two side calls for `lastYear`: daily summaries (`/usersummary-service/v2/dailysummaries`) and activities (`/activitylist-service/activities/search/activities`) from `YYYY-1-01-01` to the same day last year.
- Stress needs no new call: today comes from `usersummary/daily`, the days from the daily summaries.
Everything except the daily summaries is a side call: a failure becomes a warning, not a failed board.

### Formulas
- Compare percent: `pct = round((now − before) / before × 100)`, or null when `before` is 0. Resting pulse uses `diff = now − before`.
- Streaks: whole days this year. Step-goal day = steps ≥ goal. Workout day = at least one activity. Today counts once the condition is met; before that, the streak runs to yesterday. `longest` with `longestEnd` (last date of the longest run).
- Training load: acute = sum of `activityTrainingLoad` over the last 7 days (today included). Chronic = sum over the last 28 days ÷ 4. Ratio = acute ÷ chronic, null when chronic is 0. Status (the board's own reading): ratio < 0.8 RECOVERY; 0.8 to 1.0 MAINTAINING; 1.0 to 1.3 PRODUCTIVE; > 1.3 OVERREACHING; NO DATA without a ratio.
- Zones: sum of `hrTimeInZone_1..5` of this week's workouts (Monday to today). Floors from the watch's heart-rate zone settings, with the maximum heart rate.
- Fitness: VO2 max from the latest run or ride that estimated it. Fitness age from Garmin (resting pulse, vigorous minutes and days, body fat).
- Sleep debt: per night, need (Garmin's sleep need, baseline 460 minutes for the owner) minus (slept + naps). `debtMin` = sum over the last 7 nights, shown at least 0. `recorded` is false when no night has data.
- Weight trend: 7-day average at each point; goal line = Garmin's weight goal.
- Alerts: `resting-hr` when the latest resting pulse ≥ 110 % of the month average; `body-battery` when the latest value < 20; `no-sync` when `lastSyncAt` is more than 24 hours old.
- Reports: see `/api/report`.
- Rhythm: for each weekday (Monday first) over the 84 days before today, `avg` = round(mean steps of the days with data), `count`, `goalDays`; `overallAvg` = mean over all those days; `strongest`/`weakest` = weekday names with the highest/lowest `avg`.
- Plan groups (type keys of activities): runs = running, treadmill_running, trail_running, indoor_running, track_running, virtual_run; strength = strength_training; swims = lap_swimming, open_water_swimming, swimming; rides = cycling, road_biking, indoor_cycling, virtual_ride, mountain_biking, gravel_cycling; hikes = hiking; walks = walking; yoga = yoga, pilates. `items` only for groups with target > 0.
- Resting trend: `avg7` at each point = mean of the resting pulses of that day and the 6 days before it that have a value (7-day trailing, one decimal); `avg`, `min`, `max` over `points`.
- Stress qualifier mapping from Garmin `stressQualifier`: CALM and CALM_AWAKE → CALM; BALANCED and BALANCED_AWAKE → BALANCED; STRESSFUL and STRESSFUL_AWAKE → STRESSFUL; VERY_STRESSFUL and VERY_STRESSFUL_AWAKE → VERY STRESSFUL; anything else → null. `measuredSec` = restSec + lowSec + mediumSec + highSec. Garmin sends −1 for "no stress value" → null.
- Notification: after every successful board build, each alert in `board.alerts` whose `key` has not yet been notified today (file `alerts-notified.json`: `{ date: 'YYYY-MM-DD', keys: [...] }`, reset when the date changes) triggers ONE call `notify({ title: 'AMS Garmin Board · Red alert', text: <alert texts joined by ' · '>, alerts: [<the new ones>] })` with all new alerts together; then the keys are recorded. No alerts, no call. Settings `notify: false` switches it off. `startBoard` rebuilds the board every 30 minutes (`watchMs`) so alerts are checked with no page open.

- Resting-pulse alert, provisional days: when today's `usersummary/daily` has `durationInMilliseconds` under 12 hours and `sleepingSeconds` is 0 (watch not worn at night, little data yet), the alert judges the last finished day's resting pulse instead of today's and says "YESTERDAY".
- Sleep debt counts only nights with sleep recorded (`sleepTimeSeconds` > 0); nights without the watch are skipped, `recorded` is false and `debtMin` null when no night counts.
- VO2 max shows "—" with a note while Garmin's Personal API delivers no `vO2MaxValue` on activities.

### Storage
Directory (injectable `storeDir`): `~/Library/Application Support/AMS Garmin MCP/board/`. Files: `settings.json` (targets, plan, notify and access code), `captains-log.json`, `travel.json`, `alerts-notified.json` (since 1.4.0: `{ date, keys }`, the alerts already notified today). Writes are atomic (temporary file, then rename). Browser: only `localStorage` key `ams-garmin-board.scheme`. Nothing of this is in the repository.

### LAN gate
- The loopback listener always runs. When an access code is set, a second listener on 0.0.0.0 (same port) accepts the home network.
- A request from a non-loopback address is allowed only with cookie `ams-board-code=<code>`. Otherwise pages redirect (302) to `/code`, and `/api/*` answers 403.
- `GET /code` is a small inline-styled page with a form. `POST /code` (form field `code`) sets the cookie (HttpOnly, SameSite=Lax, Max-Age one year) and redirects to `/`. A wrong code shows the form again with 403.
- `PUT /api/settings` is never allowed from the LAN.
- `lanAddress` in the settings answer is the Mac's home-network address with the port.
- Tests fake the remote address with `remoteAddressOf(req)`.

### Launch agents and scripts
- `scripts/install-agents.sh` installs two LaunchAgents in `~/Library/LaunchAgents/`: `com.ams.garmin.board.server.plist` (RunAtLoad and KeepAlive: starts `node board/server.js --port 7788` at login and restarts it if it stops; log `~/Library/Logs/AMS Garmin Board.log`) and `com.ams.garmin.board.report.plist` (StartCalendarInterval: Monday 07:30 and the 1st of the month 07:35, running `scripts/report.sh`). `--remove` uninstalls both.
- `scripts/report.sh`: on a Monday writes the week report, on the 1st the month report, into Apple Notes (folder "AMS Garmin", one note per report, title = report title) with `osascript`. It asks `/api/report` on 127.0.0.1:7788 (and, since 1.3.0, saves the text and JSON into iCloud Drive as described under Board JSON), starting the server first if needed (as `open-board.sh` does).
- `scripts/open-board.sh`, `scripts/build-board-app.sh`: unchanged.

### Tests
`node --test test/*.test.js`, with a fake Garmin client, injected `fetchFn`, `storeDir` (temporary folder) and `remoteAddressOf`. All test data is invented. They cover: the aggregation and every added JSON part (compare, streaks, alerts, training, zones, fitness, curve, sleep debt, weight trend, year); every route above including the 503 path, caching, the LAN gate and cookie, and 403 on settings from the LAN; the FIT decoder; `explain.js` (31 keys, title, summary, at least 3 paragraphs); and that the page carries every element id above (30 `explain-*` buttons). Added in 1.4.0 (`test/board-1.4.test.js`, each seen failing first): version 1.4.0 and the first CHANGELOG entry; `sleep.qualifier` and `firstNight`; `lastYear` with and without 2025 data; `rhythm` per weekday with today excluded; `plan` from settings (PUT then board, a negative value rejected); `restingTrend` (today excluded, `avg7` a 7-day trailing mean); `hydration` with logged data and with an empty array (`logged: false`); `stress` (qualifier mapping, −1 → null, 28 days, `avg28`); the notification called once per key per day and not when `notify` is false; `accessCode` returned on loopback only; the new element ids, the share code in `board.js` (`share-canvas`, `toBlob`), the print block in `board.css`, and the five new explain keys. `test/board-1.2.test.js` and `test/board-1.3.test.js` were updated for 31 keys, 30 buttons and a newer version. They run on every push via GitHub Actions.

### Privacy
The loopback listener serves this Mac only. The LAN listener exists only while an access code is set. Own data is stored only in the storage directory above. The repository holds no data, no keys and no coordinates of the owner; the home place in the code is a town centre.
