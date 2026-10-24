// Master Protocol, draft approved 2026-10-24 (user: build it, adjust as we go).
// Mind is first and fundamental. The 9 pillars replace the provisional 5.
// Pillar display names and daily draw counts are the user's decisions:
// Mind 3, Nutrition 3, Family relationships and social connections 2,
// every other daily pillar 1, for a 13-card daily total. Supplements do
// not draw daily; they live in the weekly/monthly review module.
// Kept suggestions (his word): Keep positive thoughts, morning fuel cap,
// record calories before eating. Changeroom shake is skipped, not added.
// 7 PM closure replaces the earlier 19:30 close line.
// Daily routines below are seeded into the classic pool on first load.
// Weekly, monthly, quarterly, annual, queued and open items are NOT seeded
// as daily cards; they live on the Review page, so an annual PSA never
// shows up as a random daily habit.

export type MasterPillarKey =
  | 'mind'
  | 'nutrition'
  | 'movement'
  | 'cardio'
  | 'sleep'
  | 'family'
  | 'supplements'
  | 'preventive'
  | 'accountability'

export interface MasterPillar {
  key: MasterPillarKey
  label: string
  draw: number
  fundamental?: boolean
}

export const MASTER_PILLARS: MasterPillar[] = [
  { key: 'mind', label: 'Mind and Stress', draw: 3, fundamental: true },
  { key: 'nutrition', label: 'Nutrition', draw: 3 },
  { key: 'movement', label: 'Training and Movement', draw: 1 },
  { key: 'cardio', label: 'Cardiovascular and Metabolic', draw: 1 },
  { key: 'sleep', label: 'Sleep and Recovery', draw: 1 },
  { key: 'family', label: 'Family relationships and social connections', draw: 2 },
  { key: 'supplements', label: 'Supplements', draw: 0 },
  { key: 'preventive', label: 'Preventive Medicine', draw: 1 },
  { key: 'accountability', label: 'Accountability', draw: 1 },
]

export interface MasterDailyRoutine {
  pillar: MasterPillarKey
  label: string
  detail: string
}

