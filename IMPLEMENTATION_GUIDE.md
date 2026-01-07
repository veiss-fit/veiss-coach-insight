# Implementation Priority Guide

This document provides step-by-step guidance for implementing the critical missing features identified in the code review.

---

## 🔴 Priority 1: Fix Signup Profile Creation Issue

### Problem
Users complete signup but profile creation fails. Account exists but they can't log in.

### Root Cause
Likely RLS (Row Level Security) policy preventing anon key from inserting into `profiles` table.

### Implementation Steps

**Step 1: Check Supabase RLS Policy**
1. Go to Supabase dashboard → Your project
2. Navigate to **SQL Editor**
3. Run this to see current policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

4. If no INSERT policy exists for authenticated users, continue to Step 2

**Step 2: Create RLS Policy (Supabase SQL Editor)**
```sql
CREATE POLICY "allow_users_insert_own_profile" ON profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Also allow reads
CREATE POLICY "allow_users_read_own_profile" ON profiles
FOR SELECT USING (auth.uid() = id);
```

**Step 3: Update signup() in AuthContext**
- File: `src/contexts/AuthContext.tsx`
- Current: `signup()` tries to insert profile but fails silently
- Need: Better error handling and fallback

```typescript
// After supabase.auth.signUp() succeeds:
// Instead of always inserting, check if profile already exists
// If insert fails due to RLS, provide clear error message
```

**Testing:**
1. Clear browser localStorage/cookies
2. Try signup with new email
3. Should see profile created in Supabase
4. Should be able to log in immediately after

### Files to Modify
- `src/contexts/AuthContext.tsx` - Error handling in signup()
- Supabase console - RLS policies

---

## 🔴 Priority 2: Remove "All Groups" Filter

### Problem
Filter UI shows "All Groups" but it doesn't work. Every player is hardcoded as "General". Confuses users.

### Implementation Steps

**Step 1: playersService.ts**
```typescript
// Find this line (around line 50):
group: 'General'  // Remove this - don't add group field

// Change the return to:
return {
  ...player,
  name: player.full_name,
  sport: player.teams?.sport || 'Unknown',
  // Remove: group: 'General',  ← DELETE THIS LINE
  level: 'Varsity',
  team: player.teams,
  ...stats,
} as PlayerWithStats;
```

**Step 2: WorkoutBuilder.tsx**
```typescript
// Remove these lines:
const [filterGroup, setFilterGroup] = useState('all')  // DELETE

// In filteredAthletes, remove:
if (filterGroup !== 'all' && athlete.group !== filterGroup) return false

// Remove group filter dropdown from JSX

// Remove from selectAllFiltered logic if present
```

**Step 3: AnnouncementBuilder.tsx**
- Same changes as WorkoutBuilder.tsx

**Step 4: Update PlayerWithStats interface**
- File: `src/services/playersService.ts`
- Remove `group: string;` from interface

### Files to Modify
1. `src/services/playersService.ts`
2. `src/components/WorkoutBuilder.tsx`
3. `src/components/AnnouncementBuilder.tsx`

### Time: ~30 minutes

---

## 🔴 Priority 3: Add Update Player Functionality

### Problem
Coaches can't fix player info after creation. Typo in name? Wrong jersey number? No way to fix it.

### Implementation Steps

**Step 1: Add updatePlayer() to playersService.ts**
```typescript
/**
 * Update player details
 */
export const updatePlayer = async (
  playerId: string,
  updates: {
    full_name?: string;
    jersey_number?: number | null;
    team_id?: string | null;
  }
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', playerId);

    if (error) {
      console.error('Error updating player:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in updatePlayer:', error);
    throw error;
  }
};
```

**Step 2: Update PlayerBuilder.tsx**
- Add "edit" mode to existing tabs
- Show selected player's current info
- Pre-fill form with existing data
- Call updatePlayer() instead of addPlayer() in edit mode

**Step 3: Update AthleteDetailPanel.tsx**
- Add "Edit" button
- Opens PlayerBuilder in edit mode
- Pass selected athlete data

**Step 4: Update AthleteTable.tsx**
- Add edit/delete action buttons to each row
- Clicking edit opens PlayerBuilder modal

### Files to Modify
1. `src/services/playersService.ts` - Add `updatePlayer()`
2. `src/components/PlayerBuilder.tsx` - Add edit mode
3. `src/components/AthleteDetailPanel.tsx` - Add edit button
4. `src/components/AthleteTable.tsx` - Add edit/delete buttons

### Time: ~2 hours

---

## 🔴 Priority 4: Add Delete Player Functionality

### Problem
Coaches can't remove players from system. Duplicates can't be cleaned up.

### Implementation Steps

