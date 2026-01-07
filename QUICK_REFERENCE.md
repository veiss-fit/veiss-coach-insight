# VEISS Coach Insight - Quick Reference Guide

A quick-lookup guide for common development tasks. Reference the full CODE_MAP.md for detailed information.

---

## ⚡ Quick File Lookup

### "I need to modify authentication"
- **Login**: `src/pages/Login.tsx`
- **Signup**: `src/pages/Signup.tsx`
- **Auth logic**: `src/contexts/AuthContext.tsx`
- **Supabase client**: `src/lib/supabase.ts`

### "I need to add/edit/delete players"
- **Player CRUD**: `src/services/playersService.ts`
- **Player UI**: `src/components/PlayerBuilder.tsx`
- **Player list**: `src/components/AthleteTable.tsx`
- **Player detail panel**: `src/components/AthleteDetailPanel.tsx`

### "I need to work with workout plans"
- **Workout CRUD**: `src/services/workoutPlansService.ts`
- **Workout UI**: `src/components/WorkoutBuilder.tsx`
- **Workout templates**: `src/data/mockData.ts` (hardcoded)

### "I need to work with messages/announcements"
- **Message CRUD**: `src/services/messagesService.ts`
- **Message UI**: `src/components/AnnouncementBuilder.tsx`

### "I need to work with sessions/reps"
- **Session CRUD**: `src/services/sessionsService.ts`
- **Session UI**: `src/components/SessionDetailPanel.tsx`

### "I need dashboard stats"
- **Stats calculation**: `src/services/statsService.ts`
- **Dashboard page**: `src/pages/Index.tsx`

### "I need to work with database types"
- **Schema types**: `src/types/database.ts`
- **App routing**: `src/App.tsx`

### "I need UI utilities"
- **CSS utilities**: `src/lib/utils.ts` (mainly `cn()`)
- **UI components**: `src/components/ui/` (read-only Shadcn library)

---

## 🔧 Common Tasks

### Task: Add a new page
**Files to create/modify:**
1. Create `src/pages/NewPage.tsx`
2. Update `src/App.tsx` - add Route
3. Update `src/components/TopNav.tsx` - add nav link

### Task: Add a new service function
**Files to modify:**
1. `src/services/[feature]Service.ts` - add function
2. `src/types/database.ts` - check types match (if new table)
3. Component that calls it - import and use

### Task: Add form validation
**Files to modify:**
1. `src/lib/utils.ts` - add validator function
2. Component with form - import validator and use
3. Show error message on validation fail

### Task: Change filters/search
**Files to modify:**
1. `src/services/playersService.ts` - add filter function
2. Component using filter - update filter logic
3. `src/components/FilterSidebar.tsx` - add UI for filter

### Task: Add database table
**Files to modify:**
1. Supabase console - create table
2. `src/types/database.ts` - add type definition
3. `src/services/[new]Service.ts` - create CRUD functions
4. Components - import and use service

---

## 🐛 Debugging Checklist

### "Users can't sign up"
1. Check `src/pages/Signup.tsx` - form validation
2. Check `src/contexts/AuthContext.tsx` - `signup()` function
3. Check Supabase console - RLS policies on `profiles` table
4. Check browser console for errors
5. Check Supabase logs for database errors

### "Players not showing on dashboard"
1. Check `src/pages/Index.tsx` - loading state
2. Check `src/services/playersService.ts` - `getAllPlayers()`
3. Check AuthContext - is user authenticated?
4. Check Supabase - does coach have team assigned?

### "Workouts not sending"
1. Check `src/services/workoutPlansService.ts` - `sendWorkoutPlan()`
2. Check `src/components/WorkoutBuilder.tsx` - form validation
3. Check Supabase - is `workout_plans` table accessible?
4. Check if athletes are selected
5. Check if date is selected

### "Data not updating"
1. Check Supabase RLS policies
2. Check if user_id in auth matches profile.id
3. Check browser console for error messages
4. Check Supabase logs

---

## 📊 Component Hierarchy

```
App.tsx (main router)
├── pages/Login.tsx
├── pages/Signup.tsx
├── pages/Index.tsx (protected dashboard)
│   ├── TopNav.tsx
│   ├── FilterSidebar.tsx
│   ├── SummaryStrip.tsx
│   │   └── StatCard.tsx (×4)
│   ├── AthleteTable.tsx
│   │   ├── PlayerBuilder.tsx (modal)
│   │   ├── WorkoutBuilder.tsx (modal)
│   │   ├── AnnouncementBuilder.tsx (modal)
│   │   └── (other builders)
│   ├── AthleteDetailPanel.tsx (side panel)
│   │   └── SessionDetailPanel.tsx (nested panel)
└── pages/Profile.tsx (protected)
    └── ProfileMenu.tsx
```

---

## 🔗 Service Function Reference

### playersService.ts
```
✅ getAllPlayers()                    - Get all players
✅ getPlayersByTeamIds(teamIds)       - Get players for team
✅ getPlayerById(playerId)            - Get single player
✅ addPlayer(data)                    - Create player
✅ assignPlayerToTeam(playerId, teamId) - Move player to team
✅ calculatePlayerStats(playerId)     - Get player's stats
✅ getSportsList()                    - Get available sports
✅ getUnassignedUsers()               - Get players without profile link
✅ getAllPlayersForAssignment()       - Get all players for UI
❌ updatePlayer(playerId, data)       - MISSING
❌ deletePlayer(playerId)             - MISSING
❌ searchPlayers(query)               - MISSING
```

