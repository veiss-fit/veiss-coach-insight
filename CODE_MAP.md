# VEISS Coach Insight - Comprehensive Code Map

This document provides a complete overview of the codebase structure for development guidance. Use this to identify which files need to be modified for specific functionality.

---

## 📁 Directory Structure Overview

```
src/
├── App.tsx                          # Main app router
├── main.tsx                         # Vite entry point
├── contexts/                        # React context providers
├── pages/                           # Page-level components
├── components/                      # Reusable components
│   ├── ui/                         # Shadcn UI library (do not edit)
│   └── [Feature Components]
├── services/                        # API/database service layer
├── lib/                            # Utilities and helpers
├── data/                           # Mock data
├── hooks/                          # Custom React hooks
├── types/                          # TypeScript type definitions
└── assets/                         # Static assets (images, etc)
```

---

## 🔌 Core Infrastructure Files

These files set up the fundamental systems.

### Configuration Files
| File | Purpose | Modify For |
|------|---------|-----------|
| [App.tsx](src/App.tsx) | Route definitions, app wrapper setup | Adding new pages, routes, providers |
| [main.tsx](src/main.tsx) | Vite entry point, React root | Never - core setup |
| [vite.config.ts](vite.config.ts) | Build configuration | Build optimizations, plugins |
| [tailwind.config.ts](tailwind.config.ts) | Tailwind CSS theming (navy, gold colors) | Theme changes, new colors |
| [tsconfig.json](tsconfig.json) | TypeScript configuration | Type checking rules |

---

## 🔐 Authentication & Authorization

### Context Providers
| File | Purpose | Key Functions | Modify For |
|------|---------|---------------|-----------|
| [contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) | **Authentication state management** | `login()`, `signup()`, `logout()`, `loading`, `user`, `profile`, `isAuthenticated` | Login flow changes, new auth methods, role management |

### Pages
| File | Purpose | Key Components | Modify For |
|------|---------|---------------|-----------|
| [pages/Login.tsx](src/pages/Login.tsx) | **Login screen** | Email/password inputs, submit handler | Adding forgot password, social login |
| [pages/Signup.tsx](src/pages/Signup.tsx) | **Sign up screen** | Form validation, profile creation | Sign up flow improvements, additional fields |
| [pages/Profile.tsx](src/pages/Profile.tsx) | **Coach profile page** | Profile display, settings | Coach settings, preferences, password change |

### Components
| File | Purpose | Key Components | Modify For |
|------|---------|---------------|-----------|
| [components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx) | **Route protection** | Redirects unauthenticated users | Adding new permission types |
| [components/ProfileMenu.tsx](src/components/ProfileMenu.tsx) | **User menu dropdown** | Profile, logout, settings | Adding new menu items |

---

## 📊 Dashboard & Analytics

### Main Pages
| File | Purpose | Key Functions | Modify For |
|------|---------|---------------|-----------|
| [pages/Index.tsx](src/pages/Index.tsx) | **Main dashboard** | Loads players, stats, handles modal opens | Adding new dashboard sections, stats |

### Dashboard Components
| File | Purpose | Key Props | Modify For |
|------|---------|-----------|-----------|
| [components/TopNav.tsx](src/components/TopNav.tsx) | **Top navigation bar** | Branding, navigation | Adding nav items |
| [components/SummaryStrip.tsx](src/components/SummaryStrip.tsx) | **Stats cards row** | Shows totalSessions, activeAthletes, etc | Changing stat display |
| [components/StatCard.tsx](src/components/StatCard.tsx) | **Individual stat card** | `icon`, `label`, `value`, `bgColor` | Stat card styling |
| [components/FilterSidebar.tsx](src/components/FilterSidebar.tsx) | **Left sidebar filters** | Sport, level, team filters | Adding new filter types |

---

## 👥 Player Management

### Services
| File | Purpose | Key Functions |
|------|---------|---------------|
| [services/playersService.ts](src/services/playersService.ts) | **CRUD operations for players** | `getAllPlayers()`, `getPlayerById()`, `addPlayer()`, `assignPlayerToTeam()`, `calculatePlayerStats()`, `getSportsList()` |

