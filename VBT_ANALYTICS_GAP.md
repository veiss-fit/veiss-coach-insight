# Beyond Mean Velocity — VBT analytics gap analysis

**Artifact:** https://claude.ai/code/artifact/e5fb2771-ce6b-4d04-a4c6-9f89c6e80aaf

Where Veiss stands against VALD/GymAware, Perch/Catapult and Output Sports, and the metric
work that would make this a professional-grade VBT performance system.

Private to the `teamveiss@gmail.com` account unless shared from the page's share menu.

**Date:** 11 September 2026
**Scope:** data and analysis layer only
**Internal facts** read from this repo and from the read-only DB snapshot of 25 July 2026
(13 tables, 3 coaches, 2 groups, 3 players, 60 sessions, 2,691 reps, 30 workout plans).
**Competitor facts** from public material, accurate as published and subject to change.

---

## 01 — What we actually measure today

The rack streams raw depth frames and computes nothing (`LIVE_MODE_PLAN.md` §3.1). Every VBT
number is produced on the phone, then written to Supabase only when the athlete taps Finish
(§3.2). That amounts to four stored metrics per rep.

| Stored per rep | Unit | What the dashboard does with it | Status |
|---|---|---|---|
| `average_rep_speed` | m/s | Mean concentric velocity. Averaged across exercises into one headline figure per athlete, plus within-set and session drop-off. | Used |
| `rom_mm` | mm | Averaged into a single displacement figure. No per-exercise split, no consistency measure. | Thin |
| `concentric_duration_s` | s | Reported as concentric tempo with a deviation indicator against a 7-session baseline. | Used |
| `eccentric_duration_s` | s | Selected in `playersService.ts:255` and then discarded. Nothing reads it. | **Unused** |
| `weight` | kg | Read in exactly one place (`sessionsService.ts:130`) to label a set. Never meets velocity in any calculation. | **Unused** |
| `set_number`, `rep_number` | int | Set grouping for fatigue drop-off. The only real structural use of the schema. | Used |

On top of that sits the deviation panel in `src/lib/athleteSummaryUtils.ts`, which is the
strongest thing in the product. Average velocity, within-set fatigue, session fatigue,
concentric tempo and volume are each compared against a 7-session rolling baseline with a
sample standard-deviation band and a RAG state. That is real monitoring logic and it is more
considered than anything the cheap end of the market ships.

The rest of the dashboard is attendance, engagement and a top-performer callout. Those are
roster-administration numbers. They help a high-school coach chase compliance. None of them
describe the athlete's physical state.

### Three problems with the flagship numbers

**The headline metric cannot support a decision.** A single average velocity per athlete pools
a trap-bar deadlift near 0.4 m/s with a jump squat near 1.3 m/s. Velocity means something only
against a named exercise at a known load. Our own code already carries a warning admitting the
average is reliable only if exercise selection stays constant, which it never does. We lead
with the one number that is structurally uninterpretable.

**The load recommendation is unanchored.** Above 0.85 m/s we tell the coach to add load, below
0.40 m/s to cut it (`playersService.ts:286-289`). Those thresholds are applied to the
cross-exercise average with no reference to the athlete, the lift, or the weight on the bar.
The minimum velocity of a genuine maximal effort is exercise-specific, so generic zone charts
do not transfer between lifts. This is our most exposed claim, and a coach who tests it once
will stop trusting the product.

**Load sits in the database and never enters the analysis.** We store weight and velocity on
the same row and never relate them. That relationship *is* velocity-based training. Everything
in section 04 flows from closing that one gap.

---

## 02 — The field we are entering

The two strongest VBT brands are no longer independent. GymAware now sits inside VALD, and
Perch now sits inside Catapult. Both arrive bundled with force plates, timing gates, tracking
and an athlete-management layer that professional organisations have already standardised on.

> Competing on the claim that we measure barbell velocity means competing for a commodity that
> two performance-technology ecosystems now fold into a larger contract.

| System | Sensing | Metrics beyond mean velocity | Analysis layer | Price |
|---|---|---|---|---|
| **GymAware** (VALD) | Linear transducer, x-axis corrected | Mean and peak velocity, mean and peak power, each for the concentric *and* eccentric phase. Bar path, displacement, time. | Cloud dashboard, load-velocity profiles, athlete management, integrations into third-party AMS. | $1,995 + $325–1,095/yr |
| **Perch** (Catapult) | Rack-mounted depth camera | Barbell velocity and power, plus bodyweight movement tracking, from the same rack mount we use. | Four products: programming with suggested weights and dynamic goals, assessment batteries, floor-level live training, longitudinal analysis. Automatic load-velocity profiles and e1RM. Leaderboards refreshing every 30 s. | Bundled, hardware-as-service |
| **Output Sports** | Single wearable IMU | 200+ exercises across 12 modules: velocity, countermovement and drop jumps, reactive strength, ground contacts, mobility, stability, endurance, wellness. | Automatic load-velocity profiles, target-velocity prescription with live feedback, customisable traffic-light readiness dashboards, automated reports. 40 athletes tested for jump and RSI in under 7 min. | ~$500 + team plan |
| **Vitruve** | Linear transducer | Mean propulsive velocity, ROM, estimated 1RM. | Workout planner, generated programmes, video capture. | $447 + $620–1,251/yr |
| **Metric** | Phone camera, computer vision | Mean and peak velocity, ROM, tempo, power, bar path. | 1RM estimation, load-velocity profiling, workout builder, video storage. | $65/yr |
| **TeamBuildr** and peer AMS | None, it ingests | Not a sensor. Consumes everyone else's data. | Wearables and load-monitoring dashboards, KPI tracking, body heat map, daily pain and soreness check-ins, 16 exportable reports. | Per team |

