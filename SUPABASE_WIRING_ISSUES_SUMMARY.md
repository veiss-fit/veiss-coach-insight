# Supabase Wiring Issues - Executive Summary

**Scan Date**: April 11, 2026 | **Severity**: 🔴 CRITICAL - Multiple failures possible  
**Deep Scan Results**: 10 issue categories, 8+ tables affected, 15+ code locations with problems

---

## 🎯 Quick Overview

Your Supabase integration has **persistent wiring issues** affecting authentication, data security, and data integrity. Most issues cause **silent failures** (queries return null instead of throwing errors), making debugging difficult.

| Category | Count | Severity | Impact |
|----------|-------|----------|--------|
| Missing Type Definitions | 3 fields | 🔴 CRITICAL | Runtime errors in 4 locations |
| Missing RLS Policies | 8 tables | 🔴 CRITICAL | Complete data exposure/security breach |
| Foreign Key Issues | 7 constraints | 🟠 HIGH | Orphaned records, data corruption |
| Join Failures | 6 queries | 🟠 HIGH | Null references crash UI |
| Migration Errors | 1 circular dependency | 🔴 CRITICAL | Migrations fail to execute |
| User ID Inconsistencies | 4 locations | 🟡 MEDIUM | Incomplete session history |
| Unused Code | 1 table | 🟡 MEDIUM | Dead code, security gap |
| RLS Policy Bugs | 2 incomplete | 🟠 HIGH | Data leaks, incomplete checks |

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

### Issue 1: Missing Phase 22 Columns in Type Definitions
**Files**: `src/types/database.ts`, `src/services/sessionsService.ts`, `src/services/playersService.ts`  
**Problem**: Code queries `rom_mm`, `concentric_duration_s`, `eccentric_duration_s` that don't exist in types  
**Impact**: 4 code locations have TypeScript errors; UI receives undefined values  
**Fix**: Add 3 columns to `reps` Row/Insert/Update types in database.ts

```typescript
// In src/types/database.ts - Add to reps table Row, Insert, and Update:
rom_mm: number | null;
concentric_duration_s: number | null;
eccentric_duration_s: number | null;
```

---

### Issue 2: Missing Row-Level Security (RLS) - Data Exposure Risk 🔒
**Tables Without RLS**: sessions, workouts, reps, workout_plans, coach_feedback, messages (partial), coaches (missing), teams (missing)  
**Problem**: Any authenticated user can read/write ALL data - complete multi-tenant isolation failure  
**Security Risk**: Coaches can see other coaches' teams, players can see other players' workouts  
**Impact**: GDPR/privacy violation; all user data exposed

**Missing RLS Policies Needed**:
```sql
sessions        - ENABLE RLS + policies by user_id/coach_id
workouts        - ENABLE RLS + policies by player_id/session ownership
reps            - ENABLE RLS + policies by player_id/session ownership
workout_plans   - ENABLE RLS + policies by player_id/coach ownership
messages        - ENABLE RLS + policies by sender/receiver isolation
coach_feedback  - ENABLE RLS + policies by player/coach/session ownership
coaches         - ENABLE RLS + policies by user_id/team_id
teams           - ENABLE RLS + policies by coach_id association
```

---

### Issue 3: Circular Migration Dependency - Migrations Fail to Run
**Files**: `supabase/migrations/003_fix_players_user_id.sql`, `004_create_profiles_table.sql`  
**Problem**: Migration 003 creates trigger referencing `profiles` table (created by Migration 004)  
**Current Order**: 001 → 002 → 003 ❌ FAILS → 004  
**Fix**: Reorder migrations so 004 runs before 003