// Daily pool only. Labels already in the classic pool (Keep positive
// thoughts, Morning fuel cap) are skipped at seed time, not duplicated.
export const MASTER_DAILY_ROUTINES: MasterDailyRoutine[] = [
  // Mind and Stress
  { pillar: 'mind', label: 'Morning plan and commitment ritual', detail: 'Plan the day and commit in the morning.' },
  { pillar: 'mind', label: 'Affirmation rounds during training and walks', detail: 'Affirmations during training and on walks.' },
  { pillar: 'mind', label: 'Meditation and cyclic sighing', detail: 'Meditation and cyclic sighing.' },
  { pillar: 'mind', label: 'Closing-the-working-day script', detail: 'Close the working day with the script.' },
  { pillar: 'mind', label: 'Check-ins never skipped', detail: 'Check-ins are never skipped.' },
  { pillar: 'mind', label: 'Lapse re-entry rule', detail: 'Next scheduled meal or session as normal. No compensatory fasting or exercise.' },
  // Nutrition
  { pillar: 'nutrition', label: '16:8 fasting', detail: '16:8 fasting.' },
  { pillar: 'nutrition', label: '7 PM meal closure', detail: 'Evening meal pre-portioned the day before. Meal end stamp on this card keeps the meal-sleep gap.' },
  { pillar: 'nutrition', label: 'Targets: 1,950 kcal, 160 g protein, 40 g fiber, 1,800 mg sodium', detail: 'Daily targets: about 1,950 kcal, 160 g protein, 40 g fiber, 1,800 mg sodium.' },
  { pillar: 'nutrition', label: 'No alcohol, added sugar, cooking oil, fast food or ultra-processed food', detail: 'None of these today.' },
  { pillar: 'nutrition', label: 'Gluten-free (under redesign)', detail: 'Gluten-free, under redesign.' },
  { pillar: 'nutrition', label: 'No phone while eating', detail: 'No phone while eating.' },
  { pillar: 'nutrition', label: 'Whole foods, self-cooked, no cheat days', detail: 'Whole foods, self-cooked, no cheat days.' },
  { pillar: 'nutrition', label: 'Planned Exception Events pre-declared and logged separately', detail: 'Planned Exception Events are pre-declared and logged separately.' },
  { pillar: 'nutrition', label: 'Curcumin + piperine at each meal', detail: 'Curcumin + piperine at each meal.' },
  { pillar: 'nutrition', label: 'Pea protein pre- and post-workout (leucine on hold)', detail: 'Pea protein pre- and post-workout. Leucine on hold.' },
  { pillar: 'nutrition', label: 'Record calories before eating', detail: 'Kept suggestion: record calories before eating them.' },
  // Training and Movement
  { pillar: 'movement', label: 'Daily morning sessions, Push/Pull/Legs/Core', detail: 'Daily morning sessions: Push, Pull, Legs, Core.' },
  { pillar: 'movement', label: 'Progressive overload (compounds 3 sets, isolation 2)', detail: 'Progressive overload: compounds 3 sets, isolation 2.' },
  { pillar: 'movement', label: 'Stairwell protocol, 10,000-13,500 steps, 15-minute walk after meals', detail: 'Stairwell protocol, 10,000-13,500 steps, 15-minute walk after meals.' },
  { pillar: 'movement', label: 'Daily bottle rolling (plantar rehab)', detail: 'Daily bottle rolling. No calf raises or impact.' },
  { pillar: 'movement', label: 'Warm-up ramp sets before heavy compounds', detail: 'Warm-up ramp sets before heavy compounds.' },
  { pillar: 'movement', label: 'Morning heel pain log', detail: 'Morning heel pain log. Worse next day means swap the exercise.' },
  // Cardiovascular and Metabolic
  { pillar: 'cardio', label: 'Morning BP sequence (plank after readings)', detail: 'Morning BP sequence, plank after readings. Weekly averages.' },
  // Sleep and Recovery
  { pillar: 'sleep', label: 'Bed by 10:30-11:00 PM', detail: 'Bed by 10:30-11:00 PM.' },
  { pillar: 'sleep', label: 'Noon caffeine cutoff', detail: 'Noon caffeine cutoff.' },
  { pillar: 'sleep', label: 'Shower before sleep', detail: 'Shower before sleep.' },
  { pillar: 'sleep', label: 'Breathwork at a fixed anchor time', detail: 'Breathwork at a fixed anchor time.' },
  { pillar: 'sleep', label: 'Consistent wake time, 7-9 hours in bed', detail: 'Consistent wake time, 7-9 hours in bed.' },
  { pillar: 'sleep', label: '10 minutes of outdoor light after waking', detail: '10 minutes of outdoor light after waking.' },
  { pillar: 'sleep', label: 'Daily sleepiness score (1-5)', detail: 'Daily sleepiness score, 1 to 5.' },
  // Family relationships and social connections
  { pillar: 'family', label: 'One comment, then let it go', detail: 'One comment, then let it go.' },
  { pillar: 'family', label: 'Ask before engaging with older son, respect "no"', detail: 'Ask before engaging with older son, respect "no".' },
  { pillar: 'family', label: 'Family friction becomes a bright-line fix', detail: 'Family friction becomes a bright-line fix.' },
  { pillar: 'family', label: 'Daily positive acknowledgment', detail: 'Daily positive acknowledgment.' },
  // Preventive Medicine
  { pillar: 'preventive', label: 'Mineral sunscreen, no tanning beds', detail: 'Mineral sunscreen, no tanning beds.' },
  // Accountability
  { pillar: 'accountability', label: 'One change at a time', detail: 'One change at a time. New products vetted against bright lines first.' },
]

export type ReviewTiming = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'queued' | 'open'

