import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isBefore,
  startOfDay,
  addMonths,
  subMonths,
  isSameMonth,
} from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, ChevronRight, ChevronLeft, Plus, Trash2, Send, Dumbbell } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Validators } from '@/lib/validators'
import { useAuth } from '@/contexts/AuthContext'
import { useTemplates } from '@/contexts/TemplatesContext'
import { getPlayersWithStatsByCoach, PlayerWithStats } from '@/services/playersService'
import { sendWorkoutPlan } from '@/services/workoutPlansService'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { TopNav } from '@/components/TopNav'
import { supabase } from '@/lib/supabase'

// ─── Date key helpers ─────────────────────────────────────────────────────────

const toKey = (d: Date) => format(d, 'yyyy-MM-dd')

const keyToDate = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ─── Card style shared across panels ─────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  border: '1px solid rgba(7,16,31,0.06)',
  boxShadow: '0 4px 12px rgba(7,16,31,0.05), 0 1px 0 rgba(7,16,31,0.02)',
}

const SECTION_HEADER_STYLE: React.CSSProperties = {
  fontFamily: 'Inter',
  fontSize: 13,
  fontWeight: 600,
  color: '#071c32',
  marginBottom: 12,
  display: 'block',
}

// ─── Drag-select calendar ─────────────────────────────────────────────────────

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface DragCalendarProps {
  selected: Date[]
  onSelect: (dates: Date[]) => void
}