Read down the analysis column rather than the metrics column. Every serious competitor has
converged on the same three capabilities:

1. An automatic load-velocity profile per athlete per lift.
2. A prescribed target the athlete is measured against in real time.
3. A readiness view that names who to modify today.

We have none of the three. A phone app at $65/yr has two of them.

One asset here is worth more than it looks. Because our firmware computes nothing and streams
raw depth frames, **our metric set is a software release rather than a hardware generation.**
Competitors are bounded by what their device chose to emit. We are bounded only by the signal
processing we are willing to write.

---

## 03 — The mechanism we are missing

The capture half of the chain works. The decision half does not exist.

```
BUILT AND SHIPPING
  Rack camera ──141 B──▶ Phone signal chain ──on Finish──▶ reps table
  16 depth zones         velocity, ROM,                    4 metrics
  no computation         tempo, load                       per rep
                                                              │
                                                         accumulates
                                                              ▼
PROPOSED (no firmware change required)
  Prescription ◀──compare── Readiness ◀──regress── Load–velocity profile
  target velocity,          today against          per athlete,
  stop condition            predicted              per lift
       │
       └──▶ next set — the loop that closes
```

Load and velocity already sit on the same database row. Regressing one on the other yields a
profile; the profile yields a predicted velocity for today's load; the gap between predicted
and actual is a readiness measurement taken from an ordinary working set. No separate test day,
no new hardware.

The same regression is how an estimated 1RM appears without ever attempting one, which is the
single most valuable derived number in the category. Worked example:

| Load (kg) | Profile MCV (m/s) |
|---|---|
| 70 | 0.98 |
| 90 | 0.82 |
| 110 | 0.66 |
| 130 | 0.50 |

Slope is −0.008 m/s per kg. Extrapolating to a 0.30 m/s minimum velocity for that lift gives
**e1RM = 155 kg**. If today's 110 kg set moves at 0.58 m/s instead of the predicted 0.66, that
is 12% below profile — a readiness flag and a reason to cut load, derived from a set the
athlete was going to do anyway.

---

## 04 — The gap, priced by what it costs us

Five tiers, ordered by what each demands of us rather than by how valuable it is.

### Tier 0 — derivable from rows already in the database
*No firmware, no new capture, analysis code only.* Every item could be computed tonight against
the 2,691 reps already stored. This tier alone takes us from four reported metrics to roughly
fifteen, and it contains the entire autoregulation chain.

- **Load–velocity profile** — regress velocity on load per athlete per lift; yields slope, intercept, fit quality, staleness. *The keystone.*
- **Estimated 1RM** — extrapolate the profile to that lift's minimum velocity, recomputed every session.
- **Readiness index** — actual velocity at today's load against the profile's prediction (% deviation).
- **Mean concentric power** — load × velocity. Both columns are already there and never meet.
- **Mechanical work** — load through measured displacement, per rep, set and session.
- **Volume load** — load × reps, the figure every strength coach already tracks weekly.
- **Time under tension** — concentric + eccentric duration. The eccentric half is queried today and thrown away.
- **Eccentric:concentric ratio** — tempo compliance and lowering control, from two columns we already store.
- **Displacement consistency** — within-set CV of ROM, which often degrades before velocity does.
- **Velocity loss against a target** — we compute drop-off but never against a prescribed threshold, which is what makes it actionable.
- **Per-exercise normalisation** — replace the cross-exercise average with per-lift views and per-lift baselines.
- **Relative intensity** — today's load as a share of today's e1RM, not last month's test.

### Tier 1 — new signal processing on frames we already receive
*Phone-side work, still no firmware change.* These make a professional coach treat the device as
instrumentation rather than a novelty. They exist in the depth stream and are discarded before
they reach the database.

- **Peak concentric velocity** — universally reported by competitors, absent from our schema.
- **Mean propulsive velocity** — the convention much of the published research uses; its absence is a credibility problem.
- **Peak and mean power** — computed from the curve rather than estimated from averages.
- **Velocity–time curve** — store a compressed series per rep. Unlocks every later analysis and **cannot be back-filled.**
- **Eccentric velocity** — mean and peak on the lowering phase, which GymAware has reported for years.
- **Turnaround time** — eccentric-to-concentric transition, a direct read on stretch-shortening quality.
- **Bar path deviation** — lateral drift and rep-to-rep repeatability. A technique signal, not a strength signal.
- **Rep detection confidence** — flag doubtful reps instead of silently averaging them into a baseline.

### Tier 2 — new capture surfaces in the apps
*Product and interface work, no hardware.* Analysis is limited less by sensing than by context.
We do not know what the athlete was asked to do, so we cannot say whether they did it.

- **Prescribed vs actual** — target load, reps and velocity on the plan, reconciled against what happened. Compliance is what coaching staff check first. *Highest demand item in this tier.*
- **Effort rating per set** — RIR or RPE, which cross-checks velocity and catches bad load entry.
- **Daily wellness check-in** — sleep, soreness, stress, mood. Cheap to build, table stakes for any readiness view.
- **Body mass and position** — required for relative strength and positional comparison.
- **Pain and injury flags** — location and severity, the way AMS platforms already collect it.
- **Jump and reactive tests** — CMJ and RSI. A depth camera is plausibly capable, and this is where Output Sports wins deals we never reach.