export interface MasterReviewRoutine {
  pillar: MasterPillarKey
  label: string
  detail: string
  timing: ReviewTiming
}

// Everything in the master list that is not a daily card. Shown on the
// Review page: weekly on Sunday, monthly on the last day of the month.
export const MASTER_REVIEW_ROUTINES: MasterReviewRoutine[] = [
  // Nutrition, weekly and gates
  { pillar: 'nutrition', label: 'Tuna Mon/Wed/Fri, no added salt to lentils those days', detail: 'Tuna Mon, Wed, Fri. No added salt to lentils those days.', timing: 'weekly' },
  { pillar: 'nutrition', label: 'Fish rotation: salmon or sardines canned in water', detail: 'Fish rotation: salmon or sardines canned in water.', timing: 'weekly' },
  { pillar: 'nutrition', label: 'Weekly protein-source rotation', detail: 'Weekly protein-source rotation.', timing: 'weekly' },
  { pillar: 'nutrition', label: 'Hydration: fixed time anchor only (time to be set)', detail: 'Hydration: fixed time anchor only. Time to be set.', timing: 'weekly' },
  { pillar: 'nutrition', label: 'Protein target stays gated on cystatin C', detail: 'Protein target stays gated on cystatin C.', timing: 'open' },
  // Training, weekly, monthly, quarterly, queued
  { pillar: 'movement', label: 'Zone 2 four times a week at 80-90 RPM and 126-137 bpm, Indoor Cycling workout started', detail: 'Zone 2 four times a week at 80-90 RPM and 126-137 bpm. Indoor Cycling workout started.', timing: 'weekly' },
  { pillar: 'movement', label: 'Plantar rehab: physio twice a week', detail: 'Plantar rehab: physio twice a week. No calf raises or impact.', timing: 'weekly' },
  { pillar: 'movement', label: 'Weekly mobility session', detail: 'Weekly mobility session.', timing: 'weekly' },
  { pillar: 'movement', label: 'Weekly single-leg balance', detail: 'Weekly single-leg balance.', timing: 'weekly' },
  { pillar: 'movement', label: 'Monthly deload, first 4 days at 50%', detail: 'Monthly deload, first 4 days at 50%.', timing: 'monthly' },
  { pillar: 'movement', label: 'Monthly bodyweight bench (spotter required), pull-ups tracked', detail: 'Monthly bodyweight bench, spotter required. Pull-ups tracked.', timing: 'monthly' },
  { pillar: 'movement', label: 'Quarterly grip strength', detail: 'Quarterly grip strength.', timing: 'quarterly' },
  { pillar: 'movement', label: 'Defined lighter-session fallback when the recovery score is Red', detail: 'Defined lighter-session fallback when the recovery score is Red.', timing: 'queued' },
  { pillar: 'movement', label: 'Queued: Romanian deadlift and face pulls (after heel clears)', detail: 'Queued: Romanian deadlift and face pulls, after heel clears.', timing: 'queued' },
  { pillar: 'movement', label: 'Queued: 4x4 VO2 intervals', detail: 'Queued: 4x4 VO2 intervals.', timing: 'queued' },
  { pillar: 'movement', label: 'Queued: judo', detail: 'Queued: judo.', timing: 'queued' },
  { pillar: 'movement', label: 'Bone density added to the DEXA at 80-85 kg', detail: 'Bone density added to the DEXA at 80-85 kg.', timing: 'open' },
  // Cardiovascular, weekly and monthly
  { pillar: 'cardio', label: 'Weekly weight and waist at a consistent landmark', detail: 'Weekly weight and waist at a consistent landmark.', timing: 'weekly' },
  { pillar: 'cardio', label: 'Pulse pressure as a trend metric only (<40 is an aspiration, not a gate)', detail: 'Pulse pressure as a trend metric only. Under 40 is an aspiration, not a gate.', timing: 'weekly' },
  { pillar: 'cardio', label: 'Weekly SpO2 gate at 95.0%', detail: 'Weekly SpO2 gate at 95.0%.', timing: 'weekly' },
  { pillar: 'cardio', label: 'Monthly waist-to-height ratio (<0.5 waypoint)', detail: 'Monthly waist-to-height ratio, under 0.5 waypoint.', timing: 'monthly' },
  { pillar: 'cardio', label: 'Context flag in the sheet (illness, hard training, dehydration)', detail: 'Context flag in the sheet: illness, hard training, dehydration.', timing: 'weekly' },
  { pillar: 'cardio', label: 'Cystatin C and ACR as the open kidney gate', detail: 'Cystatin C and ACR as the open kidney gate.', timing: 'open' },
  { pillar: 'cardio', label: 'Repeat echo as a Dr. Harris conversation (no routine stress test or Holter)', detail: 'Repeat echo as a Dr. Harris conversation. No routine stress test or Holter.', timing: 'open' },
  // Sleep, trends and deferred items
  { pillar: 'sleep', label: 'Deep sleep tracked as a personal trend, not a floor', detail: 'Deep sleep tracked as a personal trend, not a floor.', timing: 'monthly' },
  { pillar: 'sleep', label: 'Sleep study deferred to ~85 kg', detail: 'Sleep study deferred to about 85 kg.', timing: 'open' },
  { pillar: 'sleep', label: 'Total sleep and regularity weighted over stage data', detail: 'Total sleep and regularity weighted over stage data.', timing: 'monthly' },
  // Mind, weekly and monthly
  { pillar: 'mind', label: 'Weekly five-question reflection by voice memo', detail: 'Weekly five-question reflection by voice memo.', timing: 'weekly' },
  { pillar: 'mind', label: 'Monthly stressor review (Part 4)', detail: 'Monthly stressor review, Part 4.', timing: 'monthly' },
  // Family, weekly
  { pillar: 'family', label: 'Sunday morning walk with Maria', detail: 'Sunday morning walk with Maria.', timing: 'weekly' },
  { pillar: 'family', label: 'Weekly 15-minute family planning', detail: 'Weekly 15-minute family planning.', timing: 'weekly' },
  { pillar: 'family', label: 'Weekly non-logistical time with a friend', detail: 'Weekly non-logistical time with a friend.', timing: 'weekly' },
  // Supplements, full list, checked in review
  { pillar: 'supplements', label: 'Centrum 50+, D3 3,000 IU, vitamin C 1 g', detail: 'Centrum 50+, D3 3,000 IU, vitamin C 1 g.', timing: 'weekly' },
  { pillar: 'supplements', label: 'Magnesium in the evening, moving to glycinate', detail: 'Magnesium in the evening, moving to glycinate.', timing: 'weekly' },
  { pillar: 'supplements', label: 'Creatine 5 g, K2 MK-7, omega-3 2-3 g EPA/DHA', detail: 'Creatine 5 g, K2 MK-7, omega-3 2-3 g EPA/DHA.', timing: 'weekly' },
  { pillar: 'supplements', label: 'Zinc cut to 25 mg twice weekly', detail: 'Zinc cut to 25 mg twice weekly.', timing: 'weekly' },
  { pillar: 'supplements', label: 'Selenium dropped at next consolidation', detail: 'Selenium dropped at next consolidation.', timing: 'monthly' },
  { pillar: 'supplements', label: 'No acetyl-L-carnitine', detail: 'No acetyl-L-carnitine.', timing: 'weekly' },
  { pillar: 'supplements', label: 'Label checks still open: K2 dose, omega-3 EPA/DHA, magnesium form', detail: 'Label checks still open: K2 dose, omega-3 EPA/DHA, magnesium form.', timing: 'open' },
  { pillar: 'supplements', label: 'One dated master list (dose, form, frequency, reason)', detail: 'One dated master list: dose, form, frequency, reason.', timing: 'monthly' },
  { pillar: 'supplements', label: 'Quarterly indication review with Strong/Moderate/Early label', detail: 'Quarterly indication review with Strong, Moderate, Early label.', timing: 'quarterly' },
  { pillar: 'supplements', label: 'Cumulative-dose check against Centrum', detail: 'Cumulative-dose check against Centrum.', timing: 'quarterly' },
  { pillar: 'supplements', label: 'Winter vitamin D retest, no dose increase', detail: 'Winter vitamin D retest, no dose increase.', timing: 'annual' },
  // Preventive Medicine
  { pillar: 'preventive', label: 'Quarterly labs with ApoB and HbA1c retests', detail: 'Quarterly labs with ApoB and HbA1c retests.', timing: 'quarterly' },
  { pillar: 'preventive', label: 'Open: cystatin C + ACR, testosterone, homocysteine, audiometry via ENT, dermatology, eye exam, dental', detail: 'Open: cystatin C + ACR, testosterone, homocysteine, audiometry via ENT, dermatology, eye exam, dental.', timing: 'open' },
  { pillar: 'preventive', label: 'Annual PSA', detail: 'Annual PSA.', timing: 'annual' },
  { pillar: 'preventive', label: 'DEXA at 80-85 kg', detail: 'DEXA at 80-85 kg.', timing: 'open' },
  { pillar: 'preventive', label: 'Invitae panel and APOE (lower priority)', detail: 'Invitae panel and APOE, lower priority.', timing: 'open' },
  { pillar: 'preventive', label: 'Repeat coronary imaging ~Feb 2028', detail: 'Repeat coronary imaging around Feb 2028.', timing: 'annual' },
  { pillar: 'preventive', label: 'Annual review with Dr. Harris, including family history update', detail: 'Annual review with Dr. Harris, including family history update.', timing: 'annual' },
  { pillar: 'preventive', label: 'Flu and COVID shots now, tetanus check, Shingrix at 50', detail: 'Flu and COVID shots now, tetanus check, Shingrix at 50.', timing: 'annual' },
  { pillar: 'preventive', label: 'Record the audiology and eye-exam follow-up intervals', detail: 'Record the audiology and eye-exam follow-up intervals.', timing: 'annual' },
  // Accountability
  { pillar: 'accountability', label: 'Wednesday Parts 1-2, Sunday Parts 3-4', detail: 'Wednesday Parts 1-2, Sunday Parts 3-4.', timing: 'weekly' },
  { pillar: 'accountability', label: 'Part 1A bright-line reconfirmation every check-in', detail: 'Part 1A bright-line reconfirmation every check-in.', timing: 'weekly' },
  { pillar: 'accountability', label: 'Google Sheets, Apple Watch, Health Auto Export, weekly habit tally', detail: 'Google Sheets, Apple Watch, Health Auto Export, weekly habit tally.', timing: 'weekly' },
  { pillar: 'accountability', label: 'Minimum viable protocol with pre-declared triggers', detail: 'Minimum viable protocol with pre-declared triggers. Wave 1.', timing: 'monthly' },
  { pillar: 'accountability', label: 'Monthly dashboard in three layers (behavior, intermediate measure, clinical outcome)', detail: 'Monthly dashboard in three layers: behavior, intermediate measure, clinical outcome.', timing: 'monthly' },
  { pillar: 'accountability', label: 'Adherence tracked separately from outcome', detail: 'Adherence tracked separately from outcome.', timing: 'monthly' },
  { pillar: 'accountability', label: 'Review date for every experiment', detail: 'Review date for every experiment.', timing: 'monthly' },
  { pillar: 'accountability', label: 'Quarterly protocol audit', detail: 'Quarterly protocol audit.', timing: 'quarterly' },
  { pillar: 'accountability', label: 'Adverse-effect column', detail: 'Adverse-effect column.', timing: 'monthly' },
]
