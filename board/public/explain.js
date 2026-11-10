// AMS Garmin Board 1.4.0 - the explanation texts behind every panel heading.
// Plain script (no import/export). The page reads globalThis.AMS_EXPLAIN.
// General education only. It is not medical advice: for health questions, ask a doctor.
globalThis.AMS_EXPLAIN = {
  "chrono": {
    title: "CHRONOMETER",
    summary: "Local time, world time (UTC), the date, the week number, a playful stardate, and sunrise and sunset. Away from home, it also counts your travel days.",
    more: [
      "The clocks tick every second on this Mac. Local time is the time where you are now. World time (UTC) is the common reference time used by pilots, scientists and computers. Sweden is one hour ahead of it in winter and two hours ahead in summer.",
      "The stardate is just for fun, in the style of Star Trek. The board builds it from the year and the day of the year, so 2026.313 means day 313 of 2026. It carries no health meaning.",
      "Sunrise and sunset come from the weather service Open-Meteo, for the place the weather panel is using. In Sweden the light changes a lot over the year. In midwinter the day can be only about six hours long, so plan outdoor runs and hikes by the sunset time.",
      "Light matters for sleep. Daylight in the morning and outdoors helps set your body clock, which many people over 50 find helps them fall asleep more easily at night.",
      "Travel mode appears by itself when your browser is in a different time zone from home (Europe/Stockholm). It shows how many days you have been away, how far you have travelled, and the zone you are in. When you are back home, it disappears again."
    ]
  },
  "steps": {
    title: "STEPS TODAY",
    summary: "Your steps so far today as a round gauge against your daily goal, with distance below. A full ring means the goal is reached.",
    more: [
      "Your watch counts steps from the movement of your wrist. Garmin sets a daily goal that adapts to how much you walk. The board shows that goal and fills the ring against it.",
      "Steps are a simple measure of everyday movement, apart from your workouts. Many studies link more daily steps with a longer, healthier life. The gains are largest when you go from very little to a moderate amount, and they flatten out well above 8,000 to 10,000 steps a day for people over 60.",
      "For an active man of 60, a day of 8,000 to 12,000 steps is a good everyday range. Hiking days will be much higher, and that is fine. A rest day with fewer steps is normal too.",
      "The count is an estimate. Pushing a pram, driving over bumps or carrying a bag in one hand can add or remove steps. Look at the pattern over weeks, not at one day.",
      "Distance on this panel is the watch's estimate from your step length. It is less exact than a GPS workout. If you have a pain that stops you walking, ask a doctor."
    ]
  },
  "body-battery": {
    title: "BODY BATTERY",
    summary: "A bar from 0 to 100 showing how much energy Garmin thinks you have left. The board shows the latest value, today's lowest and today's highest.",
    more: [
      "Body Battery is Garmin's own estimate of your energy reserves. It mixes heart rate variability, stress, sleep and activity. Sleep and rest charge it. Stress and exercise drain it.",
      "A well-rested morning often starts in the 70s to 100. A hard day can take it down to the 20s or lower by evening. What matters is the shape: you should charge well overnight and drain steadily during the day.",
      "Below about 25 means low energy. The board raises a red alert when your Body Battery is under 20. That is a hint to take it easy and sleep well, not a diagnosis.",
      "It only charges well when the watch is worn at night. Until you wear it in bed, the morning values may stay low and the numbers are less reliable.",
      "Garmin does not publish the exact formula, and it is not a medical measurement. Use it to compare your own days. If you often wake up drained despite plenty of sleep, ask a doctor."
    ]
  },
  "heart": {
    title: "HEART",
    summary: "Your resting, lowest and highest heart rate today on a dial, with stress as a bar. A lower resting rate over time usually means better fitness.",
    more: [
      "Resting heart rate is how many times your heart beats per minute when you are calm, usually measured by the watch during sleep or quiet time. For a fit man of 60, 50 to 65 is common, and 60 to 100 is the normal range for adults.",
      "A steady fall in resting rate over weeks usually means your fitness is improving. A rise of several beats for a few days can mean tiredness, a cold, poor sleep, stress, alcohol or too much training. Treat it as a hint to rest.",
      "The lowest value of the day is normally found at night. The highest comes from your hardest effort, such as a run or a steep climb. Your maximum heart rate falls with age, and it differs a lot between people, so do not compare it with others.",
      "Stress is Garmin's estimate from heart rate variability, shown from 0 to 100. Under about 25 is resting, 26 to 50 is low, 51 to 75 is medium and above that is high. Exercise also raises it, so a high reading during a run does not mean worry.",
      "The monthly average of resting heart rate on the board uses finished days only, so today does not pull it around. If your pulse is often very high or very low, or you feel dizzy or have chest pain, ask a doctor."
    ]
  },
  "intensity": {
    title: "INTENSITY MINUTES",
    summary: "The minutes of brisk activity this week as a gauge against your weekly goal. Garmin counts a vigorous minute as two.",
    more: [
      "Intensity minutes count the time your heart rate is raised. A moderate minute, such as a brisk walk, counts once. A vigorous minute, such as running or a hard climb, counts twice. The board adds them the same way Garmin does: moderate plus two times vigorous.",
      "The count is for the current week, from Monday. Garmin's default goal is 150 minutes a week. That matches the common guidance from health bodies for adults: 150 minutes of moderate activity, or 75 of vigorous, each week.",
      "Many people over 60 do well with more than the minimum. Two sessions of strength training a week are advised in addition, which you already do with your weights. Strength minutes may not count much here, because the watch sees them as lower effort.",
      "Reaching the goal early in the week is fine. Spread the effort over several days if you can, and leave a day or two of easy movement for recovery.",
      "If you are starting something new or have heart or joint problems, ask a doctor before raising your effort."
    ]
  },
  "energy": {
    title: "ENERGY",
    summary: "Calories burned today: the total, and the part that comes from activity. Floors climbed are shown here too.",
    more: [
      "Total calories are what your body burns in a day. Most of it is resting calories, the energy you use just staying alive. Active calories are the extra from movement and workouts.",
      "The watch estimates this from your age, height, weight, heart rate and movement. It is a good guide for comparing days but not exact. Errors of 10 to 20 percent are common, so do not eat back every calorie it shows.",
      "Resting calories fall slowly with age and with less muscle. Your weight training helps keep muscle, which keeps the resting part up.",
      "Floors climbed count when the watch senses a rise of about three metres. It uses a pressure sensor, so weather changes can add or remove a few floors. Stairs and hills both count, and they are good for the legs and the heart.",
      "If you want to change your weight, look at the weight panel over weeks, not at one day of calories. Ask a doctor or a dietitian for advice on food."
    ]
  },
  "bb-curve": {
    title: "BODY BATTERY TODAY",
    summary: "Today's Body Battery as a line from midnight until now. Shaded stretches mark sleep and workouts so you can see what charged and what drained you.",
    more: [
      "The line is made from the minute-by-minute values Garmin saves during the day. A rising line is charging, usually in sleep and quiet rest. A falling line is draining, from stress and exercise.",
      "The shaded blocks show sleep and your workouts, with the change in Body Battery that came with each. A hard run or a heavy gym session can take 15 to 30 points. This tells you what each activity costs you.",
      "A good day has a high start, a gentle fall, and small recoveries after meals or rest. A line that never climbs may mean poor sleep, ongoing stress, illness or a watch that was not worn.",
      "If the early part of the line is flat or empty, the watch probably was not worn at night. Wear it in bed to get a real charge curve.",
      "Like all Body Battery numbers, this is Garmin's estimate. It helps you plan hard days and rest days. It does not diagnose anything. If you feel unwell, ask a doctor."
    ]
  },
  "fitness": {
    title: "FITNESS",
    summary: "Your VO2 max, Garmin's fitness age, and your real age side by side. Lower fitness age than your real age is a good sign.",
    more: [
      "VO2 max is the most oxygen your body can use during hard effort, in millilitres per kilogram per minute. It is the best single sign of cardio fitness. Garmin estimates it from a run or ride with heart rate. The board shows the value from your latest run or ride that produced one, with the date.",
      "For men of 60, a VO2 max of about 30 to 35 is average, 36 to 42 is good and above 43 is excellent. Values fall about 5 to 10 percent each decade, but regular training slows the fall a lot. The arrow shows whether the value went up, down or stayed flat compared with the one before.",
      "Fitness age is Garmin's way of saying which age your fitness looks like. It uses your resting heart rate, your vigorous minutes and days of activity, and your body fat, with your real age. Being a few years younger than your real age is a good result.",
      "Both numbers move slowly. Hills, running and interval work raise VO2 max most. Estimates can be off by a few points, especially in heat, on steep ground or with a loose watch strap.",
      "Use the trend, not a single reading. If you want a proper test, ask a doctor or a sports clinic for one."
    ]
  },
  "sleep": {
    title: "SLEEP LAST NIGHT",
    summary: "How long you slept, your score, and the time in deep, light, REM and awake. It stays empty until the watch is worn at night.",
    more: [
      "Garmin finds sleep from movement and heart rate, and splits it into stages. Deep sleep restores the body. REM sleep supports memory and mood. Light sleep is the rest. The score from 0 to 100 combines length, stages and restlessness.",
      "Most adults need seven to nine hours, and many people over 60 sleep a little less and wake more often. That is common. Roughly a fifth of the night in deep plus REM sleep is a good pattern, but it varies between people.",
      "Sleep stages from a wrist watch are estimates, not like a sleep lab. They are best for noticing patterns, such as a poor night after a late meal or alcohol, or a better night after a long walk.",
      "Habits that help: the same bedtime, a cool dark room, no screens late, daylight in the morning, and no heavy meals or alcohol near bedtime.",
      "If you snore loudly, stop breathing at night, or feel very tired in the day, ask a doctor. Until you wear the watch at night, this panel shows a reminder instead.",
      "The LAST NIGHT strip at the top of the panel gives the night in one line: when you went to bed, when you got up, and a word for the score. EXCELLENT is 90 to 100, GOOD is 80 to 89, FAIR is 60 to 79 and POOR is under 60. These are Garmin's own bands. If the watch has recorded only this one night out of the last seven, the strip says FIRST NIGHT WITH THE WATCH instead, because a single night says little. Judge your sleep by the pattern over weeks, not by one word."
    ]
  },
  "hrv": {
    title: "HRV",
    summary: "Heart rate variability: your average last night, your weekly average and the status Garmin gives. Higher than your own usual is a good sign of recovery.",
    more: [
      "HRV is the small variation in time between heartbeats, measured in milliseconds. It sounds odd, but a healthy heart does not beat like a metronome. A bigger variation usually means a body that is rested and ready, while a low one can mean stress, illness or tiredness.",
      "Garmin measures it during sleep and gives a nightly average, a seven-day average and a personal baseline range. The status says whether you are balanced, unbalanced or low compared with your own range. It needs about three weeks of nights to learn your range.",
      "HRV falls with age, and it differs a lot from person to person. A man of 60 may sit anywhere from the 20s to the 60s. Do not compare yourself with others. Compare yourself with your own baseline.",
      "Alcohol, late meals, poor sleep, illness and heavy training all push it down for a day or two. Good sleep, easy days and fitness build it up over time.",
      "It is empty until the watch is worn at night. It is a recovery hint, not a medical test. If you have heart problems or odd heartbeats, ask a doctor."
    ]
  },
  "sleep-debt": {
    title: "SLEEP DEBT",
    summary: "How many hours of sleep you owe over the last seven nights compared with what Garmin says you need. Zero or less means you are caught up.",
    more: [
      "Garmin works out a sleep need for you, a baseline that for you is about 460 minutes, or 7 hours 40 minutes, adjusted for recent activity and naps. Each night the board compares what you slept with that need.",
      "The debt is the need minus the sleep you got, including naps, added up over the last seven nights. If you slept more than you needed on some nights, that reduces the debt. Anything left over is shown as debt in hours and minutes.",
      "The small chart shows each night, so you can see whether the debt came from one bad night or a run of short ones. A debt of a few hours is common and can be paid back with one or two longer nights.",
      "Sleep debt cannot be fully repaid by one long weekend lie-in. A steady routine works better than catching up in bursts.",
      "This panel stays empty until the watch is worn at night. If you are always short of sleep, or sleepy in the day even after long nights, ask a doctor."
    ]
  },
  "weight": {
    title: "WEIGHT",
    summary: "Your last weigh-in on a thermometer, and a 90-day line with a 7-day average and your goal. The average shows the real direction.",
    more: [
      "Body weight moves a lot from day to day with water, food and salt, often by one kilogram or more. A single weigh-in tells you little. That is why the board draws the 7-day average as a line through the dots.",
      "The dots are your weigh-ins from Garmin over the last 90 days. The line is the average of the last seven days at each point. If the line goes down or up slowly, that is the real trend. The goal line is the target you set in Garmin Connect.",
      "A healthy change is slow, about 0.25 to 0.5 kilogram a week at most, if you want to lose weight. For men over 60, muscle matters. Strength training and enough protein help you keep muscle while the weight falls.",
      "For best comparison, weigh yourself at the same time, such as the morning after the toilet and before breakfast. The scale must send its weight to Garmin Connect for it to show here.",
      "Weight alone does not say how healthy you are. Waist size, fitness and blood tests matter too. For advice about your weight, ask a doctor."
    ]
  },
  "training": {
    title: "TRAINING LOAD",
    summary: "How hard the last week was compared with your usual. The board gives it one word: RECOVERY, MAINTAINING, PRODUCTIVE or OVERREACHING.",
    more: [
      "Garmin gives every workout a load number that shows how much it taxed your body. The board adds them up in two ways. Acute load is the sum of the last 7 days, with today included. Chronic load is the sum of the last 28 days divided by four, so it is your usual weekly load.",
      "The ratio is acute divided by chronic. The status words are the board's own reading, not Garmin's. Under 0.8 is RECOVERY, you did much less than usual. From 0.8 up to 1.0 is MAINTAINING. From 1.0 up to 1.3 is PRODUCTIVE, you are pushing a little above your base. Above 1.3 is OVERREACHING, a big jump that can bring injury or illness.",
      "Productive is where fitness grows. Most people do best with a mix: a few weeks in the productive range, then an easier week to absorb the work. Recovery weeks are not lost weeks.",
      "As we age, recovery takes longer, so a man of 60 should respect a high ratio. If the word says OVERREACHING, consider an easy day or two. NO DATA means there is no workout load to compare yet.",
      "The load numbers are estimates, and the board's thresholds are a simple rule of thumb. Weight training counts less well than running. If you feel pain, dizziness or very odd tiredness, stop and ask a doctor."
    ]
  },
  "zones": {
    title: "HEART-RATE ZONES THIS WEEK",
    summary: "How long your workouts this week, since Monday, kept your heart in each of five zones. Early in the week, before the first workout, it shows the last 7 days instead and says so. Most people aim for a lot of easy time and a little hard time.",
    more: [
      "The zones split your heart rate into five bands, from gentle to maximum. The floors come from the watch's settings: where zone 1 starts, where zone 2 starts, and so on up to zone 5, and your maximum heart rate. Change them in Garmin Connect if they are wrong for you.",
      "Zone 1 is very easy, like a slow walk. Zone 2 is easy and steady, where you can still talk. Zone 3 is moderate and breathing is heavy. Zone 4 is hard, near your threshold. Zone 5 is all-out effort that you can only hold for short bursts.",
      "A common healthy plan is about 80 percent of the training time in zones 1 and 2, and 20 percent or less in the hard zones. Zone 2 builds the base for long hikes. Short hard efforts raise VO2 max, but they need rest after.",
      "The bar is stacked, one colour per zone, with the total time below it. Strength training is counted by heart rate too, so it will mostly show zones 1 to 3.",
      "Maximum heart rate set in the watch is often an estimate. If the zones feel wrong, ask a coach or a doctor about a proper test, especially if you have heart problems."
    ]
  },
  "streaks": {
    title: "STREAKS",
    summary: "How many days in a row you reached your step goal and did a workout, plus your longest run this year.",
    more: [
      "A streak counts whole days in a row. For steps, a day counts when you reach the Garmin step goal. For workouts, a day counts when you recorded at least one activity.",
      "Today counts once you have met the goal. If you have not met it yet, the streak shows what you had until yesterday, so it does not break until the day is over.",
      "The current streak is the run that is still going. The longest is the best run since 1 January, and the board also notes when it ended.",
      "Streaks can motivate, but they can also push you to train when you are ill or hurt. Rest days are part of good training. A broken streak is not a failure. A man of 60 gains more from steady months than from one perfect month.",
      "If you are unwell or in pain, rest first. Ask a doctor if it lasts."
    ]
  },
  "weather": {
    title: "WEATHER",
    summary: "The weather now and for the next 12 hours: temperature, wind, rain and a short word. Use it to plan today's run, swim or hike.",
    more: [
      "The weather comes from the free service Open-Meteo and needs the internet. The board shows it for one place. First choice is the place of your latest workout from the last 10 days. If there is none, it uses your home. You can also press the locate button to use the place your browser shares.",
      "Now shows the temperature, the wind in kilometres an hour, and the rain in millimetres. The hourly strip shows the next 12 hours with temperature and the chance of rain, so you can pick the dry window.",
      "The words are short: clear, partly cloudy, overcast, fog, drizzle, rain, snow, showers, thunderstorm. Thunderstorm means stay off the hills and open ground.",
      "In the cold, wind makes it feel colder than the temperature says. Dress in layers, protect your hands and head, and drink even when it is cold. In hot weather, go earlier or later in the day.",
      "Forecasts can be wrong, especially for showers. On a long hike in the hills, also check the local mountain forecast. If you have heart or breathing problems in extreme heat or cold, ask a doctor."
    ]
  },
  "targets": {
    title: "MONTHLY TARGETS",
    summary: "Your own goals for this month, each with a progress bar. You set them in the settings: steps, workouts, swims, runs, training minutes and distance.",
    more: [
      "Garmin has daily goals, but a month needs goals of its own. These targets are yours. The board stores them on this Mac only. They are not sent to Garmin or anywhere else.",
      "Each bar shows how far you are this month. Steps come from the daily totals. Workouts, swims, runs, training minutes and distance come from your recorded activities of the month.",
      "Good targets are a little hard but possible. Look at last month's totals on the board and aim a little above them. A rise of about 5 to 10 percent is gentle enough to stay safe and still keep you moving forward.",
      "Press the edit button to change a target. Cancel leaves everything as it was. A bar that is behind early in the month is not a worry. Look again around the middle.",
      "Targets should serve you, not rule you. If you are ill or hurt, change the target. Ask a doctor before raising your training a lot.",
      "The weekly workout plan, with how many runs, strength sessions and so on you want each week, has its own panel, THIS WEEK'S PLAN."
    ]
  },
  "log": {
    title: "CAPTAIN'S LOG",
    summary: "One line a day to remember how the day felt. This month's lines are listed below, newest first.",
    more: [
      "Numbers do not tell everything. A short note such as sore knee, great hike or slept badly gives the numbers a meaning when you look back.",
      "Write one line, up to 200 characters, and press save. You can change today's line later. Saving an empty line removes it.",
      "The log is stored only on this Mac, in a small file in the board's folder. It is not sent to Garmin, to GitHub or to any other place. It is not backed up unless your Mac backup includes that folder.",
      "When you read the month's numbers, read the log beside them. A low Body Battery on a day marked cold in the log tells a different story from the same number on a day marked fine.",
      "Do not write anything you would not want others to read on this Mac. If a note is about a health worry, tell a doctor, not just the log."
    ]
  },
  "month-steps": {
    title: "STEPS THIS MONTH",
    summary: "One bar for each day's steps, with a line at your goal. Bars that reach the line are goal days.",
    more: [
      "Each bar is one day. The goal line is Garmin's step goal. Days at or above it are goal days, and they are counted in the totals and in your streaks.",
      "Big bars are usually hiking or long walking days. Small bars are rest days, sick days or days with a lot of sitting. A few low days in a row after a hard week are normal.",
      "Look for the pattern across the week. Many people have a busy weekend and a quiet midweek. If you want an even rhythm, a short walk after meals helps lift the low days.",
      "The last bar is today and is still growing. The month arrows let you look back at earlier months and compare.",
      "Steps are an estimate from the watch. A day with no bar means the watch recorded nothing, for example when it was not worn."
    ]
  },
  "month-hr": {
    title: "RESTING PULSE THIS MONTH",
    summary: "Your resting heart rate for each finished day as a line. A line that slowly falls or stays steady is a good sign.",
    more: [
      "Resting heart rate is one of the easiest signs of how your heart and body are doing. Each point is one day, measured by the watch when you are at rest.",
      "The board draws only finished days, so today does not pull the average around. The totals panel gives the average, the lowest and the highest for the month.",
      "Small ups and downs of two or three beats are normal. A rise of five beats or more for several days can mean a cold coming, poor sleep, stress, alcohol, heat or too much training. The red alert fires when a day is at least 10 percent above the month average.",
      "A slow fall across months usually follows good aerobic training. Many fit men of 60 sit between 50 and 65.",
      "If the pulse is high for a long time without reason, or you feel unwell, ask a doctor. The watch is not a medical device."
    ]
  },
  "activities": {
    title: "WORKOUTS",
    summary: "Every workout of the month, newest first, with type, time, distance and heart rate. Press a row to open its splits, heart-rate curve and map.",
    more: [
      "The list comes from Garmin Connect and includes everything the watch recorded: runs, walks, hikes, swims, strength training and more. The header shows the count and the totals for time, distance, calories and climbing.",
      "Each row shows the date, type, name, duration, distance, average heart rate and the training effect. Training effect from 0 to 5 shows how much the workout improved your fitness. 2 maintains it, 3 improves it, 4 is a big gain, and 5 is overreaching.",
      "Press a row to open the detail panel with kilometre splits, the heart-rate curve and, where there is GPS, the track on a map. Use it to check that your pace and pulse stayed steady on a long effort.",
      "Weight sessions show no distance, so judge them by time, heart rate and the training effect. Swims show the pool length or open water distance.",
      "A workout with a very high heart rate for the effort, chest pain or dizziness is a reason to stop and ask a doctor."
    ]
  },
  "workouts": {
    title: "WORKOUTS",
    summary: "Your workouts of today, yesterday or the last 7 days, newest first, with one line of totals. Press a row to open its splits, heart-rate curve and map.",
    more: [
      "Use the three buttons at the top of the panel to choose the time: TODAY, YESTERDAY or 7 DAYS. 7 DAYS means the last seven days, today included. The board remembers your choice on this device.",
      "The line under the buttons adds up the workouts you see: how many there are, the total time, the distance and the calories. Each row shows a type tag, the day and time, the name, the duration and the distance.",
      "Press a row to open the detail panel with kilometre splits, the heart-rate curve and, where there is GPS, the track on a map.",
      "If you did nothing in that time, the panel says so: no workouts today, no workouts yesterday, or no workouts in the last 7 days. A rest day is part of good training.",
      "The panel always looks at the real today, whichever month you have picked with the arrows. The list further down shows the whole month. Both come from the workouts the board already loads from Garmin Connect, so there are no extra calls.",
      "Weight sessions show no distance, so judge them by time and heart rate. A workout with chest pain or dizziness is a reason to stop and ask a doctor."
    ]
  },
  "month-totals": {
    title: "MONTH TOTALS",
    summary: "The month in numbers, with an arrow and percent or difference against last month up to the same day.",
    more: [
      "The totals cover steps, average steps per day, goal days, floors, distance, intensity minutes, resting pulse and workouts with their time. They are added up from the daily summaries and the activity list.",
      "The arrows compare this month so far with the previous month up to the same day of the month. That is fair, because a full last month would always look bigger than half of this one. Up for steps and minutes is usually good news. For resting pulse, down is usually the good direction.",
      "A percent is worked out as the difference divided by last month's number. If last month had zero, there is nothing to compare and no percent is shown.",
      "One month can differ from another for ordinary reasons: weather, holidays, illness, work or travel. Look at several months before you decide anything.",
      "These are your own data. Use them to set realistic goals. If a big drop comes with other symptoms, ask a doctor."
    ]
  },
  "activity-detail": {
    title: "WORKOUT DETAIL",
    summary: "One workout opened up: a summary, the splits, the heart-rate curve, and the GPS track if there is one.",
    more: [
      "The board fetches the workout from Garmin Connect when you press the row. It also reads the original file recorded by the watch, which holds the heart rate and the position along the way.",
      "Splits cut the effort into pieces, usually a kilometre each. They show time, average and maximum heart rate and climbing for each piece. Even splits mean steady pacing. A slowdown at the end can be tiredness, or just a hill.",
      "The heart-rate curve shows the whole workout. A smooth rise at the start, a steady plateau and a quick fall at the end is a healthy picture. A heart rate that creeps up while your pace stays the same is called drift, and it is common in heat or when tired.",
      "The map draws the GPS trace from the file. Workouts without GPS, like the gym, show no map. The curves are thinned to a few hundred points to stay fast.",
      "Press close to go back. If a workout shows odd spikes in heart rate, a loose watch strap is the usual cause. If you had symptoms during exercise, ask a doctor."
    ]
  },
  "year": {
    title: "YEAR",
    summary: "Twelve tiles, one for each month of the year, with steps, workouts, resting pulse and goal days. Future months are dimmed.",
    more: [
      "Each tile gives the month's steps, number of workouts, average resting pulse, and the days you reached your step goal. It lets you see the shape of your year at a glance.",
      "Look for seasons. Many people move more in summer and autumn, and less in the dark Swedish winter. Knowing this helps you plan indoor options, like the gym or the pool, for the weeks you know are hard.",
      "A falling resting pulse across the tiles, or more goal days, shows that your habits are working. A rise in pulse with fewer workouts can hint at a break in routine.",
      "A month with few data days, for example when the watch was off, has smaller totals. Compare only months with a similar number of days of data.",
      "The tiles are built from the daily summaries since 1 January. They are for your own overview, not for any medical purpose.",
      "Under the tiles, the SAME TIME LAST YEAR line compares this month, up to today's date, with the same stretch a year ago: steps, number of workouts and training time, with an arrow and a percent. A second part compares the year so far with the same days last year. Each tile also shows a faint bar and a small line for the same month last year, so you can see at a glance whether this year is ahead. If last year has no data, for example because the watch was new, the line says so instead. Compare like with like: one holiday week or one injury can move a month a lot."
    ]
  },
  "red-alert": {
    title: "RED ALERT",
    summary: "A red bar that shows only when something needs a look: a high resting pulse, a very low Body Battery, or a watch that has not synced for a day.",
    more: [
      "The red alert has three rules. The first fires when a resting pulse is at least 10 percent above the month average. The second fires when Body Battery is below 20. The third fires when the watch has not synced with Garmin for 24 hours.",
      "A high resting pulse is a general sign that the body is under strain. It can come from illness, poor sleep, stress, alcohol, heat or hard training. Rest and drink water, and watch how you feel.",
      "A very low Body Battery means little energy is left. Plan an easy day and an early night. It is only the watch's estimate.",
      "No sync for 24 hours means the numbers on the board may be old. Open the Garmin Connect app on your phone with the watch nearby and wait for it to sync.",
      "The alert is not a diagnosis, and no alert does not mean you are healthy. If you feel unwell, have chest pain, faint feelings or trouble breathing, ask a doctor or call for help at once.",
      "Since 1.4.0 the Mac also shows a notification the first time an alert fires, even when the board page is closed. Each alert gives one notification per day, so it will not nag you. The board checks every 30 minutes. You can switch the notification off in Settings."
    ]
  },
  "link": {
    title: "LINK STATUS",
    summary: "Green means Garmin is answering. Red shows why not. The footer also shows when your key runs out and when the board last refreshed.",
    more: [
      "The board reads your data from Garmin with a personal key that you created on the Garmin website. The link light shows if that connection works right now.",
      "Green means Garmin answered the latest request. Red comes with a plain reason, such as the key being rejected, a pause because Garmin said slow down, or no internet.",
      "The key lasts for the time you chose, 30 days up to one year. The footer shows when it runs out. Garmin emails you a week before. To renew it, make a new key on the same Garmin page and save it again.",
      "The board refreshes itself every 10 minutes. Press the refresh button, or the R key, to refresh at once. The time of the last refresh is shown beside it.",
      "The board only reads from Garmin. It never writes anything to Garmin. Your key stays in a private file on this Mac."
    ]
  },
  "rhythm": {
    title: "WEEKLY RHYTHM",
    summary: "Your average steps for each weekday over the last 12 weeks, Monday to Sunday. The weakest day is marked in red, the strongest in green.",
    more: [
      "For each weekday the board takes every finished day with data over the last 12 weeks and averages the steps. Today is left out because it is not finished. A dashed line shows the average of all days.",
      "This shows your habits. Many people walk most on the weekend and least on a working desk day, or the other way round when they hike or train on fixed days. Knowing your weakest day makes it easy to plan a walk or a workout there.",
      "For an active man of 60, a spread of 7,000 to 13,000 steps between your quietest and busiest day is normal. A gap of more than a factor of two often means one day could use a short walk.",
      "A day with only one or two data points, for example because the watch was off, can look odd. The board counts only days with data, so a long break in wearing the watch makes the picture less sure.",
      "It is a habit picture, not a test. Weather, travel, illness and holidays all change it."
    ]
  },
  "plan": {
    title: "THIS WEEK'S PLAN",
    summary: "Your own weekly workout plan, for example 3 runs and 2 strength sessions, with a tick for each one done since Monday.",
    more: [
      "You set how many workouts of each kind you want each week in Settings: runs, strength, swims, rides, hikes, walks and yoga. The plan is stored on this Mac only.",
      "The board counts the workouts that Garmin recorded from Monday to today. Running includes treadmill and trail runs, rides include indoor and mountain biking, swims include open water, and yoga includes Pilates. A filled dot means done, an empty one means still open. A workout beyond the plan does not count extra.",
      "The line below shows how many are done and how many days are left until Sunday. When all are done, it says so. If you have set no plan, the panel invites you to add one.",
      "A good plan is one you keep. For a man of 60, a mix of two or three sessions of cardio, two of strength and some easy walking is a widely used pattern, with at least one rest day in a week. Start a little below what you think you can do.",
      "A missed tick is not a failure. Illness, travel and tiredness are good reasons to move the plan. Ask a doctor before you raise your training a lot or if you feel pain or unusual breathlessness."
    ]
  },
  "resting-trend": {
    title: "RESTING PULSE · 90 DAYS",
    summary: "Your resting heart rate for each of the last 90 days as dots, with a 7-day average line and the 90-day average dashed.",
    more: [
      "Resting pulse is how fast your heart beats when you are calm, as measured by the watch, usually during sleep. Each dot is one finished day. Today is left out until it is complete.",
      "The line is the average of the last seven days at each point, which smooths out the ups and downs. The dashed line is the average of all the days shown. Below the chart the board gives the average, the lowest and highest, and the latest reading.",
      "A fit, active man of 60 often has a resting pulse in the range of about 45 to 65 beats a minute. Your own level matters more than a table. A slow fall over months usually follows better fitness. Hard training, poor sleep, stress, alcohol, heat and illness all push it up for a few days.",
      "Watch the line more than a single dot. A rise of five or more beats that lasts several days, with no clear reason, is worth noticing and resting for. Some medicines, such as beta blockers, lower the pulse by themselves.",
      "The watch estimates the pulse and can be off if it sits loose. This is general information, not medical advice. If your resting pulse is very high or very low and you feel unwell, or you feel palpitations, ask a doctor."
    ]
  },
  "hydration": {
    title: "WATER",
    summary: "The water you logged today as a gauge against your goal, and the last seven days as small bars. It shows 'no water logged' until you log some.",
    more: [
      "Garmin lets you log drinks in Garmin Connect or on the watch, and sets a daily goal. The board shows the litres logged today against that goal, and a bar for each of the last seven days with the average.",
      "The board cannot see what you drink on its own. If you do not log water, the panel says NO WATER LOGGED and shows no figure. That is not a fault. It starts to fill as soon as you log water in Garmin Connect or on the watch.",
      "How much to drink varies. A common guide for adults is about 1.5 to 2.5 litres of fluids a day, and more on hot days or after hard training, when you also lose water in sweat. Food, tea and coffee count too. Thirst is a reasonable guide for most healthy people.",
      "Watch for dark urine, headaches or dizziness on long hikes or hot days, which can mean you need more. Older people feel thirst less, so a steady habit helps.",
      "This is general information. If you have a heart, kidney or other condition, or take water tablets, ask a doctor how much to drink."
    ]
  },
  "stress": {
    title: "STRESS",
    summary: "Garmin's stress reading for today with a word, how your day divides into rest and stress, and the daily average over 4 weeks.",
    more: [
      "Garmin measures stress from heart rate variability, the small changes in time between heartbeats. A calm body shows more variation. A strained one shows less. The scale runs from 0 to 100.",
      "The word for today comes from Garmin: CALM, BALANCED, STRESSFUL or VERY STRESSFUL. The coloured bar divides the measured time into rest (0 to 25), low (25 to 50), medium (50 to 75) and high stress (75 to 100), with hours in the legend. The chart shows the daily average for 28 days, with the 4-week average dashed.",
      "Averages of 25 to 40 are typical for a relaxed, active person. A day with plenty of rest time and a few medium hours is normal. Exercise also raises the reading for a while, because the body is under load. That is not bad stress.",
      "Look for the trend. Several weeks of rising averages can come with poor sleep, long work days, illness or too much training without rest. Short walks, daylight, good sleep and slow breathing can help bring it down.",
      "The numbers are estimates from a wrist watch, not a medical test. If you feel anxious, low or overwhelmed for a long time, ask a doctor. The existing stress bar in the heart panel stays as it was."
    ]
  }
};