### Tier 3 — the analysis layer, which is the actual product
*Where differentiation lives.* Metrics are inputs. What a professional programme buys is a
defensible decision attached to a name and a date.

- **Per-lift velocity zones** — configurable by exercise and athlete, replacing two global thresholds that hold for no lift in particular.
- **Autoregulation engine** — suggested load for the next set, from the profile plus today's measured velocity. *The wedge.*
- **Velocity-loss stop conditions** — enforced live. Under ~25% loss favours strength and power, above it drifts toward hypertrophy, so the threshold is a programming choice worth exposing.
- **Workload ratios** — acute against chronic exposure, computed on work or volume load rather than a raw rep count.
- **Readiness board with reasons** — traffic lights are the interface everyone ships; the reason attached to the light is what makes it trusted.
- **Group and positional norms** — percentiles and standard scores within a squad or position group.
- **Block review** — did the training block produce the adaptation it was written to produce.
- **Automated reporting** — per athlete and per group, exportable. Competitors count their reports as a feature because coaches count them too.
- **Change alerting** — who regressed, who plateaued, who set a profile best. Pushed, not pulled.

### Tier 4 — what a professional organisation requires before it signs
*Non-negotiable, not differentiating. None of this wins a demo; all of it loses a deal.*

- **Row-level security actually enabled** — seven tables carry policies that were never switched on, so an unauthenticated request with the publishable key returns every rep in the database (`DB_GUIDE.md` finding 1). **This blocks everything else.**
- **Roles beyond coach** — head coach, assistant, sport scientist, athletic trainer, analyst, athlete, each scoped. Today the app recognises one role.
- **Export and a read API** — professional staff will not accept a system they cannot pull their own data out of.
- **AMS integration** — Smartabase, TeamBuildr, CoachMePlus, Catapult. We need to be a source they ingest, not a destination competing with them.
- **Multi-team organisations** — one account spanning several squads and sports, which the current data model does not express.
- **Governance** — audit trail, SSO, retention policy, athlete consent. Soreness and pain data is medical-adjacent.
- **Live in-session view** — nothing reaches the server until the athlete taps Finish, so a coach on the floor cannot see the set happening in front of them. Already scoped in `LIVE_MODE_PLAN.md`.

---

## 05 — The datasets, concretely

Section 04 is a list of metrics. Metrics are not a design. Here is the same material organised
by **grain** — what a single row represents — because grain decides whether a number can be
joined to anything else.

Today the product has one analytical grain, the rep, and every view recomputes from it on each
page load. Eight grains are needed. Six are derived from the rep table plus the plan. Only two
require anyone to write new data.

| Dataset | One row per | What it answers | Origin |
|---|---|---|---|
| **A. Rep metrics** | rep | What happened on this repetition. | Extends `reps` |
| **B. Set summary** | athlete × exercise × set | Did this set do its job, and why did it end. | Derived |
| **C. Load–velocity profile** | athlete × exercise × version | How strong is this athlete on this lift, right now. | Derived |
| **D. Daily readiness** | athlete × date | Who do I modify today, and for what reason. | Derived + wellness |
| **E. Prescription vs actual** | plan item | Did the session that was written actually happen. | Derived |
| **F. Exercise reference** | exercise | What do these numbers mean for *this* lift. | **New, coach-written** |
| **G. Workload** | athlete × date, rolling | Is exposure climbing faster than tolerance. | Derived |
| **H. Group norms** | cohort × exercise × metric | Where does this athlete sit among peers. | Derived |

The examples below follow one athlete through one session so the joins are visible: the same
back squat sets appear at rep grain, at set grain, in the profile that produced the targets, and
in the readiness row that resulted.

### A — Rep metrics (back squat, set 3 at 110 kg)

| Rep | Mean vel | Peak vel\* | Prop vel\* | ROM | Con | Ecc | TUT\* | Power\* | Work\* | Vel loss\* |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.66 | 0.94 | 0.72 | 520 | 0.79 | 1.42 | 2.21 | 712 | 561 | 0.0% |
| 2 | 0.64 | 0.91 | 0.70 | 518 | 0.81 | 1.39 | 2.20 | 691 | 559 | 3.0% |
| 3 | 0.61 | 0.88 | 0.67 | 511 | 0.84 | 1.45 | 2.29 | 658 | 551 | 7.6% |
| 4 | 0.57 | 0.83 | 0.62 | 498 | 0.87 | 1.51 | 2.38 | 615 | 537 | 13.6% |
| 5 | 0.52 | 0.77 | 0.57 | 479 | 0.92 | 1.63 | 2.55 | 561 | 517 | **21.2%** |

Velocity m/s, ROM mm, durations s, power W, work J. Unmarked columns are what we store today.
`*` marks new columns: TUT, power, work and velocity loss are arithmetic on existing columns,
peak and propulsive velocity come from the depth stream we already receive. Note ROM falling
520 → 479 mm as the set degrades — 8% of depth lost. That is a technique collapse worth
flagging, and our sensor sees it natively.

### B — Set summary (the table every coach view should read from)

