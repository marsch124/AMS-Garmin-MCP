# AMS Garmin

## What this is
AMS Garmin lets Claude read your own Garmin Connect workouts and health data, using Garmin's official Personal API. You ask in plain words ("how did I sleep last night?") and Claude fetches the answer from Garmin. It only reads. Nothing is ever written to Garmin.

## The board
The board is a live instrument panel for your Garmin data, in the style of a Star Trek control screen: soft orange, peach, lavender and red bars on a warm grey background, with tall capital letters. It opens in your normal browser.

**How to open it**
- Double-click **AMS Garmin Bridge Board** on your Desktop, or type "AMS Garmin Bridge Board" in Raycast.
- After you run the install step once, the board starts by itself when you log in, so the page opens instantly. Without that, the first open after a restart can take a few seconds.

**What it shows**
- Red alert: a red bar at the top, only when needed: resting pulse 10 percent above the month average, Body Battery under 20, or no watch sync for 24 hours.
- Clocks: local time, world time (UTC), the date, the week number, a playful stardate, and sunrise and sunset. Away from home, a travel line shows days away, distance and time zone.
- Steps today against your goal, distance, floors, calories, resting, lowest and highest heart rate, stress, and Body Battery.
- Intensity minutes this week against your goal. Hard minutes count double.
- Body Battery today as a line, with sleep and workouts shaded.
- Fitness: VO2 max and fitness age next to your real age, with trend arrows.
- Sleep and HRV from last night, and sleep debt over the last 7 nights. If the watch has no sleep data, the board says so: wear the watch at night.
- Weight: your last weigh-in, plus 90 days of dots, a 7-day average and your goal line.
- Training load: the last 7 days against your usual week, with one word: RECOVERY, MAINTAINING, PRODUCTIVE or OVERREACHING.
- Heart-rate zones this week, from Monday.
- Streaks: days in a row at your step goal and with a workout, and the longest this year.
- Weather for the next 12 hours.
- Targets: your own monthly goals with progress bars.
- Captain's log: one line a day.
- This month: a bar for every day's steps, a line for resting pulse, and the totals with an arrow against last month up to the same day.
- Workouts: the list, newest first. Press one to see splits, heart-rate curve and a map of the route.
- Year: twelve tiles, one per month.
- Link status: green when Garmin answers, red with the reason when not, plus when your key runs out.

**Press any heading**
Every heading is a button. A window opens with the meaning in short, and below it the full story. Escape closes it.

**Colours**
At the bottom there is a colour switcher with seven looks: Calm Dusk (standard), Calm Dark, Calm Day, Ice, Ember, Forest and Graphite. It remembers your choice on this Mac.

**Looking back**
The arrows beside the month name show earlier months. The right arrow stops at the current month, and a button jumps back to it. The workouts, totals and Captain's log follow the month you picked.

**Captain's log, targets and settings**
- Type one line in the Captain's log and press save. This month's lines are listed below.
- Open **Settings** to change your monthly targets (steps, workouts, swims, runs, training minutes, distance) and to set a code. Cancel leaves everything as it was.

**Full screen**
Press **F** or the FULL SCREEN button for a calm wall display. The cursor hides when it is still, and between 21:00 and 07:00 the board dims.

**iPhone and iPad on your home Wi-Fi**
1. On the Mac, open Settings and type a code of your choice. Save.
2. Settings now shows an address. Type that address into Safari on the phone.
3. Enter the code once. The phone remembers it for a year.
Without a code, the board works on this Mac only. Only the Mac can change settings.

**Reports in Apple Notes**
Every Monday morning, a summary of last week lands in Apple Notes (folder "AMS Garmin"). On the 1st of the month, the summary of last month does too. The REPORT button shows them any time. Both need the install step below.

**Install step (auto-start and reports)**
Run `scripts/install-agents.sh` once. It makes the board start at login and sets up the Monday and month reports. Run it with `--remove` to undo.

**Keyboard**
R refresh · F full screen · left and right arrows previous and next month · ? help · Escape close.

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
1.2.0 — 9 Nov 2026
