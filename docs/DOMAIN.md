# Domain model

How Lift4Me works from the user's side, and the business rules the code must
keep. Read this before changing training, nutrition, body, or account logic.

Every row belongs to one user, and every query is scoped to the signed-in user.

## Onboarding

After the first login the user sees an optional onboarding form. Every field can
be skipped and edited later in Settings:

- Birthdate, sex, height: stored on the user profile (static).
- Current weight: the first entry in the body measurements history.
- Daily nutrition targets (kcal + macros): the first entry in the nutrition
  targets history.

## Training

- **TrainingPlan:** a user can have several plans (e.g. "PPL", "Upper/Lower").
  One plan is the **active plan** (`users.active_plan_id`), which only decides
  what the UI shows first; every plan's templates stay usable.
- **WorkoutTemplate:** a day within a plan ("Push", "Pull", "Legs"), with an
  ordered list of exercises.
- **Exercise:** the user's own dictionary, with a category. The app starts empty.
  Categories are a closed enum: Chest, Back, Legs, Shoulders, Biceps, Triceps,
  Abs, Cardio, Other.
- **PlannedSession:** a template assigned to a date (the calendar). Any template
  from any plan can go on any date, e.g. PPL on weekdays and a bodyweight plan
  while travelling.
- **WorkoutSession:** what was actually done.
  - Strength sessions: from a template, with sets of weight × reps × optional
    RIR (0–5). Weight may be decimal; a bodyweight set has no weight.
  - Ad-hoc sessions: a standalone activity log (cardio, yoga, sports) with name,
    duration, and notes; no template and no exercises.
- **Swapping an exercise** during a session keeps BOTH `original_exercise_id`
  and `actual_exercise_id`. Stats count the actual exercise.
- **Logging sets:** "Add empty set" (blank fields) and "Copy last set" (prefills
  weight/reps/RIR from the previous set). The first set only offers "Add empty".
  The user edits the values, then marks the set complete.
- **Active session:** the draft is kept locally and auto-saved, so there is no
  save button to forget between sets.
- **Finishing a workout** is one atomic transaction: optional star rating (1–5)
  and optional tags.
- **Workout tags:** user-defined labels with colors; the app starts with none.
  Shown on the calendar as colored markers; many tags per session.
- **Deleting a session** that came from a planned session reverts that planned
  session to "planned".

## Nutrition

- **Food:** the user's own dictionary, macros per 100 g, optional serving and
  unit sizes in grams. The app starts empty. Soft-deleted; names are unique per
  user, case-insensitive.
- **Product catalog** (`global_products`): shared products from Open Food Facts /
  barcode lookups. A catalog product is copied into the user's foods only when
  they first log it.
- **Recipe:** a list of foods with amounts and a servings count. Its macros are
  computed on read from the ingredients (no cached totals). Soft-deleted.
- **FoodLog:** diary entries per day, each in one of five meals (`meal_type`:
  breakfast, second_breakfast, lunch, snack, dinner). An entry is a food or a
  recipe plus an amount in grams, servings, or units (`food_log_unit`).
  - Macros are **snapshotted at log time**, so editing or deleting a food or
    recipe never rewrites history.
  - Editing an entry's quantity rescales its snapshot linearly.
  - A recipe logged by grams: snapshot = recipe total ÷ total weight × grams.
- **Nutrition targets** are **historical**, not one goals row: a change creates
  an entry dated today (one row per date, so a second change the same day
  replaces it). "Current target" = the most recent entry, which allows charting how
  targets changed.
- **Photo estimate:** a meal photo can be turned into estimated macros (Gemini);
  the user confirms before anything is logged.
- Macro math (scale, sum, divide, multiply) lives in `@gym-bro/shared`, so the
  UI preview and the backend snapshot use the same code.

## Body measurements

- Primary: weight (kg) and body fat (%). Optional: biceps, chest, waist, hip,
  thigh (cm).
- At most one entry per day. Every field is optional.
- Re-saving the same day **merges**: a number sets the field, an explicit `null`
  clears it, an omitted field is left untouched. This keeps the quick "log
  weight" form from wiping the other measurements.
- The UI shows weight first; the other measurements sit behind "Show more".

## Charts and stats

- Body trends with 7- and 30-day moving averages. The window is **calendar
  days** (mean of every point in the trailing N days), so sparse logging stays
  honest.
- Per-exercise progress: per-session max weight and total volume
  (Σ weight × reps), matched on the actual exercise.
- Workout rating trend, nutrition targets history, weekly streak on the
  dashboard.

## Strava

- Optional OAuth connection per user; activities are imported and shown on the
  dashboard and the Strava page. Strava is a data source, never a login method.

## Settings

- Profile: email, password change, static user data (birthdate, sex, height).
- Targets: edit the current nutrition target (creates a new history entry).
- Tags: CRUD for workout tags.

## Accounts and access

- Email + password (bcryptjs), JWT in an HttpOnly cookie (jose). No OAuth login.
- Licence: `users.license_expires_at` — `NULL` means unlimited; once it lapses
  the user is confined to the dashboard paywall. Payments are not wired yet.
- Demo account: created by `apps/api/src/db/seed-demo.ts` (re-runnable; it
  deletes and recreates the demo user). Normal users start with an empty app.
