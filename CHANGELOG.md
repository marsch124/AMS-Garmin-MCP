# What's new

## 1.3.0 — 9 November 2026
Small helpers that make the board more useful on a quiet week, and reports that can travel to your iPhone.

**New**
- Steps compared with four weeks ago: a small chip beside the steps gauge shows today's steps against the same weekday four weeks back, for example "▲ +1 240 · MON 12 OCT". A green-ish up arrow means more steps, a red-ish down arrow fewer. It shows "—" when there is no data for that day.
- The Monday and month reports now also carry a short set of numbers: steps, step-goal days, workouts, training time, distance, resting pulse, intensity minutes and the sleep average. They are stored in a form other apps can read.
- Reports in iCloud Drive: besides Apple Notes, every report is now also saved as a text file and a data file in iCloud Drive, in the folder "AMS Garmin". On the iPhone you find them in the Files app.
- A sleep line in the report text: the average hours slept over the nights that were recorded, or "no nights recorded".
- Sleep nudge: when the last three nights have no sleep recorded, the sleep-debt panel says "WEAR THE WATCH TONIGHT · 3 EMPTY NIGHTS" and the sleep panel shows a small note.

**Changed**
- Heart-rate zones: when the new week has no workout yet (for example on a Monday morning), the panel now shows the last 7 days instead of an empty bar, and says so in the heading note: "LAST 7 DAYS · NO WORKOUT YET THIS WEEK". The label under the total then reads "IN ZONES · LAST 7 DAYS".
- The version is now 1.3.0.
- If the board gets a new version while the page is open, the page reloads by itself.

**Good to know**
- AMS WorkoutCompanion cannot read the report files yet. It needs its own small update to do that, which will be a separate release of that app. Until then you can open the files in the Files app.
- The iCloud Drive files are written by the same install step as the Notes reports (Monday morning and the 1st of the month).
- Sleep notes fill again as soon as the watch is worn at night.

**Quality**
- New automatic tests check the new parts by their names: the zones note and label, the steps chip, the sleep nudge, the report numbers and the files in iCloud Drive.

## 1.2.0 — 9 November 2026
The board grows up: calmer colours, an explanation behind every heading, and much more to look at.

**New**
- A calmer look. The board is now soft orange, peach, lavender and red on a warm mid-grey background, not black. There is a colour switcher at the bottom with seven looks: Calm Dusk (the new standard), Calm Dark, Calm Day, Ice, Ember, Forest and Graphite. It remembers your choice on this Mac.
- Press any heading to learn what it means. A small window opens with the answer in short, and below it the full story: what the measure is, how it is worked out, what good values look like for a man of 60, and what to watch out for. Escape closes it.
- Compared with last month: every total in the month panel now has an arrow and a percent or difference against last month up to the same day. Steps, distance, floors, intensity minutes, resting pulse, workouts and training time.
- Streaks: how many days in a row you reached your step goal and did a workout, and your longest run this year.
- Red alert: a red bar at the top when your resting pulse is 10 percent above the month average, your Body Battery is under 20, or the watch has not synced for 24 hours. It stays hidden when all is well.
- Training load: the last 7 days against your usual week, with a word for it: RECOVERY, MAINTAINING, PRODUCTIVE or OVERREACHING.
- Heart-rate zones this week: a bar showing how long your workouts since Monday kept you in each of the five zones.
- VO2 max and fitness age, side by side with your real age, each with an arrow for the trend.
- Body Battery for today as a line from midnight, with sleep and workouts shaded.
- Press a workout in the list to open it: kilometre splits, a heart-rate curve and, when the watch had GPS, the route on a map.
- Weather and sunrise and sunset, from the internet, for the place of your latest workout, or home, or where your browser says you are. The next 12 hours at a glance.
- Travel mode: away from home, the clock panel shows how many days you have been away, how far, and the time zone.
- Your own monthly targets for steps, workouts, swims, runs, training minutes and distance, each with a progress bar. Set them in Settings.
- Captain's log: one line a day to remember how it felt. This month's lines are listed below.
- Weight trend over 90 days: dots for each weigh-in, a 7-day average line, and your goal line from Garmin.
- Sleep debt: how many hours of sleep you owe over the last 7 nights, with a small chart of each night.
- Month arrows to look back at earlier months, with a button to jump back to this month. A year view with twelve tiles shows steps, workouts, resting pulse and goal days for every month.
- Full screen (kiosk) mode for a spare screen: the cursor hides when still, and the board dims between 21:00 and 07:00.
- iPhone and iPad on your home Wi-Fi, behind a code. Set the code in Settings, then type the address shown there on the phone and enter the code once.
- Monday report and month report: a plain-words summary of the last week, or the last month, written into Apple Notes by itself. You can also read it any time with the REPORT button.
- Polish: a ? help button with How it works and What's new, the keys R (refresh), F (full screen), the left and right arrows (month), ? (help) and Escape (close), the version number in the footer, and auto-start at login so the page opens instantly.