| Set | Load | Reps | Best vel | Mean vel | Vel loss | ROM spread | TUT | Work | Volume load | Why it ended |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 90 | 5 | 0.83 | 0.80 | 6.0% | 1.1% | 10.4 | 2,310 | 450 | reps complete |
| 2 | 110 | 5 | 0.67 | 0.63 | 14.9% | 2.0% | 11.2 | 2,762 | 550 | reps complete |
| 3 | 110 | 5 | 0.66 | 0.60 | **21.2%** | 3.1% | 11.6 | 2,726 | 550 | **velocity-loss stop hit** |
| 4 | 110 | 3 | 0.61 | 0.58 | 12.0% | 2.4% | 7.1 | 1,632 | 330 | cut by coach |

Nothing like this exists today. Every athlete view re-derives set structure from raw reps on
each load, which is why the fatigue measures are expensive and cannot be trended across
athletes. The last column is what coaches read first, and it is only expressible once a
prescribed stop condition exists to compare against.

### C — Load–velocity profile (versioned, and willing to say no)

| Exercise | Window | Loads | Range | Slope | Intercept | Fit | Min vel | e1RM | Prev | Age | Published |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Back squat | 42 d | 7 | 70–130 | −0.0080 | 1.540 | 0.98 | 0.30 | 155 | 151 | 2 d | yes |
| Bench press | 42 d | 5 | 60–100 | −0.0102 | 1.230 | 0.94 | 0.17 | 104 | 104 | 9 d | yes |
| Trap-bar DL | 42 d | 3 | 140–160 | −0.0061 | 1.180 | **0.71** | 0.25 | — | — | 21 d | **withheld** |

**The third row is the most important one in this document.** Three load points across a 20 kg
spread with a fit of 0.71 cannot carry an e1RM, so the dataset refuses to publish one rather
than showing a confident number built on nothing. Every competitor generating profiles
automatically faces this, and the ones coaches distrust are the ones that always answer.

### D — Daily readiness (the flagship view, with the reason attached)

| Athlete | Reference lift | Load | Predicted | Actual | Deviation | Sleep | Soreness | Workload | State | Reason shown to coach |
|---|---|---|---|---|---|---|---|---|---|---|
| J. Moreno | Back squat | 110 | 0.66 | 0.58 | −12.1% | 5.5 h | 4/5 | 1.38 | **Red** | Squat 12% below profile, third straight day of elevated work |
| R. Ikeda | Back squat | 95 | 0.78 | 0.79 | +1.3% | 7.5 h | 2/5 | 0.94 | Green | On profile, proceed as written |
| T. Barr | Bench press | 85 | 0.36 | 0.31 | −13.9% | 7 h | 2/5 | 1.05 | Amber | Velocity down but wellness normal, verify the load entered |

Predicted comes from C, actual from B, sleep and soreness from the only new athlete-facing
capture this design requires, workload from G. **The third row is the honest case.** When the
physical and subjective signals disagree, the likeliest explanation is a mistyped load, so the
system says that rather than inventing a physiological story.

### E — Prescription against actual (what coaching staff check first)

| Exercise | Target load | Target | Target zone | Stop at | Actual load | Reps done | Best vel | Verdict |
|---|---|---|---|---|---|---|---|---|
| Back squat | 110 | 5 × 5 | 0.65–0.72 | 20% | 110 | 5, 5, 5, 3 | 0.66 | Partial, set 4 ended at the stop condition |
| Bench press | 85 | 4 × 6 | 0.45–0.55 | 20% | 85 | 6, 6, 6, 6 | 0.47 | Complete and in zone |
| Hang clean | 70 | 5 × 3 | >1.10 | 10% | 70 | 3, 3, 3, 3, 3 | **0.96** | **Every set below zone, load too heavy for the intent** |

**The hang clean row is the product.** The athlete completed every prescribed rep, so any
compliance view built on counting reps calls this a perfect session. Measured against intent it
is a failed session, because a lift programmed for speed was never moved at speed. We cannot
express this at all today, because `workout_plans.exercises` is free-form JSON with no target
velocity and no stop condition.

### F — Exercise reference (the small table that makes the rest interpretable)

| Exercise | Min velocity | Strength zone | Power zone | Speed zone | Plausible load | Under one global rule |
|---|---|---|---|---|---|---|
| Back squat | 0.30 | 0.30–0.50 | 0.50–0.75 | >0.75 | 40–220 | roughly correct by luck |
| Bench press | 0.17 | 0.17–0.35 | 0.35–0.60 | >0.60 | 20–180 | **a true max is called fatigue** |
| Hang clean | 0.70 | not trained here | 0.90–1.20 | >1.20 | 30–140 | **a failed rep is called fresh** |

The only other dataset requiring new writes, and it is perhaps thirty rows a coach fills in
once. It replaces the `0.85` and `0.40` constants that currently govern every recommendation we
make. The last column is why that matters: a maximal bench press at 0.17 m/s trips a global 0.40
threshold and is reported as fatigue, while a hang clean at 0.40 is so far under its own 0.70
minimum that it barely qualifies as the movement, and the same rule reports it as fine.

### G and H, in one line each

**Workload** is a 7-day against 28-day exposure ratio per athlete, computed on mechanical work
from dataset B rather than a rep count, so a heavy low-volume day is not scored as rest.
**Group norms** are percentile and standard-score positions per cohort, exercise and metric,
which is what turns a number into a judgement when a coach has no history on a new athlete.