### Player Management UI
| File | Purpose | Key Features | Modify For |
|------|---------|-------------|-----------|
| [components/PlayerBuilder.tsx](src/components/PlayerBuilder.tsx) | **Dialog to add/assign players** | Two modes: "new" (create) and "assign" (move team) | Adding edit mode, bulk operations, validation |
| [components/AthleteTable.tsx](src/components/AthleteTable.tsx) | **Player list table** | Displays all players with stats | Adding columns, edit buttons, delete buttons |
| [components/AthleteDetailPanel.tsx](src/components/AthleteDetailPanel.tsx) | **Side panel with player details** | Shows sessions, performance history | Adding edit functionality |

### Missing Functions to Implement
```typescript
// MISSING from playersService.ts:
- updatePlayer(playerId, data)     // Edit player name, jersey number, etc
- deletePlayer(playerId)            // Remove player from system
- searchPlayers(query)              // Find players by name
- validatePlayerData(data)          // Input validation
```

---

## 📋 Workout Plans & Exercises

### Services
| File | Purpose | Key Functions |
|------|---------|---------------|
| [services/workoutPlansService.ts](src/services/workoutPlansService.ts) | **Workout plan CRUD** | `sendWorkoutPlan()`, `getPlayerWorkoutPlans()`, `getCoachWorkoutPlans()`, `updateWorkoutPlanStatus()`, `deleteWorkoutPlan()` |

### Workout Management UI
| File | Purpose | Key Features | Modify For |
|------|---------|-------------|-----------|
| [components/WorkoutBuilder.tsx](src/components/WorkoutBuilder.tsx) | **Dialog to create/send workouts** | Template selection, exercise builder, athlete selection, date picker | Adding exercise templates, better exercise editor |

### Workout Flow
```
Coach opens WorkoutBuilder
  ↓
Selects template OR manually adds exercises
  ↓
Configures: sets, reps, weight, velocity targets
  ↓
Selects athletes & date
  ↓
Sends to Supabase workout_plans table
```

### Missing Functions to Implement
```typescript
// MISSING from workoutPlansService.ts:
- updateWorkoutPlan(planId, data)     // Edit plan details
- saveWorkoutTemplate(name, exercises) // Save custom templates
- getWorkoutTemplate(templateId)       // Retrieve saved templates
- cloneWorkoutPlan(planId)             // Copy existing plan
```

---

## 📝 Announcements & Messages

### Services
| File | Purpose | Key Functions |
|------|---------|---------------|
| [services/messagesService.ts](src/services/messagesService.ts) | **Message/announcement CRUD** | `sendMessage()`, `getCoachMessages()` |

### Message Management UI
| File | Purpose | Key Features | Modify For |
|------|---------|-------------|-----------|
| [components/AnnouncementBuilder.tsx](src/components/AnnouncementBuilder.tsx) | **Dialog to send announcements** | Title, message, priority, athlete selection, scheduled date | Adding rich text, file attachments |

### Missing Functions to Implement
```typescript
// MISSING from messagesService.ts:
- markMessageAsRead(messageId)      // Mark read status
- archiveMessage(messageId)         // Archive message
- deleteMessage(messageId)          // Delete message
- getReceivedMessages(userId)       // Get messages for player
- searchMessages(query)             // Search functionality
- replyToMessage(messageId, reply)  // Reply to message
```

---

## 💾 Sessions & Performance Data

### Services
| File | Purpose | Key Functions |
|------|---------|---------------|
| [services/sessionsService.ts](src/services/sessionsService.ts) | **Session/rep data retrieval** | `getPlayerSessions()`, `getSessionExercises()`, `getPlayerPerformanceHistory()`, `getSessionById()` |

### Session Management UI
| File | Purpose | Key Features | Modify For |
|------|---------|-------------|-----------|
| [components/SessionDetailPanel.tsx](src/components/SessionDetailPanel.tsx) | **Side panel showing session details** | Displays exercises, reps, velocity data | Adding charts, editing reps |

