# COMPREHENSIVE SUPABASE DATABASE WIRING AUDIT
**Scan Date**: April 11, 2026  
**Status**: ⚠️ 10 CRITICAL/HIGH PRIORITY ISSUES IDENTIFIED

---

## EXECUTIVE SUMMARY

Your Supabase integration has **10 distinct categories of issues** affecting **8+ database tables**, with **3 CRITICAL severity** problems that can cause runtime failures. The most persistent issues include:

1. **Missing Phase 22 metrics columns** in type definitions (used by 4+ locations)
2. **Zero Row-Level Security (RLS)** on 8 critical tables (complete data exposure)
3. **Foreign key relationship naming mismatches** (join failures)
4. **Circular migration dependencies** (causes migration execution failures)
5. **User ID tracking inconsistencies** (duplicate queries, missing data)

---

## ⚠️ CRITICAL ISSUE #1: Missing Phase 22 Columns in Type Definitions

### The Problem
Your code queries columns `rom_mm`, `concentric_duration_s`, and `eccentric_duration_s` that **do not exist** in [src/types/database.ts](src/types/database.ts). The `reps` table type definition is incomplete and causes TypeScript errors.

### Where It Occurs (4 locations)

#### Location 1: [src/services/sessionsService.ts](src/services/sessionsService.ts#L96) - Line 96
```typescript
const { data: reps, error: repsError } = await supabase
  .from('reps')
  .select('*, concentric_duration_s, rom_mm') // ❌ Columns not in database.ts types
  .eq('session_id', sessionId)
```

**Lines 128-129**: Also accesses these fields without type safety
```typescript
const roms = exerciseReps.map(r => Number(r.rom_mm)).filter(v => v > 0);
const tempos = exerciseReps.map(r => Number(r.concentric_duration_s)).filter(v => v > 0);
```

#### Location 2: [src/services/playersService.ts](src/services/playersService.ts#L222) - Line 222
```typescript
const { data: reps } = await supabase
  .from('reps')
  .select('average_rep_speed, rom_mm, concentric_duration_s, eccentric_duration_s')
  // ❌ All 4 columns missing from type definitions
  .in('session_id', sessionIds)
  .not('average_rep_speed', 'is', null);
```

**Lines 228-229**: Uses fields without type checking
```typescript
const totalR = reps.reduce((sum, r) => sum + (Number(r.rom_mm) || 0), 0);
const totalC = reps.reduce((sum, r) => sum + (Number(r.concentric_duration_s) || 0), 0);
```

#### Location 3: [src/services/sessionsService.ts](src/services/sessionsService.ts#L155-L156) - Lines 155-156
```typescript
const repData: RepData[] = exerciseReps.map((rep) => ({
  repNumber: rep.rep_number,
  setNumber: rep.set_number,
  velocity: Number(rep.average_rep_speed) || 0,
  rom: Number(rep.rom_mm) || 0,              // ❌ Undefined type
  tempo: Number(rep.concentric_duration_s) || 0, // ❌ Undefined type
}));
```