> Six of the eight datasets are views over data we already hold. The two that need new writes
> are a wellness check-in with four fields and a reference table a coach fills in once.

---

## 06 — Where to place the bet

| | Option A — match the metric list | **Option B — own the autoregulation loop** | Option C — become an AMS |
|---|---|---|---|
| **What** | Peak velocity, power, bar path, eccentric metrics. Parity with published spec sheets. | Profile, e1RM, readiness index, prescribed load, computed from ordinary working sets with no separate testing day. | Wellness, workload and injury tracking, the full monitoring suite. |
| **Assessment** | Necessary, and cheap once we are already inside the signal chain. But a $65/yr phone app ships this list. Buys permission to compete, not a reason to win. | Mostly analysis code on data we already hold. Answers the question coaches actually ask. Because we own the chain from raw depth frames upward, we can push it further than a fixed-firmware competitor can follow. | Broad, crowded and slow. Established systems have a decade of integrations. We would be third-best at something we do not need to own, and it would starve Option B. |
| **Verdict** | Do it, but not first | **Recommended wedge** | Thin slice only |

Take **B** as the wedge, the smallest useful slice of **C** for readiness credibility (a
four-field wellness check-in and a workload ratio), and **A** opportunistically because the
marginal cost is low once the phone signal chain is open.

### Sequence

1. **Enable row-level security.** Nothing else is commercially real while an anonymous key
   returns the whole reps table. One of our three coaches also has a null `coaches.team_id` and
   will lose all visibility the moment policies activate, so that row needs fixing in the same pass.
2. **Retire the cross-exercise average.** Split every velocity view by exercise and rebuild
   baselines per lift. Removes a misleading headline number and is a precondition for everything
   downstream.
3. **Build the load–velocity profile engine.** Per athlete per lift, from the load and velocity
   columns already populated. Surface slope, fit quality, e1RM and profile age, and refuse to
   show a profile whose load spread is too narrow to trust.
4. **Add prescription and reconciliation.** Target load, reps, velocity and a velocity-loss stop
   condition on the plan, measured against what the athlete actually did.
5. **Harvest the remaining Tier 0 metrics.** Power, work, TUT, eccentric ratio, displacement
   consistency, relative intensity. All arithmetic on existing columns.
6. **Open the phone signal chain.** Peak velocity, MPV, velocity–time curve, bar path. Start
   storing the curve early, because it is the one thing that cannot be back-filled.
7. **Ship the readiness board.** Profile deviation plus wellness, one light per athlete per day,
   with the reason attached to the light.
8. **Then reporting, norms, export and integrations.** The Tier 4 work that turns a good
   dashboard into something a professional organisation can adopt.

---

## 07 — Three questions I cannot answer from the code

**Can we trust the load number?** The entire Option B chain rests on `reps.weight` being
accurate. Today it is read in one place and validated nowhere, so it has never had to be right.
If athletes mistype load, every profile, e1RM and readiness flag we compute is confidently
wrong. Before building on it: how is load entered on the phone, and can it be plate-detected,
defaulted from the prescription, or at least sanity-checked against the profile?

**Who is the buyer?** Professional and collegiate programmes make Tier 4 mandatory and slow
everything down. High schools and private facilities make Tier 3 reporting and engagement matter
far more than governance. The list is the same either way; the order changes completely.

**Can the depth camera see a jump?** If a rack-mounted sensor can measure CMJ height and RSI,
that is the fastest route to the testing-battery breadth that currently wins deals we are never
invited to. If it cannot, we should stop treating that segment as reachable and concentrate on
being the best barbell system in the room.

---

## 08 — What the coach actually gets, workflow by workflow

Analytics for coaches sits on five rungs. **Descriptive** says what happened. **Comparative**
says whether it was normal for this athlete. **Diagnostic** says why. **Prescriptive** says what
to do next. **Predictive** says who is about to break.

We are on rung one, with a piece of rung two in the deviation panel. Perch and Output Sports are
selling rung four. That gap, not the metric count, is what a coach feels in a demo. Rungs two
through four are analysis code over data we already store.

**Writing the week's loads.** Today a coach works from percentages of a 1RM tested weeks ago.
That number decays silently, so an athlete who has gained or lost strength trains at the wrong
intensity and nobody knows which. Coaches hedge with wide ranges and adjust by eye. A
competitor's profile refreshes the max every session so percentages track the athlete. Our
average velocity cannot be converted into a load, so it cannot enter this workflow at all.

**The decision inside the set.** Today the coach watches the bar and calls it. Research on
coaches judging velocity loss by eye finds error rates that shift with the threshold and gaze
strategy. One coach covering four racks and twenty athletes sees maybe a quarter of the sets.
Competitors put a target on a screen, let the athlete self-regulate, and end the set at a
velocity-loss threshold. We cannot participate at all, because nothing reaches the server until
the athlete taps Finish. Coaching attention is the scarcest resource in the room; this one change
takes a coach from watching four racks to supervising twelve.

**Deciding who to modify today.** Today it is a question about sleep and a look at their face.
Our deviation panel is genuinely close, because it already flags an athlete whose velocity or
fatigue has moved off their own baseline. What it cannot do is say why or what to change, because
it has no load context. Velocity at a known load against the profile's prediction turns a warm-up
set into a physical readiness measurement, taken *before* the athlete does the work.

