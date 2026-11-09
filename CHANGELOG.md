# What's new

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