### workoutPlansService.ts
```
✅ sendWorkoutPlan(playerIds, ...)    - Send workout to players
✅ getPlayerWorkoutPlans(playerId)    - Get player's workouts
✅ getCoachWorkoutPlans(coachId)      - Get coach's created workouts
✅ updateWorkoutPlanStatus(planId, isCompleted) - Mark complete
✅ deleteWorkoutPlan(planId)          - Delete workout
✅ getUpcomingWorkoutPlans(playerIds, daysAhead) - Get future workouts
❌ updateWorkoutPlan(planId, data)    - MISSING (can't edit)
❌ saveWorkoutTemplate(name, exercises) - MISSING (can't save templates)
```

### messagesService.ts
```
✅ sendMessage(senderId, recipientIds, ...) - Send announcement
✅ getCoachMessages(senderId)         - Get sent messages
❌ markMessageAsRead(messageId)       - MISSING
❌ archiveMessage(messageId)          - MISSING
❌ deleteMessage(messageId)           - MISSING
❌ getReceivedMessages(userId)        - MISSING (player view)
```

### sessionsService.ts
```
✅ getPlayerSessions(playerId)        - Get player's sessions
✅ getSessionExercises(sessionId)     - Get exercises in session
✅ getPlayerPerformanceHistory(playerId, days) - Get velocity trends
✅ getSessionById(sessionId)          - Get session details
❌ createSession(playerId, data)      - MISSING (can't record)
❌ updateSession(sessionId, data)     - MISSING
❌ deleteSession(sessionId)           - MISSING
❌ addRepsData(sessionId, repsData)   - MISSING
```

### statsService.ts
```
✅ getCoachDashboardStats(teamId)     - Dashboard stats
✅ getSessionCount(teamId, startDate, endDate) - Count sessions
✅ getWeeklyActivity(teamId)          - Sessions by day
✅ getTeamPerformanceSummary(teamId)  - Velocity, reps, exercises
```

---

## 🌳 State Management

### AuthContext (src/contexts/AuthContext.tsx)
```typescript
// Available in all components via useAuth()
const { 
  isAuthenticated,  // boolean - is user logged in?
  user,             // Supabase User object
  profile,          // CoachProfile with coach & team info
  login,            // (email, password) => Promise
  signup,           // (email, password, name) => Promise
  logout,           // () => Promise
  loading           // boolean - auth still initializing?
} = useAuth()
```

### Page-level State (e.g., Index.tsx)
- `athletes` - PlayerWithStats[]
- `loading` - boolean (is loading athletes?)
- `stats` - DashboardStats
- `selectedAthlete` - currently selected player for detail panel
- Various modal `open` states

---

## 🎨 Styling Guide

### Colors
- **Navy** (primary): `--navy` / `from-navy-dark via-navy to-navy-light`
- **Gold** (accent): `--gold` / `text-gold` / `bg-gold`
- **Defined in**: `tailwind.config.ts`

### Common Patterns
- Buttons: `bg-gold text-navy-dark hover:bg-gold/90`
- Cards: `border-gold/20`
- Gradients: `bg-gradient-to-br from-navy-dark via-navy to-navy-light`

---

## 🧪 Testing Checklist

Before deploying, test:
- [ ] User can sign up with new account
- [ ] User can log in
- [ ] Dashboard loads with players
- [ ] Can add player to team
- [ ] Can filter players by sport
- [ ] Can open detail panel and see sessions
- [ ] Can send workout plan
- [ ] Can send announcement
- [ ] Can log out

---

## 📱 Mobile Responsiveness

- Breakpoints defined in Tailwind (sm, md, lg, xl)
- Use `lg:` prefix for desktop-only layouts
- Components use `max-w-` and `w-full` for responsive widths
- `FilterSidebar` likely disappears on mobile

---

## 🚀 Performance Notes

- Dashboard loads all players on mount (could be slow if 100+ players)
- Each player stat calculation makes 3 database queries
- Consider caching or pagination for scale

---

## 📚 Key Dependencies

- **React** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Shadcn/ui** - UI components
- **React Router** - Routing
- **Supabase** - Backend/database
- **date-fns** - Date formatting
- **Sonner** - Toast notifications

---

## 💡 Pro Tips

1. **Use `cn()` for classes**: Import from `src/lib/utils.ts` for safe Tailwind merging
2. **Check console**: Browser dev tools show detailed Supabase errors
3. **Use toast for feedback**: `import { toast } from 'sonner'` then `toast.success(message)`
4. **Check loading states**: Many modals have loading states to prevent double-submit
5. **Hover over types**: TypeScript will show you function signatures in VS Code

---

**Related Files:**
- Full details: [CODE_MAP.md](CODE_MAP.md)
- Database schema: [types/database.ts](src/types/database.ts)
- App routes: [App.tsx](src/App.tsx)