**Testing maxes.** A test day costs a full session per squad, carries injury risk, and produces a
number distorted by how the athlete felt that morning. Estimated maxes from ordinary sets make
testing optional. For a 40-athlete squad running three test blocks a year, that is reclaimed
training time a buyer can put a figure on.

**Proving the block worked.** The strength coach's contribution is the hardest in the building to
evidence. When a head coach asks whether the programme is working, the honest answer today is
anecdote plus a tonnage spreadsheet. Competitors ship automated per-athlete and per-group reports
because this is career security for the person signing the contract. Badly underrated as a
purchase driver.

**Return to play.** Progression decisions get made on time since injury and subjective tolerance.
Velocity at submaximal load and limb asymmetry are the objective signals and most rooms lack
them. This is also where professional budget actually sits, because medical and performance share
it. Unreachable until athletic trainers can log in at all, which is why the buyer question in §07
reorders everything.

Worth naming separately: athletes grinding reps with no intent is the cheapest performance loss
in any weight room, and a live number on a screen fixes it. Competitors refresh a leaderboard
every thirty seconds for exactly this reason.

### Where we would lead rather than catch up

Doing all of the above reaches parity. Four things could put us ahead:

1. **We see depth, and we throw it away.** An athlete losing 8% of squat depth by rep five is a
   coaching cue, not just a load decision, and it often appears before velocity moves. A
   wrist-worn sensor cannot see it and most transducer setups never surface it. This is rung
   three, and it is the one place our hardware choice is an advantage rather than a constraint.
2. **Nothing to wear.** One device per rack, nothing to charge, distribute, lose, or attach to
   the correct athlete. On a 90-player roster that is an operations argument a wearable
   competitor cannot answer.
3. **Our metric set is a software release.** Firmware computes nothing and streams raw frames, so
   "can you also show me X" can be yes within a sprint. Competitors are bounded by what their
   device chose to emit years ago.
4. **Willingness to not answer.** Every coach has been burned by a confidently wrong e1RM. A
   system that withholds a profile when the load spread is too narrow earns trust that compounds,
   and none of the automatic-profile competitors do this.

---

## 09 — The predictive layer, and what it needs to be defensible

The two signals worth building around are **longitudinal progression at fixed load** (is the
athlete faster and more consistent at the same weight, and therefore due a load increase) and
**acute negative deviation** (velocity below normal, so someone should look). Those cover both
directions a coach cares about.

One reframe first. This is monitoring and prescription, which is defensible and valuable. Genuine
prediction, meaning this athlete will be at this number in six weeks, is a far weaker claim and
sport scientists will push on it. Position it as predicting **training response and readiness**,
not performance or injury.

### What both signals need before they work

**A noise floor.** "Have they gotten faster" and "velocity is lower than usual" are both
unanswerable until you know how much variation is normal for that athlete on that lift. Velocity
at fixed load moves day to day for reasons unrelated to fitness. Without a typical error per
athlete per exercise you ship false progression calls and false flags in roughly equal number,
and coaches stop reading them within a fortnight.

This is what makes the product research-backed rather than plausible. You need the within-athlete
coefficient of variation and a smallest worthwhile change derived from it. The current deviation
panel compares against a rolling 7-session standard deviation, which is a reasonable start, but
that band mixes real biological variation with measurement error and cannot separate them.

If an athlete's squat at fixed load varies 4% day to day, a 3% gain is nothing and a 12% drop is
real. **Every threshold in the product should be expressed in multiples of that number, not in
absolute m/s.**

**A slope, so the answer has a unit.** The progression question ends in "do they increase
weight," and the load-velocity slope is what turns the observation into a number:

| | |
|---|---|
| Velocity at 110 kg, six weeks ago | 0.66 m/s |
| Velocity at 110 kg, today | 0.72 m/s |
| Slope for this athlete on this lift | 0.008 m/s per kg |
| Warranted load increase | 7.5 kg |

Without the slope you are guessing at the increment, which is what percentage-based programming
already does.

**A differential, so the flag survives contact with a coach.** A low-velocity day has at least
six causes needing opposite responses:

| Cause | What confirms it |
|---|---|
| Accumulated fatigue | Workload ratio elevated |
| Illness or poor sleep | Wellness check-in |
| Mistyped load | Value is off the profile entirely, not slightly below |
| Technique breakdown | ROM and rep-to-rep spread, not the mean |
| Emerging injury | One lift or one limb affected, others normal |
| Detraining | Persists across sessions instead of resolving |

The value is not the flag, it is narrowing to the cause. A flag with no differential gets ignored.

### The remaining gaps

**Which way the profile moved is the strongest output.** What changing velocity tells us about
load needs the whole line, not one point. A line that lifts without changing angle means
improvement at every load. A line that **flattens** means improvement at the heavy end, a genuine
strength gain. A line that **steepens** means faster at light loads while the heavy end stalled,
so the block built speed and not force. That distinction tells the coach what to programme next
and is the most defensible prescriptive claim available to us.

**Consistency is a leading indicator, not a version of velocity.** Falling rep-to-rep spread at
fixed load is motor learning. Rising spread while the mean holds steady is usually the earliest
sign of fatigue or a developing problem, appearing *before* mean velocity moves. Its own signal,
its own threshold. Range-of-motion spread belongs here too, and it is the one where our depth
sensor beats a wearable.

**Four time horizons, four questions.** Within the set, should this set end. Within the session,
is the next set worth doing. Within the week, are they recovering between exposures. Within the
block, did the profile move and which way. Most systems answer the first and the last and skip
the middle two, which is where the coach actually lives.

