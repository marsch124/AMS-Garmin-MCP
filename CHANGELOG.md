# What's new

## 1.5.1 — 9 November 2026
A small reading fix: the "In short" text in the explanation window is now narrower and easier to read.

**Changed**
- Before: when you pressed a panel heading, the "In short" text ran across the whole window, about 724 px wide, which is roughly 90 letters per line.
- Changed: the "In short" text is now at most 60 letters wide per line, about 600 px.
- Now: its lines break earlier and are easier to read. "Learn more" is unchanged and keeps its full width.
- The version is now 1.5.1.

**Good to know**
- This is purely visual. No numbers, panels, buttons or settings changed, and your data is untouched.

## 1.5.0 — 9 November 2026
Calm & spacious: a new look for the whole board, the one you picked from three options. Nothing moves and nothing is removed. All seven colour schemes still work, and the frame (top bar, left blocks, footer) stays as it was.

**New**
- Cards: every panel now sits on its own soft card. The card is a surface slightly lighter than the background, with a fine 1-pixel edge, rounded corners (18 px) and a soft shadow. Before, panels sat flat on the background. Each colour scheme has its own card colour, edge and shadow, for example a warm lighter grey in Calm · Dusk and a very light cream in Calm · Day.
- Panel heading as a pill: the coloured cap and the label now sit together as a pill at the top left of the card.

**Changed**
- The month navigation bar is the one thing without a card.
- The long coloured line that used to stretch across the top of each panel is gone. The buttons and notes on the right of a heading stay exactly where they were.
- Bigger main numbers: the steps gauge 40 → 50, the resting-pulse dial 30 → 36, and the Body Battery and weight thermometer 22 → 28 (in drawing units, so they scale with the panel). Big figures such as calories and fitness age 34 → 52 px, the clock 56 → 68 px, the weather temperature 40 → 52 px.
- Calmer side numbers: the small groups of numbers (Min / Max / Month avg, the month totals, the small clocks) grew from 20 to 28 px and are now in the plain text colour. The eye goes first to the main number, which keeps the colour of its panel.
- Easier to read: all small words are now written in normal letters instead of CAPITALS, in the system font (San Francisco on Apple devices), and one size up: captions under numbers 11 → 13 px, notes under charts 11 → 14 px, chart axis numbers about 9 → 12 drawing units. This covers captions, notes, axis numbers, legends, the workout names in the mission log, the year-tile captions and the labels in Settings. Headings, the frame and the big numbers keep the narrow tall Antonio letters.
- Lighter dimmed text: the dimmed text colour is lighter in every colour scheme, for more contrast. For example in Calm · Dusk #b3a899 → #cdc3b5.
- Notes are now sentences, for example "No plan set · Edit to add one", "No sleep data — wear the watch at night, the night appears here in the morning", "No water logged · log it in Garmin Connect or on the watch", "Weakest Monday · 7 491 a day · strongest Saturday · 13 117 · all days 9 774".
- The comparison under the steps gauge is now a plain line of text instead of a pill, for example "▼ −820 (−19 %) Mon 12 Oct · 4 228".
- More air: the gap between panels grew from 10 to 20 px vertically and is 18 px horizontally. The padding inside each card is 14 to 16 px instead of 6 px. The year tiles have more padding and their value is 22 px.
- The version is now 1.5.0.

**Fixed**
- Nothing was fixed in this version.

**Good to know**
- Only the look changed. No numbers, panels, buttons or settings were added, moved or removed, and your data is untouched.
- The colour scheme switcher in the footer still offers Calm · Dusk, Dark, Day, Ice, Ember, Forest and Graphite.

**Quality**
- New automatic tests check the new look by names: the version, the card, edge and shadow colours in every scheme, the card and pill rules, the lighter dimmed colour, the text classes of the drawings, the sentence notes and the steps comparison line. They run on every push to GitHub.

## 1.4.0 — 9 November 2026
Nine new things on the board: a look at last night, last year, your weekly rhythm and plan, resting pulse, water and stress, a Mac alert, a card to share, and printing.

