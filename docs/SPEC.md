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
- `scripts/open-board.sh`, `scripts/build-board-app.sh` — launcher and app builder for "AMS Garmin Board".
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
"AMS Garmin Board": an LCARS-inspired instrument board (black background, rounded orange/lavender/blue bars, condensed uppercase lettering) showing the owner's Garmin data live in the browser. Read-only; nothing is stored.

### Files
- `board/board-data.js` — `buildBoard(client, { today, now })` returns one JSON object. Uses the existing `GarminClient`.
- `board/server.js` — HTTP server on Node's built-in `http` module, no new dependencies. Binds `127.0.0.1` only, default port 7788; CLI: `node board/server.js --port N`.
- `board/public/index.html`, `board.css`, `board.js` — the page. Fonts from Google Fonts "Antonio" with a system condensed fallback.
- `scripts/open-board.sh` — if `/api/health` does not answer, starts the server; waits up to 5 s; then `open http://127.0.0.1:7788/`. Logs to `~/Library/Logs/AMS Garmin Board.log`.
- `scripts/build-board-app.sh` — builds `~/Applications/AMS Garmin Board.app` with `osacompile`: bundle id `com.ams.garmin.board`, `LSUIElement` true, icon = the "heart" app-icon tile from the AMS Icon Library converted to `applet.icns`, `Assets.car` removed and `CFBundleIconName` deleted so the custom icon shows, `xattr -cr`, then ad-hoc `codesign`. Then a Finder alias on the Desktop named "AMS Garmin Board". Raycast finds the app by name.

### Routes
- `GET /` — `index.html`.
- `GET /api/board` — JSON; cached 5 minutes; `?refresh=1` bypasses the cache.
- `GET /api/health` — `{ ok: true, version }`.
- Other static files from `board/public`; unknown paths: 404.
- Errors from Garmin for the core data: HTTP 503 `{ ok: false, error: "plain words" }`. Errors for a side panel (sleep, HRV, weight, activities) do not fail the board: that part is reported as not recorded / empty and the error text is added to `warnings`.

### Garmin calls per board build
- `/usersummary-service/v2/dailysummaries` — startDate = the earlier of the 1st of the month and the Monday of the current week; endDate = today.
- `/activitylist-service/activities/search/activities` — 1st of month to today, limit 99.
- `/sleep-service/sleep/dailySleep` — date = today.
- `/hrv-service/hrv/{today}`.
- `/weight-service/weight/range/{today-60 days}/{today}`.
- `tokenInfo()` for the expiry.

### JSON shape
```
{ ok, version, generatedAt, date (today, YYYY-MM-DD), monthStart, weekStart,
  link: { ok, tokenExpiresAt },
  today: { date, steps, stepGoal, distanceM, floorsUp, floorsGoal,
           caloriesTotal, caloriesActive, caloriesResting,
           restingHr, minHr, maxHr, stressAvg, stressMax,
           bodyBattery: { latest, min, max, charged, drained },
           intensityModerate, intensityVigorous, intensityWeeklyGoal,
           respirationAvg },
  month: { days: [ same per-day fields ],
           steps, avgSteps, stepGoalDays, daysWithData, distanceM,
           floorsUp, intensityMinutes,
           restingHrAvg, restingHrMin, restingHrMax },   // finished days only, today excluded
  week: { start, intensityMinutes, goal },
  activities: { count, seconds, distanceM, calories, elevationGain,
                byType: { <type>: { count, seconds, distanceM } },
                list: [ { id, name, type, start, seconds, distanceM, calories,
                          avgHr, maxHr, elevationGain, trainingEffect,
                          aerobic, anaerobic, load } ] },
  sleep: { recorded: false } | { recorded: true, seconds, score, deepSeconds,
           lightSeconds, remSeconds, awakeSeconds, start, end },
  hrv:   { recorded: false } | { recorded: true, lastNight, weeklyAvg, status,
           baselineLow, baselineHigh },
  weight: null | { kg, date, deltaKg },
  warnings: [string] }
```
- Intensity minutes = moderate + 2 x vigorous.
- Stress -1 from Garmin means unknown and becomes null.
- Weight comes from Garmin in grams and is shown in kg with one decimal.

### Page
- Clocks tick every second; data refreshes every 10 minutes and on the REFRESH button (`?refresh=1`).
- No sleep: "NO SLEEP DATA — WEAR THE WATCH AT NIGHT"; no HRV: "NO HRV DATA". Dark by design in day and night.
- Element ids (tests find things by them): `board`, `clock-local`, `clock-utc`, `clock-date`, `stardate` (year.dayOfYear, e.g. 2026.313), `steps-gauge`, `steps-value`, `body-battery-bar`, `resting-hr`, `stress-bar`, `intensity-gauge`, `floors-value`, `calories-value`, `month-steps-chart`, `month-hr-chart`, `activities-list`, `activities-total`, `sleep-panel`, `hrv-panel`, `weight-thermo`, `link-status`, `last-refresh`, `refresh-button`.

### Tests
`test/board.test.js` (`node --test`, fake Garmin client) covers the aggregation, the routes, caching, the 503 path and that the page carries every id above. They run with the others on every push via GitHub Actions.

### Privacy
The server listens on `127.0.0.1` only. Nothing is written to disk except the log line when the server starts. The repository holds no data.