### Missing Functions to Implement
```typescript
// MISSING from sessionsService.ts:
- createSession(playerId, data)     // Record new session
- updateSession(sessionId, data)    // Edit session details
- deleteSession(sessionId)          // Remove session
- addRepsData(sessionId, repsData)  // Record individual reps
- updateRepData(repId, data)        // Edit rep details
```

---

## 📈 Analytics & Statistics

### Services
| File | Purpose | Key Functions |
|------|---------|---------------|
| [services/statsService.ts](src/services/statsService.ts) | **Dashboard analytics** | `getCoachDashboardStats()`, `getSessionCount()`, `getWeeklyActivity()`, `getTeamPerformanceSummary()` |

### Statistics Used In
- Dashboard (Index.tsx) - Summary strip stats
- AthleteDetailPanel - Performance history
- All filter/search operations

---

## 🛠️ Utilities & Helpers

### Core Utilities
| File | Purpose | Key Functions | Modify For |
|------|---------|---------------|-----------|
| [lib/utils.ts](src/lib/utils.ts) | **UI utilities** | `cn()` - Tailwind class merging | Adding formatting functions (dates, velocities, etc) |
| [lib/supabase.ts](src/lib/supabase.ts) | **Supabase client & auth helpers** | `supabase` client, `getCurrentUser()`, `getUserProfile()`, `signOut()` | Adding new auth methods, timeout handling |

### Custom Hooks
| File | Purpose | Key Functions | Modify For |
|------|---------|---------------|-----------|
| [hooks/use-toast.ts](src/hooks/use-toast.ts) | **Toast notification hook** | From shadcn - use for notifications | Never - UI library |
| [hooks/use-mobile.tsx](src/hooks/use-mobile.tsx) | **Mobile detection hook** | Responsive design | Never - UI library |
| [hooks/useRealtimeSubscriptions.ts](src/hooks/useRealtimeSubscriptions.ts) | **Real-time data subscriptions** | `useDashboardSubscription()`, `useSessionsSubscription()` | Enabling real-time updates |

---

## 📦 Data & Types

### Type Definitions
| File | Purpose | Key Types | Modify For |
|------|---------|-----------|-----------|
| [types/database.ts](src/types/database.ts) | **Supabase schema types** | `Database`, all table Row/Insert/Update types | Adding new fields to database schema |

### Mock Data
| File | Purpose | Key Objects | Modify For |
|------|---------|-------------|-----------|
| [data/mockData.ts](src/data/mockData.ts) | **Hardcoded templates & data** | `workoutTemplates`, `Athlete` interface, `Session`, `Exercise` types | Adding new templates, test data |

---

## 🎨 UI Component Library

All files in [src/components/ui/](src/components/ui/) are **Shadcn/ui components** and should **NOT be edited**.

### UI Components Available
| Category | Components |
|----------|----------|
| **Layout** | Sidebar, Sheet, Drawer, Dialog, Popover, HoverCard |
| **Input** | Input, Button, Checkbox, Radio, Select, Textarea, Toggle, Switch, Calendar |
| **Display** | Badge, Card, Tabs, Table, Accordion, Progress, Avatar, Separator |
| **Feedback** | Toast/Toaster, Alert, AlertDialog, Sonner (toast lib) |
| **Navigation** | Breadcrumb, Pagination, NavigationMenu, CommandPalette |
| **Other** | Chart, Carousel, AspectRatio, Skeleton, Tooltip |

---

## 📱 Feature Map: Where to Make Changes

### 🎯 **Feature: Edit/Delete Players**
**Files to Modify:**
1. [services/playersService.ts](src/services/playersService.ts) - Add `updatePlayer()`, `deletePlayer()`
2. [components/PlayerBuilder.tsx](src/components/PlayerBuilder.tsx) - Add "edit" mode tab
3. [components/AthleteTable.tsx](src/components/AthleteTable.tsx) - Add edit/delete buttons
4. [components/AthleteDetailPanel.tsx](src/components/AthleteDetailPanel.tsx) - Add edit button

**Also Needed:**
- Input validation in [lib/utils.ts](src/lib/utils.ts)
- UI for confirm delete dialog

---

