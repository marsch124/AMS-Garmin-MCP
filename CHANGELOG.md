# What's new

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