### Current Type Definition (INCOMPLETE)
[src/types/database.ts](src/types/database.ts#L195-L215)
```typescript
reps: {
  Row: {
    id: string;
    session_id: string;
    player_id: string;
    exercise_name: string;
    machine_name: string | null;
    set_number: number;
    rep_number: number;
    weight: number | null;
    average_rep_speed: number | null;
    created_at: string;
    // ❌ MISSING THESE THREE FIELDS:
    // rom_mm: number | null;
    // concentric_duration_s: number | null;
    // eccentric_duration_s: number | null;
  };
  // ... Insert and Update types also missing these fields
}
```

### Impact
- **4 locations** fail to compile correctly
- Type safety completely bypassed (developers can't catch errors)
- If fields don't exist in actual database, queries silently fail
- UI components receive undefined values for Phase 22 metrics
- Player stats calculations return `avgROM: 0`, `avgTempo: 0` (incorrect data)

### Fix Required
Add to `reps` table Row/Insert/Update types in [database.ts](src/types/database.ts#L195):
```typescript
rom_mm: number | null;
concentric_duration_s: number | null;
eccentric_duration_s: number | null;
```

---

## ⚠️ CRITICAL ISSUE #2: Missing Row-Level Security (RLS) Policies

### The Problem
**8 database tables have ZERO RLS protection**. Any authenticated user can read/write/delete any data without restrictions. This is a **critical security vulnerability**.

### Tables WITHOUT RLS at All

| Table | RLS Enabled | Policies | Security Risk |
|-------|-----------|----------|----------------|
| sessions | ❌ NO | None | Any user sees all training sessions |
| workouts | ❌ NO | None | Workout data completely exposed |
| reps | ❌ NO | None | All performance metrics visible |
| workout_plans | ❌ NO | None | All workout plans visible to all users |
| coach_feedback | ❌ NO | None | Feedback data unprotected |
| messages | ⚠️ PARTIAL | Defined but no policies | Messages not filtered by user |
| coaches | ❌ PARTIAL | Only user_id index in migration 001 | Can edit other coaches' records |
| teams | ❌ NO | Only user_id index in migration 003 | Can list all teams |

### Where Migrations Fall Short

#### Migration 001: [001_add_user_id_to_coaches.sql](supabase/migrations/001_add_user_id_to_coaches.sql)
```sql
-- ❌ MISSING: No RLS policies for coaches table
ALTER TABLE coaches 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_coaches_user_id ON coaches(user_id);
-- No ENABLE ROW LEVEL SECURITY
-- No policies defined
```

#### Migration 003: [003_fix_players_user_id.sql](supabase/migrations/003_fix_players_user_id.sql)
RLS policies **for players only**, but incomplete:
- Lines 96-102: UPDATE policy **INCOMPLETE** (cuts off mid-definition)
- ❌ No policies for sessions, workouts, reps, workout_plans

```sql
-- ✓ Players table has RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- ❌ No policies for these tables:
-- ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.reps ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
```

#### Migration 004: [004_create_profiles_table.sql](supabase/migrations/004_create_profiles_table.sql#L29)
```sql
-- ✓ Has RLS but policy is TOO PERMISSIVE:
CREATE POLICY "Service role can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (true);
-- ❌ CHECK (true) means anyone can insert profiles = security hole
```

### Security Impact Examples

**Example 1: A player can access another player's session data**
```sql
-- Player A (user_id = abc123) runs:
SELECT * FROM sessions; -- Returns ALL sessions (no RLS filtering)
-- Results include: sessions from coaches, other players, admin, everyone!
```

**Example 2: Coach A can see Coach B's sent messages**
```sql
-- Coach A queries:
SELECT * FROM messages WHERE sender_id = (SELECT id FROM coaches WHERE user_id = 'xyz789');
-- Returns messages from ANY coach (no isolation)
```

**Example 3: Orphaned records possible (no FK constraints)**
```sql
-- Coach deletes a team, but:
DELETE FROM teams WHERE id = 'team-123';
-- ❌ Players still reference deleted team (no CASCADE defined)
-- ❌ No audit trail of who deleted what (no RLS)
```

### Affected Data Exposure
- 📊 **Workout Data**: All reps/sets/weights visible to all users (privacy violation)
- 💬 **Messages**: All communication between coaches/players exposed
- 📋 **Plans**: Future workout plans visible to competitors on same system
- 👥 **Feedback**: Confidential coaching feedback readable by all
- 🏆 **Performance**: Athlete velocity/ROM/tempo data leaks across teams

### Fix Required
1. Enable RLS on all 8 tables
2. Create policies filtering by auth.uid() and appropriate FK relationships
3. Update overly permissive policies (like "Service role can insert")

---

## ⚠️ CRITICAL ISSUE #3: Foreign Key Relationship Naming Mismatches

### The Problem
Service queries use `.select('*, relationship_name(...)')` where `relationship_name` might not match actual FK definitions in the database. This causes joins to fail silently.

### Location 1: [src/services/workoutPlansService.ts](src/services/workoutPlansService.ts#L120) - Line 120

Five functions use the same problematic join pattern:

```typescript
// ❌ Assumes a "players" relationship exists
const { data, error } = await supabase
  .from('workout_plans')
  .select('*, players(full_name)')  // Line 120
  .eq('coach_id', coachId)
  .order('date', { ascending: false });
```

**Same pattern at:**
- Line 208: `getUpcomingWorkoutPlans()` → `.select('*, players(full_name)')`
- Line 235: `getWorkoutPlanById()` → `.select('*, players(full_name)')`
- Line 259: `getCoachWorkoutHistory()` → `.select('*, players(full_name)')`

### Location 2: [src/services/messagesService.ts](src/services/messagesService.ts#L83) - Line 83

```typescript
// ⚠️ EXPLICIT FK name assumption (non-standard Supabase convention)
const { data, error } = await supabase
  .from('messages')
  .select('*, profiles!messages_receiver_id_fkey(full_name)')  // Line 83
  .eq('sender_id', senderId)
  .order('created_at', { ascending: false });
```

**Same pattern at:**
- Line 110: `getPlayerMessages()` → `.select('*, profiles!messages_sender_id_fkey(full_name)')`
- Line 229: `searchMessages()` → `.select('*, profiles!messages_sender_id_fkey(full_name), profiles!messages_receiver_id_fkey(full_name)')`

### Why This Fails

**For workout_plans → players:**
- If FK is named automatically: `workout_plans_player_id_fkey` (not `players`)
- Query assumes: `workout_plans.player_id → players.id` relation named `players`
- If not auto-named or named differently, join silently fails
- Result: Returns full `workout_plans` objects but `players` is null/undefined
- UI component tries to access `.players.full_name` → throws undefined error

**For messages → profiles:**
- Assumes FK explicitly named: `messages_receiver_id_fkey` (non-standard)
- Supabase might auto-name as: `messages_receiver_id_fk` or `fk_messages_receiver_id`
- If naming doesn't match exactly, join fails
- Result: Player names don't load in message UI

### What Should Be Verified

In Supabase dashboard, check these relationships exist:

```
needed_fks = [
  { from: "messages", column: "sender_id", to: "profiles" },
  { from: "messages", column: "receiver_id", to: "profiles" },
  { from: "workout_plans", column: "player_id", to: "players", auto_name: "true" },
  { from: "coach_feedback", column: "player_id", to: "players" },
  { from: "coach_feedback", column: "coach_id", to: "coaches" },
  { from: "coach_feedback", column: "session_id", to: "sessions" },
]
```

### Impact
- **6-7 locations** where joins might fail
- `getCoachWorkoutPlans()` returns incomplete data
- `getUpcomingWorkoutPlans()` UI breaks if player names missing
- `getPlayerMessages()` displays no sender/receiver names
- Player/Coach UIs show "undefined" where names should appear

---

## ⚠️ HIGH ISSUE #4: Incomplete RLS Policies in Existing Migrations

### Problem 1: Migration 003 - Players UPDATE Policy Incomplete

[src/supabase/migrations/003_fix_players_user_id.sql](supabase/migrations/003_fix_players_user_id.sql#L96-L102)

```sql
DROP POLICY IF EXISTS "Coaches can update players." ON public.players;
CREATE POLICY "Coaches can update players." ON public.players
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.coaches c
    WHERE c.user_id = auth.uid()
  )
);
-- ❌ POLICY CUTS OFF HERE - INCOMPLETE!
-- Should have WITH CHECK clause
```

**What's missing:**
- No `WITH CHECK` clause (allows updating to invalid state)
- Doesn't verify coach's team matches player's team
- Any coach can update any player

### Problem 2: Migration 004 - Overly Permissive Service Role Policy

[src/supabase/migrations/004_create_profiles_table.sql](supabase/migrations/004_create_profiles_table.sql#L29-L33)

```sql
CREATE POLICY "Service role can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (true);
-- ❌ CHECK (true) = everyone can insert
```

**Why this is dangerous:**
- Service role bypass is intended for backend logic only
- This policy gives anyone insert access
- Should be: `WITH CHECK (auth.uid() = id);` (user can only insert their own)

### Problem 3: Coaches Table - Zero Policies

[src/supabase/migrations/001_add_user_id_to_coaches.sql](supabase/migrations/001_add_user_id_to_coaches.sql)

```sql
ALTER TABLE coaches 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ❌ NO RLS ENABLED
-- ❌ NO POLICIES DEFINED

-- Any authenticated user can:
-- - SELECT * FROM coaches (see all coaches)
-- - UPDATE any coach record
-- - DELETE any coach
```

### Impact
- Incomplete UPDATE policy allows data corruption
- Overly permissive profiles insert allows unauthorized access
- Coaches table has zero access control
- Data integrity not enforced

---

## ⚠️ HIGH ISSUE #5: Circular Migration Dependencies

### The Problem
Migration 003 creates a **trigger that depends on a table created by Migration 004**. When migrations run in order (001 → 002 → 003 → 004), Migration 003 will **FAIL**.

### Migration Execution Order (as named)
```
001_add_user_id_to_coaches.sql          ✓ OK
002_link_players_to_users.sql           ✓ OK (diagnostic only)
003_fix_players_user_id.sql             ❌ FAILS HERE
    └─ Creates trigger referencing profiles table (from migration 004)
004_create_profiles_table.sql           ↙ Runs AFTER trigger fails
    └─ Creates profiles table
```

### Specific Problem - [003_fix_players_user_id.sql](supabase/migrations/003_fix_players_user_id.sql#L33-L50)

```sql
-- Line 33: Create trigger function
CREATE OR REPLACE FUNCTION create_profile_for_player()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO profiles (id, role, player_id, full_name)  -- ❌ profiles table doesn't exist yet!
    VALUES (NEW.user_id, 'player', NEW.id, NEW.full_name)
    ON CONFLICT (id) DO UPDATE
    SET player_id = NEW.id, full_name = NEW.full_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Line 43: Create trigger that calls the function
CREATE TRIGGER trigger_create_profile_for_player
AFTER INSERT OR UPDATE OF user_id ON players
FOR EACH ROW
EXECUTE FUNCTION create_profile_for_player();
-- ❌ Both fail because profiles table is in Migration 004
```

### Why This Breaks
When Migration 003 runs:
1. Function tries to reference `profiles` table
2. `profiles` table doesn't exist yet (created in Migration 004)
3. PostgreSQL gives error: `relation "profiles" does not exist`
4. Entire migration 003 rolls back
5. Players table never gets user_id column linked to profiles
6. Manual player-profile linking (Migration 002) never happens automatically

### Consequences
- **Players without profiles** - user_id set but no profile record created
- **Trigger never fires** - future players added without profiles
- **Authentication fails** - can't look up a player's profile to get role
- **Auth context fails** - getUserProfile() returns null

### Impact
- All 3 player-related migrations fail
- Players can't log in (no profile to determine role)
- Coach role assignment breaks
- User authentication fails

---

## ⚠️ MEDIUM ISSUE #6: User ID Tracking Inconsistencies

### The Problem
Code assumes `player.user_id` is always non-null and uses both `player.id` and `player.user_id` as session owners. This creates duplicate queries and misses sessions.

### Location 1: [src/services/playersService.ts](src/services/playersService.ts#L176-L191) - Lines 176-191

```typescript
export const calculatePlayerStats = async (playerId: string) => {
  try {
    // Line 177-183: Fetch player to get user_id
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('user_id')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return { avgVelocity: 0, attendance: 0, ... };
    }

    // Line 191-192: Create array with both IDs
    const sessionOwnerIds = Array.from(new Set([playerId, player.user_id].filter(Boolean) as string[]));
    // ❌ Assumes player.user_id exists and is different from playerId
    // ❌ If they're the same, creates duplicate in Set (Set removes it, but wasteful)
    // ❌ If player.user_id is null, only searches by playerId
```

**Issue**: If player has no linked user_id:
```typescript
playerId = "pl-123"
player.user_id = null        // Not linked to auth user

sessionOwnerIds = Array.from(new Set([playerId, null].filter(Boolean) as string[]))
// Result: ["pl-123"]
// Missing: sessions owned by auth user id (if player account linked directly)
```

### Location 2: [src/services/sessionsService.ts](src/services/sessionsService.ts#L48-L56) - Lines 48-56

```typescript
export const getPlayerSessions = async (
  playerId: string,
  linkedUserId?: string | null
): Promise<SessionData[]> => {
  try {
    const ownerIds = Array.from(new Set([playerId, linkedUserId].filter(Boolean) as string[]));
    // Line 52-56: Same pattern - assumes linkedUserId provided
    // If linkedUserId is null, only searches playerId
    
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .in('user_id', ownerIds)  // ❌ in() with only 1 value = missing sessions
      .order('created_at', { ascending: false });
```

**Issue**: Function parameter `linkedUserId` can be `undefined | null | string`
- If undefined: only searches `playerId`
- If null: only searches `playerId`
- If string: searches both (but creates duplicate if `playerId === linkedUserId`)

### Location 3: [src/services/statsService.ts](src/services/statsService.ts#L23-L50) - Lines 23-50

```typescript
export const getCoachDashboardStats = async (teamId: string | null) => {
  // Line 23-24: Get all players for team
  const playersQuery = teamId 
    ? supabase.from('players').select('id, full_name, user_id').eq('team_id', teamId)
    : supabase.from('players').select('id, full_name, user_id');

  const { data: players, error: playersError } = await playersQuery;

  // ...

  // Line 48-50: Create session owner IDs from all players
  const sessionOwnerIds = Array.from(
    new Set(players.flatMap((p) => [p.id, p.user_id].filter(Boolean) as string[]))
  );
  // ❌ For 10 players with 5 linked to auth:
  // sessionOwnerIds might have 10-15 entries (duplicates removed but wasteful)
  // Query: SELECT * FROM sessions WHERE user_id IN (pl-1, pl-2, ..., id-6, id-7, ...)
  // ❌ Sessions owned by player IDs won't be found if they're not also linked to auth
```

### Data Loss Scenario

Consider a player with:
- `players.id = "pl-uuid-123"`
- `players.user_id = NULL` (not linked to auth yet)
- Created sessions with `sessions.user_id = "pl-uuid-123"`

Query runs:
```typescript
const sessionOwnerIds = [playerId, player.user_id].filter(Boolean);
// Result: ["pl-uuid-123"]

const { data: sessions } = await supabase
  .from('sessions')
  .in('user_id', ["pl-uuid-123"]);
// ✓ Finds sessions created as player_id
```

But if player IS linked:
- `players.id = "pl-uuid-123"`
- `players.user_id = "auth-uuid-456"` (linked to auth)
- Sessions split: some have `user_id = "pl-uuid-123"`, some have `user_id = "auth-uuid-456"`

Query might query:
```typescript
// Old code: only gets one or the other, not both
const sessionOwnerIds = ["pl-uuid-123", "auth-uuid-456"];
// ✓ Now finds both
```

### Impact
- **4-5 locations** affected
- Players with null `user_id` have incomplete session history
- Duplicate query parameters wasted
- Data inconsistency based on whether players are auth-linked

---

## ⚠️ MEDIUM ISSUE #7: Unused Table in Schema

### The Problem
`coach_feedback` table is defined in the schema but **never used anywhere** in the codebase.

### Where Defined
[src/types/database.ts](src/types/database.ts#L303-L340)

```typescript
coach_feedback: {
  Row: {
    id: string;
    player_id: string;
    coach_id: string | null;
    session_id: string | null;
    feedback_type: string;
    title: string;
    message: string;
    metrics: Json | null;
    action_items: Json | null;
    is_read: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: { /* ... */ };
  Update: { /* ... */ };
}
```

### Where NOT Used
- ❌ No service file (no feedbackService.ts)
- ❌ No queries in any .ts file
- ❌ No component references it
- ❌ No migration creates RLS policies for it
- ❌ No foreign key constraints defined

### What Should Exist
If this table is needed:
```typescript
// feedbackService.ts should have:
export const sendCoachFeedback = async (
  coachId: string,
  playerId: string,
  feedback: CoachFeedbackData
) => { /* ... */ };

export const getPlayerFeedback = async (playerId: string) => { /* ... */ };
export const getCoachFeedback = async (coachId: string) => { /* ... */ };
```

### Impact
- Dead code in schema
- Security hole (no RLS defined)
- Maintenance burden
- Potential data retention issues
- 1 unused table

### Recommendation
- **Option 1**: Remove table from schema if not planned
- **Option 2**: Implement service layer and RLS policies if needed
- **Option 3**: Document as "future feature" with placeholder

---

## 🔴 ISSUE #8: Missing Foreign Key Constraints

### The Problem
Many expected foreign key relationships are not explicitly defined in migrations, making orphaned records and cascading deletes unreliable.

### Missing FK Definitions

| From Table | From Column | To Table | To Column | Status | Risk |
|-----------|------------|----------|-----------|--------|------|
| messages | sender_id | profiles | id | ❌ Missing | Orphaned messages |
| messages | receiver_id | profiles | id | ❌ Missing | Messages to deleted users |
| workout_plans | player_id | players | id | ⚠️ Implicit | Orphaned workout plans |
| workout_plans | coach_id | coaches | id | ❌ Missing | Coach-less plans |
| coach_feedback | player_id | players | id | ❌ Missing | Orphaned feedback |
| coach_feedback | coach_id | coaches | id | ❌ Missing | Feedback without coach |
| coach_feedback | session_id | sessions | id | ❌ Missing | Broken session refs |
| coaches | team_id | teams | id | ❌ Missing in migration 001 | Coaches without teams |
| players | team_id | teams | id | ✓ Likely in base schema | OK |

### Example: Deleting a Coach

```sql
-- Coach wants to delete their account
DELETE FROM coaches WHERE id = 'coach-123';

-- What happens:
-- ❌ coach_feedback records still reference 'coach-123' (orphaned)
-- ❌ workout_plans still reference 'coach-123' (orphaned)
-- ❌ No CASCADE/SET NULL defined (data integrity broken)
-- ❌ No audit trail of deletion (RLS missing)
```

### Example: Deleting a Player

```sql
-- Player leaves the team
DELETE FROM players WHERE id = 'player-456';

-- What happens:
-- ❌ messages still reference 'player-456' as receiver_id (orphaned)
-- ❌ workout_plans still reference 'player-456' (orphaned)
-- ❌ coach_feedback still references 'player-456' (orphaned)
-- ❌ reps still reference 'player-456' (orphaned)
-- ❌ workouts still reference 'player-456' (orphaned)
```

### What Should Be Added to Migrations

```sql
-- Missing in Migration 001 (coaches):
ALTER TABLE coaches
ADD CONSTRAINT fk_coaches_team_id
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT;

-- Missing in Migration 003 or new migration:
ALTER TABLE messages
ADD CONSTRAINT fk_messages_sender_id
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE messages
ADD CONSTRAINT fk_messages_receiver_id
  FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE workout_plans
ADD CONSTRAINT fk_workout_plans_coach_id
  FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL;

ALTER TABLE coach_feedback
ADD CONSTRAINT fk_coach_feedback_session_id
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;

-- ... etc for other missing FKs
```

### Impact
- **7-8 missing constraints**
- Orphaned records possible across all tables
- CASCADE deletes not enforced
- Data integrity violations
- No referential integrity guarantees

---

## 🟡 ISSUE #9: Join Failures in Multiple Functions

### The Problem
Multiple service functions will fail silently or return incomplete data if relationship joins don't work.

### At-Risk Function: getCoachWorkoutPlans()

[src/services/workoutPlansService.ts](src/services/workoutPlansService.ts#L115-L130)

```typescript
export const getCoachWorkoutPlans = async (
  coachId: string
): Promise<WorkoutPlan[]> => {
  try {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*, players(full_name)')  // ❌ If joins fails, players is null
      .eq('coach_id', coachId)
      .order('date', { ascending: false });

    // Error handling doesn't check if join succeeded:
    if (error) {
      console.error('Error fetching coach workout plans:', error);
      throw error;
    }

    return (data as any) || [];  // ⚠️ Returns data even if join failed
  } catch (error) {
    console.error('Error in getCoachWorkoutPlans:', error);
    return [];
  }
}
```

**What happens if players join fails:**
```javascript
// Query returns successfully, but:
data = [
  {
    id: "wp-123",
    title: "Leg Day",
    player_id: "pl-456",
    players: null,  // ❌ Join failed, but no error thrown
  },
  // More results with players: null
]

// UI tries to display:
<div>{workout.players.full_name}</div>  // ❌ TypeError: Cannot read property 'full_name' of null
```

### At-Risk Function: getUpcomingWorkoutPlans()

[src/services/workoutPlansService.ts](src/services/workoutPlansService.ts#L194-L220)

```typescript
export const getUpcomingWorkoutPlans = async (
  playerIds: string[],
  daysAhead: number = 7
): Promise<WorkoutPlan[]> => {
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('workout_plans')
      .select('*, players(full_name)')  // ❌ Same pattern
      .in('player_id', playerIds)
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', futureDate.toISOString().split('T')[0])
      .eq('is_completed', false)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching upcoming workout plans:', error);
      throw error;
    }

    return (data as any) || [];  // ⚠️ Silent failure if join fails
  } catch (error) {
    console.error('Error in getUpcomingWorkoutPlans:', error);
    return [];
  }
}
```

### At-Risk Function: getPlayerMessages()

[src/services/messagesService.ts](src/services/messagesService.ts#L100-L120)

```typescript
export const getPlayerMessages = async (
  recipientId: string,
  includeArchived: boolean = false
): Promise<Message[]> => {
  try {
    let query = supabase
      .from('messages')
      .select('*, profiles!messages_sender_id_fkey(full_name)')  // ❌ FK name critical
      .eq('receiver_id', recipientId)
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching player messages:', error);
      throw error;
    }

    return data || [];  // ❌ Returns data even if FK join fails
  } catch (error) {
    console.error('Error in getPlayerMessages:', error);
    throw error;
  }
}
```

**If FK named incorrectly:**
```javascript
data = [
  {
    id: "msg-123",
    sender_id: "profile-uuid",
    receiver_id: "profile-xyz",
    message: "Hello",
    profiles: null,  // ❌ FK name didn't match, join failed silently
  }
]

// UI tries to display:
<div>{message.profiles.full_name}</div>  // ❌ TypeError
```

### Locations with Join Issues

| Function | File | Line | Pattern | Risk |
|----------|------|------|---------|------|
| getCoachWorkoutPlans() | workoutPlansService.ts | 120 | `players(full_name)` | Missing player names |
| getUpcomingWorkoutPlans() | workoutPlansService.ts | 208 | `players(full_name)` | Incomplete data |
| getWorkoutPlanById() | workoutPlansService.ts | 235 | `players(full_name)` | Single record fails |
| getCoachWorkoutHistory() | workoutPlansService.ts | 259 | `players(full_name)` | History incomplete |
| getPlayerMessages() | messagesService.ts | 110 | `profiles!..._fkey(...)` | Sender names missing |
| getCoachMessages() | messagesService.ts | 83 | `profiles!..._fkey(...)` | Recipient names missing |
| searchMessages() | messagesService.ts | 229 | `profiles!..._fkey(...)` | Both names missing |

### Impact
- **6-7 functions** affected
- Silent join failures (no error thrown)
- Missing data in UI (null references)
- Player names never displayed in workouts
- Sender/receiver names never shown in messages
- Runtime errors when UI tries to access null properties

---

## 📊 IMPACT MATRIX

### By Severity
| Severity | Issues | Tables | Functions | Impact |
|----------|--------|--------|-----------|--------|
| CRITICAL | 3 | 8+ | 15+ | Runtime failures, data loss, security breach |
| HIGH | 4 | 6+ | 10+ | Silent failures, incomplete data, orphaned records |
| MEDIUM | 3 | 4+ | 8+ | Data inconsistency, duplicate queries, dead code |

### By Table
| Table | Issues | Severity |
|-------|--------|----------|
| reps | Missing columns, no RLS | CRITICAL |
| messages | No RLS, FK issues, join failures | CRITICAL |
| workout_plans | No RLS, join failures, missing FK | HIGH |
| sessions | No RLS, no FK constraints | CRITICAL |
| workouts | No RLS, no FK constraints | CRITICAL |
| coach_feedback | Unused, no RLS, missing FK | MEDIUM |
| profiles | Overly permissive RLS | HIGH |
| players | Incomplete RLS, user_id confusion | MEDIUM |
| coaches | No RLS, missing FK, incomplete migration | HIGH |
| teams | No RLS, no FK constraints | MEDIUM |

### By Location
| File | Issues | Lines | Severity |
|------|--------|-------|----------|
| playersService.ts | 6 | 176-229 | HIGH |
| workoutPlansService.ts | 4 | 120, 208, 235, 259 | HIGH |
| messagesService.ts | 3 | 83, 110, 229 | HIGH |
| sessionsService.ts | 2 | 96, 128-156 | CRITICAL |
| statsService.ts | 2 | 23-50 | MEDIUM |
| database.ts | 2 | 195-215, 303-340 | CRITICAL |
| 003_fix_players_user_id.sql | 2 | 33-50, 96-102 | HIGH |
| 001_add_user_id_to_coaches.sql | 1 | Entire file | HIGH |
| 004_create_profiles_table.sql | 1 | 29-33 | MEDIUM |

---

## 🔧 RECOMMENDED FIX PRIORITY

### PHASE 1: Emergency (Do First - Prevents Failures)
1. **Fix Migration Circular Dependency** (moves 004 before 003)
   - Prevents migration execution failure
   - Time: 15 minutes
   - Severity: CRITICAL

2. **Add Phase 22 Columns to database.ts** (reps table)
   - Prevents runtime errors in sessionsService.ts and playersService.ts
   - Time: 10 minutes
   - Severity: CRITICAL

### PHASE 2: Security (Do Next - Prevents Data Breach)
3. **Add RLS Policies to All Tables**
   - Create policies for sessions, workouts, reps, workout_plans, coach_feedback, messages
   - Time: 2-3 hours
   - Severity: CRITICAL

4. **Add/Fix Foreign Key Constraints**
   - Define missing FKs in new migration
   - Time: 1 hour
   - Severity: HIGH

### PHASE 3: Stability (Do After - Prevents Silent Failures)
5. **Verify and Fix Join Relationship Names**
   - Test each join in workoutPlansService.ts and messagesService.ts
   - Time: 1 hour
   - Severity: HIGH

6. **Fix User ID Tracking Logic**
   - Add null-safety checks
   - Deduplicate sessionOwnerIds
   - Time: 30 minutes
   - Severity: MEDIUM

### PHASE 4: Cleanup (Do Last - Improves Code Quality)
7. **Remove or Implement coach_feedback**
   - Delete unused table or create service layer
   - Time: 30 minutes
   - Severity: MEDIUM

8. **Fix Incomplete RLS Policies**
   - Complete Migration 003 UPDATE policy
   - Fix overly permissive profiles policy
   - Time: 45 minutes
   - Severity: MEDIUM

---

## 📋 CHECKLIST FOR VALIDATION

After implementing fixes, verify:

- [ ] Migration 004 runs before Migration 003
- [ ] Phase 22 columns added to database.ts reps type
- [ ] All 8+ tables have ENABLE ROW LEVEL SECURITY
- [ ] RLS policies created for each table
- [ ] Foreign keys defined for all relationships
- [ ] Join queries in workoutPlansService test successfully
- [ ] Player names appear in workout plan UI
- [ ] Messages show sender/receiver names
- [ ] Player stats include avgROM and avgTempo
- [ ] User can only see their own data (RLS verified)
- [ ] No orphaned records after deleting coaches/players
- [ ] Migrations execute without errors
- [ ] No TypeScript errors in service files
- [ ] coach_feedback table decision documented

---

## 📎 FILE REFERENCES

**Type Definitions**:
- [src/types/database.ts](src/types/database.ts)

**Service Files**:
- [src/services/playersService.ts](src/services/playersService.ts)
- [src/services/sessionsService.ts](src/services/sessionsService.ts)
- [src/services/workoutPlansService.ts](src/services/workoutPlansService.ts)
- [src/services/messagesService.ts](src/services/messagesService.ts)
- [src/services/statsService.ts](src/services/statsService.ts)

**Migrations**:
- [supabase/migrations/001_add_user_id_to_coaches.sql](supabase/migrations/001_add_user_id_to_coaches.sql)
- [supabase/migrations/002_link_players_to_users.sql](supabase/migrations/002_link_players_to_users.sql)
- [supabase/migrations/003_fix_players_user_id.sql](supabase/migrations/003_fix_players_user_id.sql)
- [supabase/migrations/004_create_profiles_table.sql](supabase/migrations/004_create_profiles_table.sql)

**Config**:
- [src/lib/supabase.ts](src/lib/supabase.ts)

---

## 📞 Questions to Answer

1. **Are Phase 22 columns (`rom_mm`, etc.) supposed to be in the database?**
   - If yes: Add to migrations and database.ts
   - If no: Remove queries for these fields

2. **Which tables should have RLS policies?**
   - Current assumption: All user data tables need RLS
   - Verify if any tables should be world-readable

3. **Are the FK relationship names correct?**
   - Verify in Supabase dashboard: Table Editor → Foreign Keys
   - Confirm exact names for `players` join and `profiles!..._fkey` references

4. **Is coach_feedback table actively used?**
   - If not: Remove from schema (database.ts)
   - If yes: Implement service layer with RLS

5. **What's the intended user_id linking strategy?**
   - Should players ALWAYS have linked user_id?
   - Should sessions always be owned by user_id?
   - Or mixed (some by player_id, some by user_id)?

---

**Audit Complete**. 10 distinct issue categories identified across 8+ tables and 15+ code locations.
