# AMS Garmin MCP — Specification (1.1.0, 9 Nov 2026)

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
"AMS Garmin Board" 1.2.0: an LCARS-inspired instrument board (calm colours on a mid-grey background, rounded bars, condensed uppercase lettering) showing the owner's Garmin data live in the browser. Read-only towards Garmin. Own data (settings, Captain's log, travel note) is stored only on the owner's Mac, outside the repository. Plain JavaScript, Node 20 or newer, no dependencies, no build step.

### Files
- `board/board-data.js` — `buildBoard(client, { today, now, settings, log, travel })` returns one JSON object. Uses `GarminClient`.
- `board/server.js` — HTTP server on Node's built-in `http`. `createBoardServer({ client, now, cacheMs, today, storeDir, fetchFn, remoteAddressOf, homeZone })`. CLI: `node board/server.js --port N` (default 7788).
- `board/fit.js` — own tiny FIT decoder: file header, definition and data messages, little and big endian, record (20) and lap (19) messages; developer fields skipped; CRC not checked.
- `board/store.js` — atomic JSON files (temporary file, then rename).
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

Every panel heading is a `<button type="button" class="label" id="explain-<key>">`. The 26 keys: chrono, steps, body-battery, heart, intensity, energy, bb-curve, fitness, sleep, hrv, sleep-debt, weight, training, zones, streaks, weather, targets, log, month-steps, month-hr, activities, month-totals, activity-detail, year, red-alert, link. The key `link` has no button on the page (the footer status gets none); it is used by the help texts only, so the page carries 25 `explain-*` buttons.

