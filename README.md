# AMS Garmin

## What this is
AMS Garmin lets Claude read your own Garmin Connect workouts and health data, using Garmin's official Personal API. You ask in plain words ("how did I sleep last night?") and Claude fetches the answer from Garmin. It only reads. Nothing is ever written to Garmin.

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
Your data goes from Garmin straight to Claude on this Mac. The repository is private and contains no data and no keys.

## Version
1.0.0 — 9 Nov 2026