### 🎯 **Feature: Create/Record Sessions**
**Files to Modify:**
1. [services/sessionsService.ts](src/services/sessionsService.ts) - Add `createSession()`, `addRepsData()`, `updateRepData()`
2. **NEW FILE NEEDED** - [components/SessionBuilder.tsx](src/components/SessionBuilder.tsx) - Dialog to record session
3. **NEW FILE NEEDED** - [pages/SessionsPage.tsx](src/pages/SessionsPage.tsx) - Page to view/manage sessions
4. [App.tsx](src/App.tsx) - Add route for sessions page

**Also Needed:**
- Update [types/database.ts](src/types/database.ts) if adding fields
- Session recording UI

---

### 🎯 **Feature: Team Management**
**Files to Modify:**
1. **NEW FILE NEEDED** - [services/teamsService.ts](src/services/teamsService.ts) - Create CRUD for teams
2. **NEW FILE NEEDED** - [components/TeamBuilder.tsx](src/components/TeamBuilder.tsx) - Dialog/form for teams
3. **NEW FILE NEEDED** - [pages/TeamsPage.tsx](src/pages/TeamsPage.tsx) - Team management page
4. [App.tsx](src/App.tsx) - Add route
5. [components/TopNav.tsx](src/components/TopNav.tsx) - Add teams nav link

---

### 🎯 **Feature: Workout Templates (Save & Reuse)**
**Files to Modify:**
1. [services/workoutPlansService.ts](src/services/workoutPlansService.ts) - Add template CRUD functions
2. [components/WorkoutBuilder.tsx](src/components/WorkoutBuilder.tsx) - Add "save as template" button
3. **OPTIONAL** - Update [types/database.ts](src/types/database.ts) if creating new table

---

### 🎯 **Feature: Advanced Player Search**
**Files to Modify:**
1. [services/playersService.ts](src/services/playersService.ts) - Add `searchPlayers()`, `filterPlayers()`
2. [components/FilterSidebar.tsx](src/components/FilterSidebar.tsx) - Add search input
3. [components/AthleteTable.tsx](src/components/AthleteTable.tsx) - Add search functionality

---

### 🎯 **Feature: Message Management (Read/Archive/Delete)**
**Files to Modify:**
1. [services/messagesService.ts](src/services/messagesService.ts) - Add message management functions
2. **NEW FILE NEEDED** - [pages/MessagesPage.tsx](src/pages/MessagesPage.tsx) - Message inbox
3. [App.tsx](src/App.tsx) - Add route
4. [components/TopNav.tsx](src/components/TopNav.tsx) - Add messages nav link

---

### 🎯 **Feature: Remove "All Groups" Filter**
**Files to Modify:**
1. [components/WorkoutBuilder.tsx](src/components/WorkoutBuilder.tsx) - Remove group filter
2. [components/AnnouncementBuilder.tsx](src/components/AnnouncementBuilder.tsx) - Remove group filter
3. [services/playersService.ts](src/services/playersService.ts) - Remove `group` from PlayerWithStats mapping

---

### 🎯 **Feature: Input Validation**
**Files to Modify:**
1. [lib/utils.ts](src/lib/utils.ts) - Add validators:
   - `validateEmail(email)`
   - `validatePassword(password)`
   - `validatePlayerName(name)`
   - `validateJerseyNumber(number)`
2. [components/PlayerBuilder.tsx](src/components/PlayerBuilder.tsx) - Use validators
3. [components/WorkoutBuilder.tsx](src/components/WorkoutBuilder.tsx) - Add exercise validation
4. [pages/Login.tsx](src/pages/Login.tsx) - Add email validation
5. [pages/Signup.tsx](src/pages/Signup.tsx) - Improve validation

---

### 🎯 **Feature: Fix Signup Profile Creation (RLS Issue)**
**Files to Modify:**
1. [contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) - `signup()` function error handling
2. **ACTION NEEDED**: Supabase console - Check RLS policies on `profiles` table

**Issue**: 
- Auth account created but profile insert fails
- Likely RLS policy preventing anon key from inserting