**What happens now**:
- Migration 003 tries to insert into `profiles` table (doesn't exist yet)
- Error: "relation 'profiles' does not exist"
- Entire migration 003 fails - players never get user_id column linked
- Players can't log in
- Authentication fails

---

## 🟠 HIGH PRIORITY ISSUES (Fix Soon)

### Issue 4: Foreign Key Relationship Join Failures
**Files**: `src/services/workoutPlansService.ts`, `src/services/messagesService.ts`  
**Problem**: 6-7 queries use relationship joins with names that might not match database schema  
**Impact**: Join fails silently (no error), returns null properties → UI crashes with "Cannot read property of null"

**Affected Functions**:
- `getCoachWorkoutPlans()` - Line 120 uses `.select('*, players(full_name)')`
- `getUpcomingWorkoutPlans()` - Line 208 same pattern
- `getPlayerMessages()` - Line 110 uses `.select('*, profiles!messages_sender_id_fkey(...)')`

**Fix**: Verify FK names in Supabase dashboard exist exactly as referenced in code

---

### Issue 5: Missing Foreign Key Constraints
**Tables Affected**: All 10 tables  
**Problem**: 7-8 FK relationships not defined as database constraints  
**Impact**: Can delete coaches/players and leave orphaned records; no CASCADE delete protection

**Missing Constraints**:
```sql
messages → profiles (sender_id, receiver_id)
workout_plans → coaches (coach_id)
coach_feedback → players, coaches, sessions
coaches → teams (team_id)  -- Missing in migration 001
```

---

### Issue 6: Incomplete/Overly-Permissive RLS Policies
**Files**: `supabase/migrations/003_fix_players_user_id.sql`, `004_create_profiles_table.sql`  
**Problems**:
1. Migration 003 UPDATE policy incomplete (missing `WITH CHECK` clause)
2. Migration 004 profiles policy allows anyone to insert: `WITH CHECK (true);` ❌

---

## 🟡 MEDIUM PRIORITY ISSUES

### Issue 7: User ID Tracking Inconsistencies
**Files**: `src/services/playersService.ts`, `sessionsService.ts`, `statsService.ts`  
**Problem**: Code assumes `player.user_id` always populated; creates duplicate queries; misses sessions  
**Impact**: Players with null `user_id` have incomplete session history (4+ locations)

---

### Issue 8: Unused Table (Dead Code + Security Gap)
**Table**: `coach_feedback`  
**Problem**: Defined in schema but never used anywhere in code; no RLS policies  
**Impact**: Dead code, maintenance burden, security hole

---

## 📊 Issue Impact by Severity

### 🔴 CRITICAL (3)
- Missing Phase 22 columns (crashes stats calculations)
- No RLS on 8 tables (data breach)
- Circular migrations (auth breaks)

**→ Blocks app from working correctly**

### 🟠 HIGH (4)
- FK join failures (UI crashes with null references)
- Missing FK constraints (data corruption)
- Incomplete RLS policies (data leaks)
- Messages/workouts join failures (features broken)

**→ Silent failures, incomplete data, runtime errors**

### 🟡 MEDIUM (3)
- User ID tracking (data inconsistency)
- Unused table (code smell, security gap)
- Duplicate queries (performance issue)

**→ Data inconsistency, poor performance**

---

## 🛠️ Fix Implementation Order

### PHASE 1: Emergency (15-20 min) - Prevents Immediate Failures
1. ✅ **Reorder migrations** - Move 004 before 003 (15 min)
2. ✅ **Add Phase 22 columns to database.ts** - Add 3 fields to reps type (10 min)

### PHASE 2: Security (2-3 hours) - Prevents Data Breach
3. ✅ **Add RLS to all 8 tables** - Create isolation policies (2-2.5 hours)
4. ✅ **Add missing FK constraints** - Define 7-8 relationships (45 min)

### PHASE 3: Stability (1-1.5 hours) - Fixes Silent Failures
5. ✅ **Fix join relationship names** - Verify FK names match queries (30 min)
6. ✅ **Fix user ID tracking** - Add null checks, deduplicate (30 min)

### PHASE 4: Cleanup (30 min) - Code Quality
7. ✅ **Fix incomplete RLS policies** - Complete migration 003 UPDATE, fix migration 004 INSERT (20 min)
8. ✅ **Remove or implement coach_feedback** - Delete unused table or create service (30 min)

---

## 🔍 Verification Checklist

After fixes, verify:
- [ ] Migration 004 before Migration 003 (check Supabase migration history)
- [ ] Phase 22 columns in database.ts types
- [ ] All 8 tables have RLS enabled
- [ ] RLS policies created for each table
- [ ] No orphaned records when deleting coaches/players
- [ ] Player names display in workout plans UI
- [ ] Sender/receiver names display in messages UI
- [ ] Player stats include avgROM and avgTempo (not 0)
- [ ] Logged-in user can only see their own data
- [ ] Migrations run without errors
- [ ] No TypeScript errors in service files

---

## 🚨 Why These Issues Are "Very Persistent"

1. **Silent Failures** - Queries execute, but return null/undefined instead of errors
2. **Type Safety Bypass** - Using `as any` casts hides TypeScript errors
3. **RLS Not Blocking** - App appears to work, but security is completely broken
4. **Migration Ordering** - If migrations run in wrong order, errors silently fail on retry
5. **Runtime vs Compile** - Many issues only appear at runtime, not during development

---

## 📁 Full Audit Documentation

For detailed analysis of each issue including:
- Exact line numbers and code examples
- Impact analysis for each function
- Specific SQL fixes
- Relationship diagrams

See: **[SUPABASE_WIRING_AUDIT.md](SUPABASE_WIRING_AUDIT.md)**

---

**Status**: Deep scan complete. All issues documented. Ready for implementation.