**Individualised dose response.** Once a prescribed velocity loss per set is recorded and the
profile shift over the block is measured, you can learn which loss threshold produces the most
gain for each athlete. The literature supports lower thresholds for strength and power and higher
ones for hypertrophy, but individual response varies. Learning each athlete's own responsive dose
is genuinely novel and nobody in this market does it well.

**The cold start.** A new athlete has no baseline and no profile, which is exactly when a coach
most wants help and when every monitoring system is silent. Position and training-age norms cover
the first few weeks. This is also the scenario that kills demos.

**Confounds that break naive comparison.** Same weight is not the same stimulus if the exercise
came later in the session, followed a heavier accessory, used a different tempo cue, or had
shorter rest. Compare like for like on exercise, set position and prior volume, or you will flag
an athlete who merely squatted after deadlifts instead of before.

**Validate the claim.** If the product asserts prediction, hold out data and check whether flags
actually preceded something, and whether profile-based load prescription beat percentage-based in
your own athletes. A small internal validation becomes a sales asset, because professional staff
will ask and no competitor volunteers the answer.

### What the research supports, and what it does not

| Claim | Standing |
|---|---|
| Velocity at fixed load reflects current strength | Solid |
| Within-set velocity loss reflects acute fatigue and shapes adaptation | Solid, with thresholds |
| Load–velocity profile estimates 1RM | Solid within an exercise, weak across exercises |
| Barbell velocity predicts sprint speed or on-field performance | Weak and sport-specific — do not claim |
| Workload ratios predict injury | Contested — frame as monitoring, never prediction |

---

## 10 — Dashboard cleanup and the immediately shippable metric set

Audited against what the dashboard actually renders, not against what the services compute. Three
findings frame the rest: `mockData.ts` has no importers, three `statsService` functions are never
called, and several computed stats are never displayed anywhere.

### 10.1 Remove — dead or fabricated

| # | Target | Why |
|---|---|---|
| 1 | `src/data/mockData.ts` (483 lines) | Zero importers. Contains hardcoded `avgTeamLoad: 89`, `topPerformer: "Emma Smith"`, `lowestAttendance: 80`. Dead weight and a hazard if re-imported. |
| 2 | `src/components/SummaryStrip.tsx` (22 lines) | Never imported anywhere. |
| 3 | `getTeamPerformanceSummary()` — `statsService.ts:250` | Never called, **and broken**: selects only `average_rep_speed, exercise_name` then filters on `r.session_id`, which is not selected, so `improvementRate` is always exactly 0. Also splits sessions by array position rather than date, so the comparison would not be chronological even if the field existed. |
| 4 | `getWeeklyActivity()` — `statsService.ts:200` | Never called. |
| 5 | `getSessionCount()` — `statsService.ts:160` | Never called. |
| 6 | `avgTeamLoad` on `DashboardStats` | `statsService.ts:139` assigns it `avgAttendance` with the comment "Team load is essentially attendance." It is not, and it is never rendered. Delete rather than rename. |
| 7 | `topPerformer` | Computed as the athlete with the highest *attendance*, which is not performance. Never rendered. |
| 8 | `lowestAttendance` | Computed, never rendered. |
| 9 | `engagement` — `playersService.ts:16,298` | Invented composite: `attendance >= 90 && avgVelocity >= 0.7`, using a cross-exercise velocity average. Never rendered. |
| 10 | `targetVelocityMin/Max` fallback — `sessionsService.ts:153-154` | Set to the athlete's own average ±0.15, so it is circular and they always land inside the zone. Renders as a shaded band with reference lines that reads as a real prescription. Keep the path reading genuine targets from the plan (`AthleteDetailPanel.tsx:900`); when no plan target exists, draw no band. |

### 10.2 Verify — probably real but unproven

| # | Target | Question |
|---|---|---|
| 11 | `reps.weight` | Accuracy **and** unit. `weightUnit` is hardcoded `'lbs'` at `sessionsService.ts:171` while the domain language is kg. **Gates most of §10.4 — do this first.** |
| 12 | `avgVelocity`, `avgROM`, `avgTempo`, `loadRec` on `PlayerWithStats` | A per-player rep query computes all four; `AthleteTable.tsx:61-63` renders only name, group, attendance. Surface them or stop paying for the query. |
| 13 | "Workout Sessions" card — `Index.tsx:215` | Shows `attendanceSummary.totalTrackedCount`, which counts *planned workouts*, not sessions. Decide what the coach should see. |
| 14 | "Average Attendance" card | A pooled completed-over-planned ratio, not the mean of per-athlete rates. These differ whenever athletes have different plan counts. Pick one and label it. |
| 15 | `sessions.team_id`, `sessions.coach_id` | Always null. Confirm nothing filters on them. |
| 16 | `machine_name` | Never populated anywhere. Drop from types and UI, or start writing it. |
| 17 | `ended_at` | Hardcoded to `23:59:59`, so session duration is not computable. Verify before showing any duration. |
| 18 | `players.level` (`'Varsity' \| 'JV'`) | No UI reads it. Confirm it is not a leftover from a school-specific build. |

Also outstanding from `DB_GUIDE.md`: one of three coaches has a null `coaches.team_id` and will
lose all visibility the moment RLS is enabled. Fix in the same pass.

### 10.3 Modify — real signal, wrong presentation