Panels in order inside `<main class="panels">` (12-column grid, sN = span N):
1. `red-alert` (s12, `hidden` unless alerts): `red-alert-text`.
2. `chrono-panel` (s3): clocks, `sunrise-value`, `sunset-value`, `travel-row` (hidden at home) with `travel-days`, `travel-km`, `travel-zone`.
3. `steps-panel` (s3). 4. `body-battery-panel` (s2). 5. `heart-panel` (s4).
6. `intensity-panel` (s3). 7. `energy-panel` (s2).
8. `bb-curve-panel` (s4): `bb-curve-chart` (today's line; sleep and workout spans shaded).
9. `fitness-panel` (s3): `vo2max-value`, `vo2max-trend`, `fitness-age-value`, `fitness-age-trend`, `chrono-age-value`.
10. `sleep-panel` (s3). 11. `hrv-panel` (s2).
12. `sleep-debt-panel` (s3): `sleep-debt-value`, `sleep-debt-chart`, `sleep-debt-note`.
13. `weight-panel` (s4): `weight-thermo`, `weight-trend-chart` (90 days, dots, 7-day average line, goal line), `weight-date`, `weight-delta`, `weight-goal`.
14. `training-panel` (s3): `training-load-bar`, `training-acute`, `training-chronic`, `training-ratio`, `training-status`.
15. `zones-panel` (s3): `zones-chart` (stacked bar, five zones), `zones-total`.
16. `streaks-panel` (s3): `streak-steps-current`, `streak-steps-longest`, `streak-workout-current`, `streak-workout-longest`.
17. `weather-panel` (s3): `weather-place`, `weather-temp`, `weather-text`, `weather-wind`, `weather-rain`, `weather-hours`, `weather-locate-button`.
18. `targets-panel` (s4): `targets-list` with `target-bar-steps`, `target-bar-workouts`, `target-bar-swims`, `target-bar-runs`, `target-bar-training-minutes`, `target-bar-distance-km`; `targets-edit-button`.
19. `log-panel` (s8, CAPTAIN'S LOG): `log-today-input` (one line, max 200 characters), `log-save-button`, `log-list` (this month's lines, newest first, each `log-line-YYYY-MM-DD`).
20. `month-nav` (s12): `month-prev`, `month-label` (e.g. "NOVEMBER 2026 · SO FAR"), `month-next` (disabled on the current month), `month-today` (hidden on the current month).
21. `month-steps-panel` (s7). 22. `month-hr-panel` (s5). 23. `activities-panel` (s8). 24. `month-totals-panel` (s4): delta cells `delta-steps`, `delta-distance`, `delta-floors`, `delta-intensity`, `delta-resting-hr`, `delta-workouts`, `delta-training-time` (arrow ▲ or ▼ with percent or difference against the previous month to the same day).
25. `activity-detail-panel` (s12, hidden until a workout row is pressed): `detail-title`, `detail-summary`, `detail-splits`, `detail-hr-chart`, `detail-map`, `detail-close`. Workout rows: `class="act"`, `id="act-<activityId>"`, `data-id`.
26. `year-panel` (s12): `year-tiles` with `year-tile-01` … `year-tile-12` (steps, workouts, resting pulse, goal days; future months dimmed).

Footer bar: `palette-select`, `kiosk-button`, `help-button`, `report-button`, `settings-button`, `footer-version` ("1.2.0"), plus the link status and refresh controls.

Sheets (overlays, `hidden` by default; Escape closes = Cancel; the main button is full colour):
- `explain-sheet`: `explain-title`, `explain-summary` (IN SHORT), `explain-more` (LEARN MORE), `explain-close`.
- `help-sheet`: `help-tab-how`, `help-tab-new`, `help-content`, `help-close`. Content from `/api/docs`.
- `settings-sheet`: `target-steps`, `target-workouts`, `target-swims`, `target-runs`, `target-training-minutes`, `target-distance-km`, `access-code`, `lan-address` (read-only text), `settings-cancel`, `settings-save`.
- `report-sheet`: `report-title`, `report-text`, `report-close`, `report-kind-week`, `report-kind-month`.

Behaviour:
- Clocks tick every second; data refreshes every 10 minutes and on REFRESH (`?refresh=1`).
- No sleep: "NO SLEEP DATA — WEAR THE WATCH AT NIGHT"; no HRV: "NO HRV DATA"; sleep debt with `recorded: false` shows a similar note.
- Keyboard: R refresh, F kiosk, ← and → previous and next month, ? help, Escape closes any sheet.
- Kiosk: body class `kiosk`. Between 21:00 and 07:00 local time the body also gets class `night` (dimmed with a CSS filter). In kiosk the cursor hides after 5 s without movement.
- The page reloads itself when `/api/board` reports a different version than the one first loaded.
- Stardate: year.dayOfYear (e.g. 2026.313).

### explain.js format
Plain script, no import or export. Sets `globalThis.AMS_EXPLAIN = { <key>: { title, summary, more } }` for all 26 keys above. `title`: uppercase short title. `summary`: one or two sentences, shown under IN SHORT. `more`: array of 3 to 6 paragraphs, shown under LEARN MORE. The page opens `explain-sheet` from the button whose id is `explain-<key>`. Loadable in Node with `import()` (the tests do this).

### Routes
Loopback listener on 127.0.0.1 always; see "LAN gate" for the second listener.
- `GET /` — `index.html`. Other static files from `board/public`; unknown paths 404.
- `GET /api/health` — `{ ok: true, version }`.
- `GET /api/board` — board JSON; cached 5 minutes; `?refresh=1` bypasses the cache. Garmin errors for the core data: HTTP 503 `{ ok: false, error }` in plain words. Side-call failures do not fail the board: the part is empty and the text is added to `warnings`.
- `GET /api/month?ym=YYYY-MM` — `{ ok, ym, month, activities, compare, log }`, same shapes as in the board JSON. Past months cached 24 h; the current month is the board's own data.
- `GET /api/activity/<id>` — `{ ok, id, name, type, start, seconds, distanceM, calories, avgHr, maxHr, elevationGain, splits: [{ index, seconds, distanceM, avgHr, maxHr, ascentM }], hr: [[secondsFromStart, bpm]] (at most 600 points), trace: [[lat, lon]] (at most 1500), altitude: [[secondsFromStart, m]] (at most 600) }`. Built from Garmin `/activity-service/activity/<id>` and the original file `/download-service/files/activity/<id>` (a zip holding a .FIT), parsed by `board/fit.js`. Cached in memory per id. No GPS: `trace: []`.
- `GET /api/weather?lat=&lon=` — `{ ok, place: { lat, lon, source: 'browser' | 'workout' | 'home', name }, now: { tempC, windKmh, precipMm, code, text }, hours: [{ time, tempC, rainPct, windKmh, code }] (next 12), sun: { sunrise, sunset } }`. Via Open-Meteo `https://api.open-meteo.com/v1/forecast` with `timezone=auto`; cached 15 minutes per rounded place. Without lat and lon: the latest workout with coordinates in the last 10 days, else home (Norrköping). `fetchFn` is injectable. WMO code to text: 0 CLEAR, 1 MAINLY CLEAR, 2 PARTLY CLOUDY, 3 OVERCAST, 45 and 48 FOG, 51–57 DRIZZLE, 61–67 RAIN, 71–77 SNOW, 80–82 SHOWERS, 95–99 THUNDERSTORM.
- `GET /api/settings` — `{ ok, settings: { targets: { steps, workouts, swims, runs, trainingMinutes, distanceKm }, hasAccessCode, lanAddress } }`.
- `PUT /api/settings` — JSON body with `targets` and/or `accessCode` (`""` clears). Same answer as GET. Only from loopback, else 403.
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

### Garmin calls per board build
- `/usersummary-service/v2/dailysummaries` — from the earlier of 1 January and the 1st of the previous month, to today, in chunks of at most 365 days. Core call.
- `/activitylist-service/activities/search/activities` — same range, limit 99, paged.
- `/sleep-service/sleep/dailySleep` — today.
- Last 7 nights via dailySleepSummariesByDate.
- `/hrv-service/hrv/{today}`.
- Weight range, 90 days, `includeAll=true`; and the weight goal.
- Fitness age, today. Heart-rate zones. Body Battery report, today.
- `usersummary/daily`, today (`lastSyncTimestampGMT`).
- `tokenInfo()` for the expiry.
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

- Resting-pulse alert, provisional days: when today's `usersummary/daily` has `durationInMilliseconds` under 12 hours and `sleepingSeconds` is 0 (watch not worn at night, little data yet), the alert judges the last finished day's resting pulse instead of today's and says "YESTERDAY".
- Sleep debt counts only nights with sleep recorded (`sleepTimeSeconds` > 0); nights without the watch are skipped, `recorded` is false and `debtMin` null when no night counts.
- VO2 max shows "—" with a note while Garmin's Personal API delivers no `vO2MaxValue` on activities.

### Storage
Directory (injectable `storeDir`): `~/Library/Application Support/AMS Garmin MCP/board/`. Files: `settings.json` (targets and access code), `captains-log.json`, `travel.json`. Writes are atomic (temporary file, then rename). Browser: only `localStorage` key `ams-garmin-board.scheme`. Nothing of this is in the repository.

### LAN gate
- The loopback listener always runs. When an access code is set, a second listener on 0.0.0.0 (same port) accepts the home network.
- A request from a non-loopback address is allowed only with cookie `ams-board-code=<code>`. Otherwise pages redirect (302) to `/code`, and `/api/*` answers 403.
- `GET /code` is a small inline-styled page with a form. `POST /code` (form field `code`) sets the cookie (HttpOnly, SameSite=Lax, Max-Age one year) and redirects to `/`. A wrong code shows the form again with 403.
- `PUT /api/settings` is never allowed from the LAN.
- `lanAddress` in the settings answer is the Mac's home-network address with the port.
- Tests fake the remote address with `remoteAddressOf(req)`.

### Launch agents and scripts
- `scripts/install-agents.sh` installs two LaunchAgents in `~/Library/LaunchAgents/`: `com.ams.garmin.board.server.plist` (RunAtLoad and KeepAlive: starts `node board/server.js --port 7788` at login and restarts it if it stops; log `~/Library/Logs/AMS Garmin Board.log`) and `com.ams.garmin.board.report.plist` (StartCalendarInterval: Monday 07:30 and the 1st of the month 07:35, running `scripts/report.sh`). `--remove` uninstalls both.
- `scripts/report.sh`: on a Monday writes the week report, on the 1st the month report, into Apple Notes (folder "AMS Garmin", one note per report, title = report title) with `osascript`. It asks `/api/report` on 127.0.0.1:7788, starting the server first if needed (as `open-board.sh` does).
- `scripts/open-board.sh`, `scripts/build-board-app.sh`: unchanged.

### Tests
`node --test test/*.test.js`, with a fake Garmin client, injected `fetchFn`, `storeDir` (temporary folder) and `remoteAddressOf`. All test data is invented. They cover: the aggregation and every added JSON part (compare, streaks, alerts, training, zones, fitness, curve, sleep debt, weight trend, year); every route above including the 503 path, caching, the LAN gate and cookie, and 403 on settings from the LAN; the FIT decoder; `explain.js` (26 keys, title, summary, at least 3 paragraphs); and that the page carries every element id above. They run on every push via GitHub Actions.

### Privacy
The loopback listener serves this Mac only. The LAN listener exists only while an access code is set. Own data is stored only in the storage directory above. The repository holds no data, no keys and no coordinates of the owner; the home place in the code is a town centre.