**Solution**:
- Check Supabase RLS policy for `profiles` table
- Either disable RLS or create policy allowing auth users to insert own profile

---

## 🔄 Data Flow Examples

### Authentication Flow
```
User fills form (Login.tsx)
    ↓
Calls useAuth().login() (AuthContext.tsx)
    ↓
Calls supabase.auth.signInWithPassword() (supabase.ts)
    ↓
Calls getUserProfile(userId) (supabase.ts)
    ↓
AuthContext stores user + profile in state
    ↓
Redirects to / (protected by ProtectedRoute.tsx)
```

### Dashboard Load Flow
```
Index.tsx mounts with profile
    ↓
Calls getAllPlayers() (playersService.ts)
    ↓
For each player, calls calculatePlayerStats() (playersService.ts)
    ↓
Calls getCoachDashboardStats() (statsService.ts)
    ↓
Sets state with players + stats
    ↓
Renders AthleteTable + SummaryStrip
```

### Workout Send Flow
```
Coach opens WorkoutBuilder dialog
    ↓
Selects template (workoutTemplates from mockData.ts)
    ↓
Adds/edits exercises (state in WorkoutBuilder.tsx)
    ↓
Selects athletes (state in WorkoutBuilder.tsx)
    ↓
Clicks Send
    ↓
Calls sendWorkoutPlan() (workoutPlansService.ts)
    ↓
Creates records in workout_plans table
    ↓
Toast confirmation
```

---

## 🗄️ Database Schema Reference

For detailed schema info, see [types/database.ts](src/types/database.ts)

### Key Tables
- **profiles** - Users (coach/player/admin roles)
- **coaches** - Coach details linked to profiles
- **players** - Athlete details with team assignment
- **teams** - Team info (name, sport)
- **sessions** - Training sessions with metrics
- **reps** - Individual rep data (weight, velocity, set/rep numbers)
- **workouts** - Workout exercises from sessions
- **workout_plans** - Planned workouts sent to players
- **messages** - Announcements/messages
- **coach_feedback** - Feedback sent to players

---

## 🚨 Critical Dependencies

### What Breaks If You Modify These
| File | Impact | Use Caution For |
|------|--------|-----------------|
| [types/database.ts](src/types/database.ts) | All services break if types change | Only update if database schema changes |
| [contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) | Entire app breaks if auth flow breaks | Test signup/login thoroughly |
| [lib/supabase.ts](src/lib/supabase.ts) | All database queries fail | Don't remove client initialization |
| [App.tsx](src/App.tsx) | Routes break, app doesn't load | Careful with route changes |

---

## 📋 New File Checklist

When creating new features, you may need:

```
New Major Feature?
├── src/pages/[FeatureName]Page.tsx
├── src/components/[FeatureName]Builder.tsx OR [FeatureName]Panel.tsx
├── src/services/[featureName]Service.ts (if database operations)
└── Update src/App.tsx with new route
```

---

## 🔍 Quick Reference: Which Service For What

| Operation | Service |
|-----------|---------|
| Get/add/edit/delete players | `playersService.ts` |
| Get/send/edit workouts | `workoutPlansService.ts` |
| Get/send/edit messages | `messagesService.ts` |
| Get sessions/reps/performance | `sessionsService.ts` |
| Get dashboard stats | `statsService.ts` |
| Auth operations | `lib/supabase.ts` + `contexts/AuthContext.tsx` |
| Formatting/UI helpers | `lib/utils.ts` |
| Mock data/templates | `data/mockData.ts` |

---

## 📝 Notes

- **Shadcn UI Components**: Located in [src/components/ui/](src/components/ui/) - use them but don't modify
- **Mock Data**: [data/mockData.ts](src/mockData.ts) contains hardcoded templates for workouts
- **Environment Variables**: Needed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Tailwind Theme**: Navy and gold colors defined in [tailwind.config.ts](tailwind.config.ts)
- **Real-time Updates**: Disabled for free tier but infrastructure exists in [hooks/useRealtimeSubscriptions.ts](src/hooks/useRealtimeSubscriptions.ts)

---

**Last Updated**: January 6, 2026
**Maintainer**: Development Team