| # | Target | Change |
|---|---|---|
| 19 | `peakVelocity` — `sessionsService.ts:150` | It is `Math.max` over `average_rep_speed`, i.e. the fastest *mean* rep, not peak velocity. **Rename to "Best Rep" everywhere**, including the label at `AthleteDetailPanel.tsx:573`. A coach cross-checking against GymAware sees a number that disagrees, and we gain nothing from the label. |
| 20 | `velocityDropOff` KPI — `AthleteDetailPanel.tsx:751-758` | Flattens every rep of every exercise into one array and compares first to last, so it can compare a squat rep to a curl rep. Point it at `sessionVelocityDropoff`, which already does this correctly per exercise, or remove it. |
| 21 | `exercise.weight` — `sessionsService.ts:130` | Takes the first rep's load for the whole exercise. Wrong in any session where load changes across sets. Show load per set. |
| 22 | `reps` — `sessionsService.ts:169` | `Math.round(totalReps / sets)`; the comment admits it is estimated. A 5/5/5/3 session displays as 5. Show actual per-set counts. |
| 23 | `sets` — `sessionsService.ts:127` | `Math.max` of `set_number` overcounts if numbering skips. Count distinct set numbers. |
| 24 | Cross-exercise `avgVelocity` as a headline | Surface the caveat the code already carries internally, and preferably split by exercise. See §01. |
| 25 | `loadRec` — `playersService.ts:286-289` | Pull the recommendation entirely until per-exercise reference values exist (dataset F, §05). Showing nothing beats showing a wrong prescription. |
| 26 | **Do not touch** | The deviation panel, within-set dropoff, session fatigue and sparklines in `athleteSummaryUtils.ts` are the genuinely sound analytics in the codebase. They survive the cleanup unchanged. |

### 10.4 Metrics we can present immediately

Arithmetic on columns already stored. No thresholds, no recommendations, no profile. Everything
here must be scoped **per exercise** — pooled across exercises none of it means anything.

| Grain | Ship now |
|---|---|
| **Per rep** | Mean concentric velocity, ROM, concentric duration (all stored today). Add eccentric duration, which is queried at `playersService.ts:255` and discarded. Then time under tension (con + ecc) and the eccentric:concentric ratio as a tempo-control read. Mean concentric power and work per rep follow from load, velocity and displacement once #11 is verified. |
| **Per set** | Best rep velocity, mean set velocity, velocity loss first-to-last rep, actual reps completed, load for *that* set, volume load, total work, total TUT, and coefficient of variation for both velocity and ROM. Ship the two consistency figures as plain descriptive numbers with no threshold attached yet. |
| **Per exercise per session** | Set count, actual total reps, volume load, total work, best rep, mean of the per-set bests. |
| **Per session** | Total volume load, total work, total TUT, total reps, exercises performed. |
| **Over time, descriptive only** | Weekly volume load, weekly work, weekly TUT, ROM at a given load. |

**Build one chart before any of the others: mean velocity for one exercise at one load, plotted
across sessions.** It answers "same weight, have they gotten faster" directly with no regression,
no threshold and no modelling, and it is the seed the profile grows from later. It is a filter and
a line.

**Held back for the refinement pass:** estimated 1RM, load-velocity slope, readiness scoring, load
recommendations, velocity zones, workload ratios, group norms, and every flag or traffic light.
All of them need the exercise reference table (§05 dataset F) and the noise floor (§09) first.

**One dependency, stated plainly.** Verifying `reps.weight` gates power, work, volume load and the
anchor chart above, which is most of the value in this list. If load turns out to be unreliable,
the immediately shippable set shrinks to velocity, ROM and the timing metrics.

---

## Sources

- [GymAware — VBT buyers guide 2026](https://gymaware.com/velocity-based-training-buyers-guide/)
- [VALD acquires GymAware](https://valdperformance.com/news/vald-acquires-gymaware-bringing-the-gold-standard-in-velocity-based-training-into-the-worlds-leading-performance-technology-ecosystem)
- [VALD — velocity-based training 101](https://valdperformance.com/news/velocity-based-training-101)
- [Perch system overview](https://perch.catapultsports.com/hc/en-us/articles/13219205902223-Perch-System-Overview)
- [Catapult on Perch in the weight room](https://www.catapult.com/blog/the-ultimate-edge-in-weight-room-technology-why-perch-stands-out)
- [Output Sports — twelve measurement modules](https://www.outputsports.com/blog/unlocking-athletic-potential-exploring-output-sports-12-measurement-modules)
- [Output Sports — autoregulation with VBT](https://www.outputsports.com/blog/autoregulation-with-velocity-based-training)
- [VBTcoach — device comparison and pricing](https://vbtcoach.com/blog/velocity-based-training-devices-buyers-guide)
- [Metric — load-velocity and load-power profiles](https://metric.coach/docs/load-velocity-power-profiles)
- [Why a load-velocity profile matters](https://www.themovementsystem.com/blog/beyond-the-speedometer-why-your-vbt-strategy-needs-a-load-velocity-profile)
- [Load and volume autoregulation — meta-analysis](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8762534/)
- [Velocity-loss thresholds and perceived exertion](https://journals.sagepub.com/doi/10.1177/17479541251339905)
- [Velocity zones and their limits](https://simplifaster.com/articles/velocity-based-training-chart-zones/)
- [TeamBuildr — AMS feature set](https://www.teambuildr.com/platform-ams)