**Changed**
- The Desktop launcher is now called **AMS Garmin Bridge Board** (type that in Raycast); the old "AMS Garmin Board" app and alias were replaced.
- The red alert for a high resting pulse waits for a real reading: early on a day without a recorded night it judges yesterday's finished value instead of the provisional morning number.
- The version is now 1.2.0.
- The board is no longer black by default. Black is still there as Calm Dark.
- The board answers on the home network only when you set a code. Without a code, it works on this Mac only, as before.
- If the board gets a new version while the page is open, the page reloads by itself.

**Good to know**
- Sleep debt, sleep and HRV fill once the watch is worn at night.
- The training-load words are the board's own reading of Garmin's workout loads, not Garmin's own verdict. They are a rule of thumb, not medical advice.
- Weather needs the internet. Without it, that panel stays empty and the rest works.
- The Captain's log, your targets, the code and the travel note live only on this Mac. They are never sent to Garmin or to GitHub.
- The explanations are general information. For health questions, ask a doctor.

**Quality**
- New automatic tests check every new part by its name: the colour switcher, the explanations, the streaks, the red alert, the training load, the zones, the weather, the log, the targets, the month arrows, the workout detail, the reports and the home-network code. They run on every push to GitHub.

## 1.1.0 — 9 November 2026
The AMS Garmin Board: your Garmin data on a Star Trek style instrument screen.

**New**
- A board that shows your data live in your browser: black background, rounded orange, lavender and blue bars, tall capital letters.
- Open it by double-clicking **AMS Garmin Board** on your Desktop, or by typing the name in Raycast. If it is not running yet, it wakes up by itself and then opens the page.
- Clocks: local time with seconds, world time (UTC), the date, the week number and a playful stardate.
- Today: steps as a round gauge against your goal, distance, floors climbed, calories (total and active), resting, lowest and highest heart rate on a dial, stress as a bar, Body Battery as an upright bar (latest, lowest and highest today), and this week's intensity minutes as a gauge against your weekly goal (Garmin counts hard minutes double).
- This month: a bar for each day's steps with the goal marked, a line of resting heart rate per day, and totals: steps, average steps per day, days you reached your goal, floors, distance, intensity minutes, and average, lowest and highest resting heart rate over the finished days.
- Workouts this month: how many, total time, distance, calories and climbing, and the list newest first with type, name, time, distance, heart rate and training effect.
- Sleep last night: hours, score, deep, light, REM and awake time. When Garmin has no sleep data, a clear reminder shows: NO SLEEP DATA, WEAR THE WATCH AT NIGHT.
- HRV last night: average, weekly average and status, or NO HRV DATA.
- Weight: your last weigh-in, its date and the change, on a thermometer-style scale.
- Link status: green when Garmin answers, red with the reason when not, when your key expires, the time of the last refresh, and a REFRESH button.
- The board refreshes its data by itself every 10 minutes; the clocks tick every second.
- If only one small part (sleep, HRV, weight or workouts) cannot be fetched, the rest of the board still works and that part shows as empty.
- The board has its own icon, a heart, on the Desktop and in Applications.

**Changed**
- The version is now 1.1.0. Claude's connection to Garmin works exactly as before.

**Good to know**
- The board is dark by design, day and night.
- Sleep and HRV appear once the watch is worn at night.
- The first open can take a few seconds while the board wakes up.
- It only works on this Mac; nothing is stored, and the repository holds no data.

**Quality**
- New automatic tests check the board's numbers, its pages, its short-term memory (5 minutes), the error case, and that every part of the page can be found by its name. They run on every push to GitHub.

## 1.0.0 — 9 November 2026
The first version. Claude can now read your own Garmin Connect data.

**What it can do**
- Check that your key works and show your Garmin profile and settings.
- List your activities (by date, type such as running, cycling, strength training, walking or swimming, or a search word), open one activity in detail with its exercise sets, and download the original file of an activity.
- Show one day or many days of summaries: steps, distance, calories, floors, intensity minutes, heart rate, stress, Body Battery, SpO2, breathing, hydration and goals.
- Sleep, for one night or a range of dates.
- Heart rate for a day, HRV, stress, steps, Body Battery, SpO2 and hydration.
- Weight over a period, with your weight goal if you want it.
- Fitness age, heart-rate zones, nutrition log, activities recorded by your watch during the day, and women's health.
- A back door for reading any other of the 26 data pages Garmin offers.
- Long periods are fetched in pieces automatically, so you can simply ask for "this year".
- Answers are tidied up: empty fields and huge minute-by-minute lists are left out unless you ask for them.

**How the key is saved**
- A small dialog on the Mac asks for your key once and keeps it in a file only you can read.
- The key never goes into the chat or into GitHub.
- A 24-hour access token is cached next to it; when it runs out, a new one is fetched on its own.
- Clear plain-words messages if the key is missing, rejected, or Garmin says "slow down" or "no data".

**Safe by design**
- Read-only: nothing is ever written to Garmin.
- Your data goes from Garmin straight to Claude on this Mac; nothing is stored in the repository.

**Quality**
- Automatic tests check every tool by its name, and they run on every push to GitHub.
