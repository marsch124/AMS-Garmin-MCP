# AMS Garmin

## What this is
AMS Garmin lets Claude read your own Garmin Connect workouts and health data, using Garmin's official Personal API. You ask in plain words ("how did I sleep last night?") and Claude fetches the answer from Garmin. It only reads. Nothing is ever written to Garmin.

## The board
The board is a live instrument panel for your Garmin data, in the style of a Star Trek control screen: soft orange, peach, lavender and red bars on a warm grey background. Since 1.5.0 the look is calm and spacious: every panel sits on its own soft card with rounded corners, the main numbers are bigger, and the small words (captions, notes, chart numbers) are written in normal letters that are easier to read. Headings and big numbers keep the tall capital letters. It opens in your normal browser.

**How to open it**
- Double-click **AMS Garmin Bridge Board** on your Desktop, or type "AMS Garmin Bridge Board" in Raycast.
- After you run the install step once, the board starts by itself when you log in, so the page opens instantly. Without that, the first open after a restart can take a few seconds.

**What it shows**
- Red alert: a red bar at the top, only when needed: resting pulse 10 percent above the month average, Body Battery under 20, or no watch sync for 24 hours.
- Clocks: local time, world time (UTC), the date, the week number, a playful stardate, and sunrise and sunset. Away from home, a travel line shows days away, distance and time zone.
- Steps today against your goal, with a small chip comparing today with the same weekday four weeks ago (▲ or ▼ and the difference; "—" when there is no data), distance, floors, calories, resting, lowest and highest heart rate, stress, and Body Battery.
- Intensity minutes this week against your goal. Hard minutes count double.
- Body Battery today as a line, with sleep and workouts shaded. Since 1.9.0 each of today's workouts also has a marker: a dashed line at its start and a label such as "Run −17" (the Body Battery it cost). Press the marker to open the workout's details.
- Fitness: VO2 max and fitness age next to your real age, with trend arrows.
- Sleep and HRV from last night, with a LAST NIGHT strip (bed time, up time and Garmin's word: EXCELLENT, GOOD, FAIR or POOR), and sleep debt over the last 7 nights. If the watch has no sleep data, the board says so: wear the watch at night. After three empty nights in a row, the sleep-debt panel says "WEAR THE WATCH TONIGHT · 3 EMPTY NIGHTS" and the sleep panel shows a small note.
- Weight: your last weigh-in, plus 90 days of dots, a 7-day average and your goal line.
- Training load: the last 7 days against your usual week, with one word: RECOVERY, MAINTAINING, PRODUCTIVE or OVERREACHING.
- Heart-rate zones this week, from Monday. When the week has no workout yet, the panel shows the last 7 days instead and says so ("LAST 7 DAYS · NO WORKOUT YET THIS WEEK").
- Streaks: days in a row at your step goal and with a workout, and the longest this year.
- Weather for the next 12 hours.
- Targets: your own monthly goals with progress bars.
- This week's plan: your own weekly workout plan (runs, strength, swims, rides, hikes, walks, yoga) with a tick for each workout done since Monday and the days left.
- Captain's log: one line a day.
- Weekly rhythm: your average steps for each weekday over 12 weeks, with the weakest and strongest day marked.
- Resting pulse over 90 days: a dot per day, a 7-day average line and the 90-day average.
- Stress: today's word from Garmin, how the day divides into rest and stress, and 4 weeks of daily averages.
- Water: litres logged today against your goal, and the last 7 days. It says "no water logged" until you log water in Garmin Connect or on the watch.
- This month: a bar for every day's steps, a line for resting pulse, and the totals with an arrow against last month up to the same day.
- Workouts panel (top right, next to Body Battery, new in 1.8.0): a switch with TODAY, YESTERDAY and 7 DAYS (the last seven days, today included). A line under it gives the number of workouts, the total time, the distance and the calories. Below are the workouts, newest first, each with type, day and time, name, duration and distance. Press a row to see splits, heart-rate curve and a map of the route. With nothing to show it says "No workouts today", "No workouts yesterday" or "No workouts in the last 7 days". The board remembers your last choice on this device. Since 1.9.0 the 7 DAYS tab adds a line "vs the 7 days before: +2 workouts · +1 h 10 · +5,1 km" (drops show a minus sign −; hidden when both weeks have no workouts). It makes no extra calls to Garmin.
- Workouts of the month: the list further down, newest first, following the month you picked. Press one to see splits, heart-rate curve and a map of the route.
- Year: twelve tiles, one per month, with a faint bar for the same month last year and a SAME TIME LAST YEAR line that compares this month and the year so far with a year ago.
- Link status: green when Garmin answers, red with the reason when not, plus when your key runs out.

**Press any heading**
Every heading is a button. A window opens with the meaning in short, and below it the full story. The "In short" text is kept to a readable width, so its lines break earlier than the full story below. Escape closes it.

**Colours**
At the bottom there is a colour switcher with eight looks: Calm Dusk (standard), Calm Dark, Calm Day, Ice, Ember, Forest, Graphite and Rebel console (a bright look: pale blue-white screens with navy text, cyan-blue lines, amber numbers, square panels with a cut corner and a faint scan-line texture; inspiration only, no names or logos). It remembers your choice on this Mac.

**Looking back**
The arrows beside the month name show earlier months. The right arrow stops at the current month, and a button jumps back to it. The workouts, totals and Captain's log follow the month you picked.

**Share and print**
- Press **SHARE** at the bottom, or the **S** key. The board draws a card for the day as a picture, in your current colour look: steps, resting pulse, Body Battery, sleep, intensity minutes, workouts, weight, the month's steps and your Captain's log line.
- On the Mac, **SAVE PNG** saves the picture. On the iPhone, **SHARE…** hands it to Messages, Mail and so on.
- Press **⌘P** to print the board on white paper, without the buttons.

**Captain's log, targets and settings**
- Type one line in the Captain's log and press save. This month's lines are listed below.
- Open **Settings** to change your monthly targets (steps, workouts, swims, runs, training minutes, distance), your weekly plan (runs, strength, swims, rides, hikes, walks, yoga; 0 leaves one out), the Mac notification switch and the access code. The current code is shown there on the Mac. Cancel leaves everything as it was.
- The Mac shows a notification when a red alert fires for the first time, once per alert per day, even with no page open. The board checks every 30 minutes. Switch it off with MAC NOTIFICATION ON RED ALERT in Settings. The first time, allow notifications for Script Editor if the Mac asks.

**Full screen**
Press **F** or the FULL SCREEN button for a calm wall display. The cursor hides when it is still, and between 21:00 and 07:00 the board dims.

**iPhone and iPad on your home Wi-Fi**
1. On the Mac, open Settings and type a code of your choice. Save. Settings shows the current code from then on.
2. Settings also shows an address. Type that address into Safari on the phone.
3. Enter the code once. The phone remembers it for a year.
Without a code, the board works on this Mac only. Only the Mac can change settings.

**Reports in Apple Notes**
Every Monday morning, a summary of last week lands in Apple Notes (folder "AMS Garmin"). On the 1st of the month, the summary of last month does too. The REPORT button shows them any time. The report also has a sleep line (average hours over the recorded nights) and a short set of numbers for other apps. Each report is also saved as a text file and a data file in iCloud Drive, folder "AMS Garmin", so you can open it in the Files app on the iPhone. AMS WorkoutCompanion will need its own small update to read it. All of this needs the install step below.

**Install step (auto-start and reports)**
Run `scripts/install-agents.sh` once. It makes the board start at login and sets up the Monday and month reports. Run it with `--remove` to undo.

**Peek at a number's history**
- On the Mac, hold the pointer over a number for a moment. On the iPhone, press and hold the number for about half a second. A small card appears next to it. Escape, or a tap elsewhere, closes it.
- The card shows the last 7 days with small bars, the 30-day average, and the highest and lowest value of the last 90 days.
- The last line says "Watch synced 14:12 · board fetched 14:35". Watch synced is when the watch last sent its data to Garmin. Board fetched is when this page last got data, at most 5 minutes old.
- 18 numbers have a card: steps, distance, floors, calories, active calories, heart rate, stress, breathing, Body Battery, intensity minutes, sleep, weight and water.

**Keyboard**
R refresh · F full screen · S share · left and right arrows previous and next month · ? help · Escape close.

**Help**
The **?** button opens How it works and What's new.

**Good to know**
- It refreshes itself every 10 minutes, and there is a REFRESH button for right now.
- The footer shows the version number.
- Your Captain's log, targets, code and travel note are stored only on this Mac, in the folder `~/Library/Application Support/AMS Garmin MCP/board/`. Nothing goes to Garmin or GitHub.
- Weather needs the internet.
- Sleep, HRV and sleep debt fill once the watch is worn at night.
- The training-load words are the board's own reading, a rule of thumb.

## How to get your Garmin key
1. On the Garmin Connect website, log in and go to https://connect.garmin.com/app/settings/personalApiToken
2. Press **Create Key**.
3. Accept the terms.
4. Choose how long the key lasts: 30 days, 90 days, 180 days or 1 year.
5. Press **Create**.
6. The key is shown **once**. Copy it.
7. Press **Done**.

Garmin sends you an email a week before the key expires.

## How the key is saved
A small dialog on the Mac asks for the key and stores it in
`~/Library/Application Support/AMS Garmin MCP/api-key`, readable only by you.
The key never goes into the chat and never into GitHub.
Next to it, a 24-hour access token is kept in `token.json` so Claude does not have to ask Garmin again every time.

## What you can ask Claude
- "How did I sleep last night?"
- "My runs in October."
- "Resting heart rate this month."
- "Body Battery this week."
- "My weight trend."
- "Stress yesterday."
- "Download the file of my last ride."

## What data it covers
- Activities, with details and exercise sets
- Daily summaries
- Sleep
- Heart rate and heart-rate zones
- HRV
- Stress
- Body Battery
- Steps
- SpO2
- Weight and weight goal
- Hydration
- Fitness age
- Nutrition
- Women's health
- Profile settings

Pull-only and read-only: nothing is ever written to Garmin.

## When the key expires
Make a new key on the same Garmin page (see above) and run the save-key dialog again.

## Privacy
Your data goes from Garmin straight to Claude on this Mac. The code repository is public so that GitHub runs the tests for free; it contains no data and no keys, and never will.

## Version
1.8.0 — 10 Nov 2026
1.7.0 — 9 Nov 2026
1.6.0 — 9 Nov 2026
1.5.1 — 9 Nov 2026
1.5.0 — 9 Nov 2026
1.4.0 — 9 Nov 2026
1.3.0 — 9 Nov 2026
1.2.0 — 9 Nov 2026