**Step 1: Add deletePlayer() to playersService.ts**
```typescript
/**
 * Delete a player
 */
export const deletePlayer = async (playerId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId);

    if (error) {
      console.error('Error deleting player:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deletePlayer:', error);
    throw error;
  }
};
```

**Step 2: Add delete UI to AthleteDetailPanel.tsx**
```typescript
// Add delete button with confirmation dialog
const handleDeletePlayer = async () => {
  if (!athlete) return;
  
  const confirmed = window.confirm(
    `Are you sure you want to delete ${athlete.name}? This cannot be undone.`
  );
  
  if (confirmed) {
    try {
      setLoading(true);
      await deletePlayer(athlete.id);
      toast.success(`${athlete.name} deleted`);
      onClose(); // Close detail panel
      // Trigger parent refresh
    } catch (error) {
      toast.error('Failed to delete player');
    } finally {
      setLoading(false);
    }
  }
};
```

**Step 3: Add delete UI to AthleteTable.tsx**
- Add trash icon button in action column
- Show confirmation dialog
- Remove from list after delete

### Files to Modify
1. `src/services/playersService.ts` - Add `deletePlayer()`
2. `src/components/AthleteDetailPanel.tsx` - Add delete button
3. `src/components/AthleteTable.tsx` - Add delete button

### Time: ~1 hour

---

## 🔴 Priority 5: Add Input Validation

### Problem
Invalid data accepted into database. No email format validation, no password strength.

### Implementation Steps

**Step 1: Add validators to lib/utils.ts**
```typescript
// Email validation
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

// Password validation
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  return { valid: true };
}

// Player name validation
export function validatePlayerName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length < 2) {
    return { valid: false, error: 'Player name must be at least 2 characters' };
  }
  if (name.trim().length > 100) {
    return { valid: false, error: 'Player name must be less than 100 characters' };
  }
  return { valid: true };
}

// Jersey number validation
export function validateJerseyNumber(num: number | string | null): { valid: boolean; error?: string } {
  if (num === null || num === '') {
    return { valid: true }; // Optional
  }
  const numVal = typeof num === 'string' ? parseInt(num) : num;
  if (isNaN(numVal) || numVal < 0 || numVal > 999) {
    return { valid: false, error: 'Jersey number must be 0-999' };
  }
  return { valid: true };
}
```

**Step 2: Update PlayerBuilder.tsx**
```typescript
const handleAddPlayer = async () => {
  // Validate each field
  const nameValidation = validatePlayerName(playerName);
  if (!nameValidation.valid) {
    toast.error(nameValidation.error);
    return;
  }

  const jerseyValidation = validateJerseyNumber(jerseyNumber);
  if (!jerseyValidation.valid) {
    toast.error(jerseyValidation.error);
    return;
  }

  // ... rest of function
};
```

**Step 3: Update Signup.tsx**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    toast.error(emailValidation.error);
    return;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    toast.error(passwordValidation.error);
    return;
  }

  // ... rest of function
};
```

**Step 4: Update Login.tsx**
- Add email validation before submit

**Step 5: Update WorkoutBuilder.tsx**
- Validate exercise weight, sets, reps (must be positive numbers)

### Files to Modify
1. `src/lib/utils.ts` - Add validators
2. `src/pages/Signup.tsx` - Use validators
3. `src/pages/Login.tsx` - Use validators
4. `src/components/PlayerBuilder.tsx` - Use validators
5. `src/components/WorkoutBuilder.tsx` - Use validators

### Time: ~2 hours

---

## 🟡 Priority 6: Edit Workout Plans

### Problem
Coaches can only send workouts once. Can't modify them. If they make a mistake, they have to delete and recreate.

### Implementation Steps

**Step 1: Add updateWorkoutPlan() to workoutPlansService.ts**
```typescript
/**
 * Update workout plan
 */
export const updateWorkoutPlan = async (
  planId: string,
  updates: {
    date?: string;
    title?: string;
    description?: string;
    exercises?: Json;
    notes?: string;
  }
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('workout_plans')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId);

    if (error) {
      console.error('Error updating workout plan:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in updateWorkoutPlan:', error);
    throw error;
  }
};
```

**Step 2: Update WorkoutBuilder.tsx**
- Add mode: "create" vs "edit"
- If editing, load existing plan data
- Pre-fill form with existing exercises, date, name
- Call updateWorkoutPlan() instead of sendWorkoutPlan() in edit mode

**Step 3: Add edit button to athlete detail view**
- Show upcoming workouts
- Each has "Edit" and "Delete" buttons
- Clicking edit opens WorkoutBuilder in edit mode

### Files to Modify
1. `src/services/workoutPlansService.ts` - Add `updateWorkoutPlan()`
2. `src/components/WorkoutBuilder.tsx` - Add edit mode
3. Athlete detail view - Add edit buttons for workouts

### Time: ~2 hours

---

## 🟡 Priority 7: Message Management

### Problem
Coaches can send announcements but can't manage them. No way to delete, mark read, or archive.

### Implementation Steps

**Step 1: Add message management functions to messagesService.ts**
```typescript
// Mark message as read
export const markMessageAsRead = async (messageId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('id', messageId);
  
  return !error;
};