const DragCalendar = ({ selected, onSelect }: DragCalendarProps) => {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))

  const today = useMemo(() => startOfDay(new Date()), [])
  const todayKey = useMemo(() => toKey(today), [today])

  const isDragging = useRef(false)
  const visitedKeys = useRef(new Set<string>())
  const workingDates = useRef<Date[]>([])
  const workingKeys = useRef(new Set<string>())

  const selectedKeys = useMemo(() => new Set(selected.map(toKey)), [selected])

  const gridDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 }),
      }),
    [viewMonth]
  )

  const isPast = useCallback((d: Date) => isBefore(d, today), [today])

  const startDrag = useCallback(
    (date: Date, e: React.MouseEvent | React.TouchEvent) => {
      if (isPast(date)) return
      e.preventDefault()

      isDragging.current = true
      const key = toKey(date)
      visitedKeys.current = new Set([key])

      workingDates.current = [...selected]
      workingKeys.current = new Set(selected.map(toKey))

      if (workingKeys.current.has(key)) {
        workingDates.current = workingDates.current.filter(d => toKey(d) !== key)
        workingKeys.current.delete(key)
      } else {
        workingDates.current = [...workingDates.current, date]
        workingKeys.current.add(key)
      }
      onSelect(workingDates.current)
    },
    [selected, isPast, onSelect]
  )

  const addDateByKey = useCallback(
    (key: string) => {
      if (visitedKeys.current.has(key)) return
      visitedKeys.current.add(key)
      const date = keyToDate(key)
      if (isPast(date)) return
      if (workingKeys.current.has(key)) return
      workingDates.current = [...workingDates.current, date]
      workingKeys.current.add(key)
      onSelect(workingDates.current)
    },
    [isPast, onSelect]
  )

  const keyAtPoint = useCallback((x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return el?.closest('[data-date]')?.getAttribute('data-date') ?? null
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging.current) return
      const key = keyAtPoint(e.clientX, e.clientY)
      if (key) addDateByKey(key)
    },
    [addDateByKey, keyAtPoint]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isDragging.current) return
      e.preventDefault()
      const { clientX, clientY } = e.touches[0]
      const key = keyAtPoint(clientX, clientY)
      if (key) addDateByKey(key)
    },
    [addDateByKey, keyAtPoint]
  )

  useEffect(() => {
    const end = () => {
      isDragging.current = false
      visitedKeys.current.clear()
    }
    window.addEventListener('mouseup', end)
    window.addEventListener('touchend', end)
    return () => {
      window.removeEventListener('mouseup', end)
      window.removeEventListener('touchend', end)
    }
  }, [])

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setViewMonth(m => subMonths(m, 1))}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" style={{ color: '#8d95a4' }} />
        </button>
        <span style={{ fontFamily: 'Inter', fontWeight: 600, color: '#071c32', fontSize: 15 }}>
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setViewMonth(m => addMonths(m, 1))}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" style={{ color: '#8d95a4' }} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-center py-1" style={{ color: '#205783', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="grid grid-cols-7 gap-0.5"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        style={{ touchAction: 'none' }}
      >
        {gridDays.map(day => {
          const key = toKey(day)
          const inMonth = isSameMonth(day, viewMonth)
          const past = isPast(day)
          const sel = selectedKeys.has(key)
          const isToday = key === todayKey

          const dayStyle: React.CSSProperties = sel
            ? { backgroundColor: '#fff4cc', color: '#6b4d00', borderRadius: 999, border: '1.5px solid #f5b400', fontWeight: 600 }
            : isToday
            ? { backgroundColor: '#f5b400', color: '#6b4d00', borderRadius: 999, fontWeight: 600 }
            : {}

          return (
            <div
              key={key}
              data-date={key}
              onMouseDown={e => startDrag(day, e)}
              onTouchStart={e => startDrag(day, e)}
              style={dayStyle}
              className={cn(
                'flex items-center justify-center h-10 text-sm transition-colors',
                past ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer',
                !inMonth && !sel && !isToday && 'text-muted-foreground/40',
                !sel && !isToday && !past && 'hover:bg-muted rounded-md',
                !sel && !isToday && 'rounded-md',
              )}
            >
              {format(day, 'd')}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Exercise types + constants ───────────────────────────────────────────────

interface WorkoutExercise {
  name: string
  sets: number
  reps: number
  weight: number
  weightUnit: 'lbs' | 'kg'
  targetVelocity: number
}

const EXERCISE_LIBRARY = [
  'Back Squat', 'Front Squat', 'Romanian Deadlift', 'Bench Press',
  'Overhead Press', 'Power Clean', 'Hang Clean', 'Box Jump',
  'Trap Bar Deadlift', 'Bulgarian Split Squat', 'Single Leg RDL',
  'Incline Bench Press', 'Push Press', 'Pull-ups', 'Barbell Row',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

const SendProgramming = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { templates } = useTemplates()

  const [workoutName, setWorkoutName] = useState('')
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [showExerciseEditor, setShowExerciseEditor] = useState(false)
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false)
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([])
  const [filterGroup, setFilterGroup] = useState('all')
  const [sending, setSending] = useState(false)

  const [athletes, setAthletes] = useState<PlayerWithStats[]>([])
  const [groupsList, setGroupsList] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [coachDbId, setCoachDbId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id])

  const loadData = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const { data: coachRow } = await (supabase as any)
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .single() as { data: { id: string } | null }

      setCoachDbId(coachRow?.id ?? null)

      const groupQuery = coachRow?.id
        ? (supabase as any).from('groups').select('id, name').eq('coach_id', coachRow.id).order('name', { ascending: true })
        : supabase.from('groups').select('id, name').order('name', { ascending: true })

      const [players, groupsResult] = await Promise.all([
        getPlayersWithStatsByCoach(user.id),
        groupQuery,
      ])
      setAthletes(players)
      setGroupsList(groupsResult.data || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  const toggleTemplate = (id: string) =>
    setSelectedTemplateIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const selectedTemplateLabels = selectedTemplateIds
    .map(id => templates.find(t => t.id === id)?.name)
    .filter(Boolean) as string[]

  // ── Exercises ──────────────────────────────────────────────────────────────

  const handleToggleExerciseEditor = () => {
    if (!showExerciseEditor && exercises.length === 0 && selectedTemplateIds.length > 0) {
      const combined: WorkoutExercise[] = selectedTemplateIds.flatMap(id => {
        const t = templates.find(t => t.id === id)
        return (t?.exercises ?? []).map(ex => ({
          name: ex.name,
          sets: ex.sets ?? 3,
          reps: ex.reps ?? 5,
          weight: 0,
          weightUnit: 'lbs' as const,
          targetVelocity: ex.targetVelocity ?? 0,
        }))
      })
      setExercises(combined)
    }
    setShowExerciseEditor(p => !p)
  }

  const addExercise = () =>
    setExercises(p => [
      ...p,
      { name: '', sets: 3, reps: 5, weight: 0, weightUnit: 'lbs', targetVelocity: 0 },
    ])

  const removeExercise = (i: number) =>
    setExercises(p => p.filter((_, idx) => idx !== i))

  const updateExercise = (i: number, field: keyof WorkoutExercise, value: any) =>
    setExercises(p => {
      const next = [...p]
      next[i] = { ...next[i], [field]: value }
      return next
    })

  // ── Athletes ───────────────────────────────────────────────────────────────

  const filteredAthletes = athletes.filter(a =>
    filterGroup === 'all' || a.team_id === filterGroup
  )

  // ── Send ───────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const nameError = Validators.workoutName(workoutName)
    if (nameError) { toast.error(nameError); return }
    if (selectedDates.length === 0) { toast.error('Select at least one date'); return }
    if (selectedAthletes.length === 0) { toast.error('Select at least one athlete'); return }

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i]
      const err =
        Validators.exerciseName(ex.name) ||
        Validators.workoutSets(ex.sets) ||
        Validators.workoutReps(ex.reps)
      if (err) { toast.error(`Exercise ${i + 1}: ${err}`); return }
    }

    try {
      setSending(true)
      const effectiveExercises = exercises.length > 0
        ? exercises
        : selectedTemplateIds.flatMap(id => {
            const t = templates.find(t => t.id === id)
            return (t?.exercises ?? []).map(ex => ({
              name: ex.name,
              sets: ex.sets ?? 3,
              reps: ex.reps ?? 5,
              weight: 0,
              weightUnit: 'lbs' as const,
              targetVelocity: ex.targetVelocity ?? 0,
            }))
          })

      const planData = {
        workoutName,
        exercises: effectiveExercises,
        notes: `Assigned by Coach`,
      }

      let totalCount = 0
      for (const date of selectedDates) {
        const result = await sendWorkoutPlan(
          selectedAthletes,
          coachDbId,
          date,
          planData
        )
        if (result.success) totalCount += result.count ?? 0
        else toast.error(result.error ?? `Failed to send for ${format(date, 'MMM d')}`)
      }

      if (totalCount > 0) {
        toast.success(
          `"${workoutName}" sent to ${selectedAthletes.length} athlete(s) across ${selectedDates.length} date(s)`
        )
        navigate('/')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred while sending the programming')
    } finally {
      setSending(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f6f7f9] flex flex-col">
      <TopNav
        onAnnouncementsClick={() => {}}
        onCreateTemplateClick={() => {}}
      />
      <LoadingOverlay isLoading={loading} fullScreen message="Loading data..." />
      <LoadingOverlay isLoading={sending} fullScreen message="Sending programming..." />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-10 py-10">
        {/* Page header */}
        <div className="mb-10">
          <div style={{ borderLeft: '4px solid #f5b400', paddingLeft: 16 }}>
            <h1 className="text-3xl" style={{ color: '#071c32', fontWeight: 700 }}>Send Programming</h1>
            <p className="mt-1.5 text-sm" style={{ color: '#5b6577' }}>
              Assign programming to athletes across
              <span style={{ color: '#205783' }}> one or more dates</span>
            </p>
          </div>
        </div>

        {/* Two-panel grid */}
        <div className="grid grid-cols-[440px_1fr] gap-12 items-start">

          {/* ── Left panel ── */}
          <div className="space-y-4">

            {/* Program Name card */}
            <div style={{ ...CARD_STYLE, padding: 20 }}>
              <div className="space-y-2">
                <Label htmlFor="programName" style={{ color: '#071c32', fontWeight: 600 }}>
                  Program Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="programName"
                  placeholder="e.g., Spring Phase 1"
                  value={workoutName}
                  onChange={e => setWorkoutName(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {/* Schedule Dates card */}
            <div style={{ ...CARD_STYLE, padding: 20 }}>
              <div className="space-y-3">
                <div>
                  <Label style={{ color: '#071c32', fontWeight: 600 }}>
                    Schedule Dates <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click to toggle · Hold and drag to select multiple
                  </p>
                </div>

                <DragCalendar selected={selectedDates} onSelect={setSelectedDates} />

                {selectedDates.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''} selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedDates([])}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[...selectedDates]
                        .sort((a, b) => a.getTime() - b.getTime())
                        .map(d => (
                          <Badge
                            key={toKey(d)}
                            variant="secondary"
                            className="text-xs cursor-pointer select-none hover:bg-destructive/20 hover:text-destructive"
                            onClick={() =>
                              setSelectedDates(prev => prev.filter(x => toKey(x) !== toKey(d)))
                            }
                          >
                            {format(d, 'MMM d')} ×
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="space-y-4">

            {/* Box 1: Templates + Exercises */}
            <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>

              {/* Load from Templates */}
              <div className="p-6 border-b space-y-3" style={{ backgroundColor: '#f8f9fb' }}>
                <span style={SECTION_HEADER_STYLE}>Load from Templates</span>
                <Popover open={templateDropdownOpen} onOpenChange={setTemplateDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal h-10">
                      <span className={selectedTemplateIds.length === 0 ? 'text-muted-foreground' : ''}>
                        {selectedTemplateIds.length === 0
                          ? 'Select templates...'
                          : `${selectedTemplateIds.length} template${selectedTemplateIds.length !== 1 ? 's' : ''} selected`}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-1.5 w-[--radix-popover-trigger-width]"
                    align="start"
                  >
                    {templates.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                        No templates yet. Create one in Template Manager.
                      </p>
                    ) : (
                      templates.map(t => (
                        <label
                          key={t.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedTemplateIds.includes(t.id)}
                            onCheckedChange={() => toggleTemplate(t.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{t.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </PopoverContent>
                </Popover>

                {selectedTemplateLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplateLabels.map(name => (
                      <Badge key={name} variant="secondary" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Modify Exercises accordion */}
              <div>
                <button
                  type="button"
                  onClick={handleToggleExerciseEditor}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#f6f7f9] transition-colors"
                  style={{ fontSize: 13, fontWeight: 600, color: '#07101f', fontFamily: 'Inter' }}
                >
                  <span className="flex items-center gap-2">
                    {showExerciseEditor
                      ? <ChevronDown className="h-4 w-4" style={{ color: '#8d95a4' }} />
                      : <ChevronRight className="h-4 w-4" style={{ color: '#8d95a4' }} />}
                    Modify Exercises
                    {exercises.length > 0 && (
                      <Badge variant="outline" className="text-xs ml-1">
                        {exercises.length}
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">Optional</span>
                </button>

                {showExerciseEditor && (
                  <div className="px-6 pb-6 space-y-3 border-t pt-5" style={{ backgroundColor: '#eef1f6' }}>
                    {exercises.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No exercises loaded.</p>
                        <p className="text-xs mt-1">
                          Select templates above or add exercises manually.
                        </p>
                      </div>
                    ) : (
                      exercises.map((ex, i) => (
                        <Card key={i} className="bg-background border-border/70 shadow-sm">
                          <CardHeader className="pt-4 pb-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={ex.name}
                                onChange={e => updateExercise(i, 'name', e.target.value)}
                                placeholder="Exercise name"
                                className="flex-1 h-9 text-sm"
                              />
                              <Select onValueChange={val => updateExercise(i, 'name', val)}>
                                <SelectTrigger className="w-10 h-9 px-0 justify-center" title="Pick from library">
                                  <Dumbbell className="h-4 w-4 opacity-50" />
                                </SelectTrigger>
                                <SelectContent>
                                  {EXERCISE_LIBRARY.map(e => (
                                    <SelectItem key={e} value={e}>{e}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm" variant="ghost" className="h-9 w-9 p-0"
                                onClick={() => removeExercise(i)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 pb-4">
                            <div className="grid grid-cols-3 gap-3">
                              {(['Sets', 'Reps'] as const).map(field => (
                                <div key={field}>
                                  <Label className="text-xs">{field}</Label>
                                  <Input
                                    type="number"
                                    className="h-9 text-sm mt-1"
                                    value={ex[field.toLowerCase() as 'sets' | 'reps']}
                                    onChange={e =>
                                      updateExercise(i, field.toLowerCase() as keyof WorkoutExercise, parseInt(e.target.value))
                                    }
                                  />
                                </div>
                              ))}
                              <div>
                                <Label className="text-xs">Target Velocity (m/s)</Label>
                                <Input
                                  type="number" step="0.05" min="0" max="1.6"
                                  className="h-9 text-sm mt-1"
                                  value={parseFloat(ex.targetVelocity.toFixed(2))}
                                  onChange={e => updateExercise(i, 'targetVelocity', parseFloat(parseFloat(e.target.value || '0').toFixed(2)))}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                    <Button size="sm" variant="outline" className="w-full mt-1" onClick={addExercise}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Exercise
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Box 2: Filter Groups + Athletes */}
            <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>

              {/* Filter header */}
              <div className="px-6 py-5 border-b space-y-3" style={{ backgroundColor: '#f8f9fb' }}>
                <span style={SECTION_HEADER_STYLE}>Filter Groups</span>
                <Select value={filterGroup} onValueChange={setFilterGroup}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {groupsList.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    style={{
                      flex: 1, backgroundColor: '#ffffff', border: '1px solid rgba(7,16,31,0.15)',
                      borderRadius: 8, color: '#07101f', fontWeight: 500, fontSize: 13,
                      padding: '6px 12px', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f2f5'; e.currentTarget.style.borderColor = '#205783'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(7,16,31,0.15)'; }}
                    onClick={() => setSelectedAthletes(filteredAthletes.map(a => a.id))}
                  >
                    Select All ({filteredAthletes.length})
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1, backgroundColor: '#ffffff', border: '1px solid rgba(7,16,31,0.15)',
                      borderRadius: 8, color: '#07101f', fontWeight: 500, fontSize: 13,
                      padding: '6px 12px', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f2f5'; e.currentTarget.style.borderColor = '#205783'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(7,16,31,0.15)'; }}
                    onClick={() => setSelectedAthletes([])}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Athlete list */}
              <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead className="sticky top-0 z-10">
                    <tr style={{ backgroundColor: '#fbfbfc', borderBottom: '1px solid rgba(7,16,31,0.06)' }}>
                      <th style={{ width: 44, padding: '10px 14px' }} />
                      <th style={{ fontFamily: 'Inter', fontSize: 10.5, fontWeight: 600, color: '#8d95a4', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 14px', textAlign: 'left' }}>Athlete</th>
                      <th style={{ fontFamily: 'Inter', fontSize: 10.5, fontWeight: 600, color: '#8d95a4', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 14px', textAlign: 'left' }}>Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '40px 0', color: '#8d95a4', fontSize: 13 }}>Loading athletes...</td>
                      </tr>
                    ) : filteredAthletes.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '40px 0', color: '#8d95a4', fontSize: 13 }}>No athletes found</td>
                      </tr>
                    ) : (
                      filteredAthletes.map(athlete => {
                        const isSelected = selectedAthletes.includes(athlete.id);
                        const initials = athlete.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                        const toggle = () => setSelectedAthletes(prev =>
                          prev.includes(athlete.id) ? prev.filter(id => id !== athlete.id) : [...prev, athlete.id]
                        );
                        return (
                          <tr
                            key={athlete.id}
                            style={{ height: 44, borderBottom: '1px solid rgba(7,16,31,0.06)', cursor: 'pointer', backgroundColor: isSelected ? '#fffdf0' : '#ffffff' }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#fbfbfc'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = isSelected ? '#fffdf0' : '#ffffff'; }}
                            onClick={toggle}
                          >
                            <td style={{ width: 44, padding: '0 14px' }} onClick={e => e.stopPropagation()}>
                              <Checkbox checked={isSelected} onCheckedChange={toggle} />
                            </td>
                            <td style={{ padding: '0 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#eef1f6', color: '#07101f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.01em', flexShrink: 0 }}>
                                  {initials}
                                </div>
                                <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 500, color: '#07101f' }}>{athlete.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '0 14px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 20, padding: '0 7px', borderRadius: 999, backgroundColor: '#f1f2f5', border: '1px solid rgba(7,16,31,0.06)', fontSize: 11, fontWeight: 500, color: '#28344a', letterSpacing: '0.01em' }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#8d95a4', flexShrink: 0 }} />
                                {(athlete as any).group || '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {selectedAthletes.length > 0 && (
                <div className="px-6 py-3 border-t text-xs" style={{ backgroundColor: '#fffdf0', color: '#6b4d00' }}>
                  {selectedAthletes.length} athlete{selectedAthletes.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 bg-white px-10 py-4 flex justify-end gap-3 z-10" style={{ borderTop: '2px solid #eef1f6' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          disabled={sending}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(7,16,31,0.10)',
            borderRadius: 8,
            color: '#5b6577',
            fontWeight: 500,
            padding: '8px 20px',
            cursor: sending ? 'not-allowed' : 'pointer',
            opacity: sending ? 0.5 : 1,
            fontSize: 14,
          }}
        >
          Cancel
        </button>
        <Button
          onClick={handleSend}
          className="bg-primary text-navy-dark hover:bg-primary/90 font-bold"
          disabled={sending}
        >
          <Send className="h-4 w-4 mr-2" />
          {sending ? 'Sending...' : 'Send Programming'}
        </Button>
      </div>
    </div>
  )
}

export default SendProgramming