**New**
- Last night strip: at the top of the sleep panel, one line such as "LAST NIGHT · BED 23:10 · UP 06:45 · GOOD". The word is Garmin's own: EXCELLENT (90 to 100), GOOD (80 to 89), FAIR (60 to 79) or POOR (under 60). When the watch has recorded only this one night out of the last seven, it says "FIRST NIGHT WITH THE WATCH · WELL DONE" instead, with the same bed and up times. With no sleep recorded the strip stays hidden and the usual NO SLEEP DATA note stays.
- Same time last year: in the year panel, a line compares this month up to today's date with the same days last year (steps, workouts, training time, each with an arrow and a percent), and the year so far with the same days of last year. For example "SAME TIME LAST YEAR · NOVEMBER 2025 TO DAY 9 · STEPS 61 200 → 68 500 (▲ +12 %) · WORKOUTS 4 → 4 (=)". Every month tile also gets a faint bar and a small line for the same month last year, such as "2025 · 48 200". Without data from last year the line says "NO DATA FOR NOVEMBER 2025" and the tiles show "—".
- Weekly rhythm: a new panel with seven bars, Monday to Sunday, showing your average steps per weekday over the last 12 weeks. Only finished days with data count. The weakest day is red, the strongest green, and your overall average is a dashed line. A note says it in words, for example "WEAKEST SUNDAY · 6 100 A DAY · STRONGEST SATURDAY · 12 400".
- This week's plan: a new panel with your own weekly workout plan and a tick for each workout done since Monday, for example ●●○ for 2 of 3 runs. You set the numbers in Settings for runs, strength, swims, rides, hikes, walks and yoga (0 means not in the plan). The note reads "3 OF 5 DONE · 4 DAYS LEFT", "ALL DONE · 2 DAYS LEFT", or "NO PLAN SET · EDIT TO ADD ONE". An EDIT button opens Settings. Running includes treadmill and trail runs, rides include indoor and mountain biking, swims include open water, and yoga includes Pilates.
- Resting pulse over 90 days: a new panel with a dot for each finished day, a 7-day average line and your 90-day average dashed, with month marks like the weight chart. The note reads "AVG 51 · 46–58 · LATEST 48 ON 8 NOV", or "NO PULSE DATA YET".
- Stress: a new panel with today's word from Garmin (CALM, BALANCED, STRESSFUL or VERY STRESSFUL), a bar that splits the day into rest, low, medium and high stress with the hours, and 28 small bars of the daily average with the 4-week average dashed. The note reads "TODAY 23 · 4-WEEK AVG 27". The stress bar in the heart panel stays as it was.
- Water: a new panel with a round gauge for the litres logged today against your goal (for example 1,2 LITRES), seven small bars for the last week, and a note such as "GOAL 2,5 L · 7-DAY AVG 1,8 L".
- Mac notification on red alert: when an alert fires for the first time, the Mac shows a notification, even with no board page open, with the title "AMS Garmin Board · Red alert" and the alert texts. You get one notification per alert per day. A switch in Settings turns it off.
- Share and print: a new SHARE button at the bottom (key S) draws a card for the day as a picture: steps with goal, resting pulse, Body Battery, sleep, intensity minutes, workouts and training time this month, weight, small bars of the month's steps, your Captain's log line of the day, and the board version and stardate. SAVE PNG saves it on the Mac, and on the iPhone a SHARE… button hands it to Messages, Mail and the like. Press ⌘P to print the board on white paper, without the buttons.
- Access code shown: on the Mac, Settings now shows the current code ("CURRENT CODE · 482913") so you can read it when you type it on the phone.

**Changed**
- The version is now 1.4.0.
- Settings on the Mac now show the current access code. From the home network the code is never shown.
- The board now checks for red alerts every 30 minutes by itself, also when no page is open. That is what makes the Mac notification work.
- The daily summaries now reach 90 days back, so the resting pulse trend has its 90 days even in January and February.
- The sleep, year, targets and red alert explanations have a new paragraph, and there are five new explanations: weekly rhythm, this week's plan, resting pulse over 90 days, water and stress. There are now 30 headings you can press.
- If the board gets a new version while the page is open, the page reloads by itself.

**Good to know**
- Water shows "NO WATER LOGGED" until you log water in Garmin Connect or on the watch. The board cannot see what you drink by itself.
- The last-year line needs data from 2025. Where the watch recorded nothing, it says so, and the faint bars stay empty.
- The first time a Mac notification is due, the Mac may ask to allow notifications for Script Editor. Say yes, or you get none.
- The picture card uses the colour look you have chosen.
- To print, press ⌘P. The buttons and sheets are left out and the colours are made for white paper.
- The plan, the notification switch and the code live only on this Mac, like the targets.
- The explanations are general information. For health questions, ask a doctor.

**Quality**
- New automatic tests check the new parts by their names, and each was seen failing before the code was written: the sleep strip words, the last-year numbers with and without data, the weekly rhythm, the plan and its sums, the 90-day resting pulse, water with and without logged drinks, stress and its words, the notification once per alert per day, the code shown on the Mac only, and every new element on the page. They run on every push to GitHub.

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