// Archive message
export const archiveMessage = async (messageId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('messages')
    .update({ is_archived: true })
    .eq('id', messageId);
  
  return !error;
};

// Delete message
export const deleteMessage = async (messageId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);
  
  return !error;
};
```

**Step 2: Create new page src/pages/MessagesPage.tsx**
- List all messages sent by coach
- Show subject, date, recipient count
- Buttons: view, delete, archive
- Search/filter by subject or recipient

**Step 3: Add route in App.tsx**
```typescript
<Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
```

**Step 4: Add nav link in TopNav.tsx**
- Messages icon with badge showing unread count

### Files to Modify
1. `src/services/messagesService.ts` - Add message management functions
2. **NEW**: `src/pages/MessagesPage.tsx` - Create messages management page
3. `src/App.tsx` - Add route
4. `src/components/TopNav.tsx` - Add nav link

### Time: ~3 hours

---

## 🟡 Priority 8: Search Players

### Problem
Can't find specific player in large list. No search functionality.

### Implementation Steps

**Step 1: Add search function to playersService.ts**
```typescript
export const searchPlayers = async (query: string): Promise<PlayerWithStats[]> => {
  if (!query.trim()) {
    return getAllPlayers();
  }

  const { data: players, error } = await supabase
    .from('players')
    .select('*, teams(*)')
    .ilike('full_name', `%${query}%`) // Case-insensitive search
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Error searching players:', error);
    return [];
  }

  // Same stats calculation as getAllPlayers
  return processPlayersWithStats(players);
};
```

**Step 2: Update FilterSidebar.tsx**
- Add search input field
- Debounce search (don't query on every keystroke)
- Display search results

**Step 3: Update Index.tsx**
- Listen to search input
- Call searchPlayers() instead of getAllPlayers() when searching
- Show "No results" message if needed

### Files to Modify
1. `src/services/playersService.ts` - Add `searchPlayers()`
2. `src/components/FilterSidebar.tsx` - Add search input
3. `src/pages/Index.tsx` - Call searchPlayers() based on search query

### Time: ~2 hours

---

## 📊 Implementation Priority Summary

| Priority | Feature | Files | Time | Impact |
|----------|---------|-------|------|--------|
| 1 | Fix Signup RLS | AuthContext.tsx, Supabase | 1 hr | Users can sign up |
| 2 | Remove "All Groups" | playersService, WorkoutBuilder, AnnouncementBuilder | 30 min | Clean up UI |
| 3 | Update Players | playersService, PlayerBuilder, AthleteDetailPanel | 2 hrs | Fix player info |
| 4 | Delete Players | playersService, AthleteDetailPanel, AthleteTable | 1 hr | Clean up data |
| 5 | Input Validation | utils, Signup, Login, PlayerBuilder | 2 hrs | Prevent bad data |
| 6 | Edit Workouts | workoutPlansService, WorkoutBuilder | 2 hrs | Modify plans |
| 7 | Message Management | messagesService, MessagesPage | 3 hrs | Manage messages |
| 8 | Search Players | playersService, FilterSidebar, Index | 2 hrs | Find players easily |

**Total Time for Priorities 1-5**: ~6.5 hours (Essential MVP)
**Total Time for Priorities 1-8**: ~15.5 hours (Full feature completeness)

---

## ✅ Testing Checklist

After implementing each feature, test:

### Update Players
- [ ] Edit player name
- [ ] Edit jersey number
- [ ] Change player's team
- [ ] Confirm changes appear in table

### Delete Players
- [ ] Delete player with confirmation
- [ ] Player removed from table immediately
- [ ] Can't delete unintentionally (confirmation required)

### Input Validation
- [ ] Invalid email rejected
- [ ] Short password rejected
- [ ] Player name validation works
- [ ] Jersey number validation works
- [ ] Error messages clear and helpful

### Message Management
- [ ] Messages page loads list of sent announcements
- [ ] Can delete message
- [ ] Can archive message
- [ ] Can view message details

### Search Players
- [ ] Search finds player by name
- [ ] Search is case-insensitive
- [ ] Empty search shows all players
- [ ] Results update as you type

---

**Next Steps:**
1. Choose which priority to implement first
2. Create a new git branch for each feature
3. Follow the step-by-step implementation guide
4. Test thoroughly before merging
5. Commit with clear messages

