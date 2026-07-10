import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Plus, Trash2, Send, X, Check, Copy, Dumbbell, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Validators } from '@/lib/validators'
import { useAuth } from '@/contexts/AuthContext'
import { useTemplates, WorkoutTemplate, WorkoutExercise as TemplateExercise } from '@/contexts/TemplatesContext'
import { getPlayersWithStatsByCoach, PlayerWithStats } from '@/services/playersService'
import { sendWorkoutPlan } from '@/services/workoutPlansService'
import { zoneOf } from '@/lib/vbtZones'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { TopNav } from '@/components/TopNav'
import { PageHeader } from '@/components/pulse/PageHeader'
import { Avatar } from '@/components/pulse/Avatar'
import { LoadRecChip } from '@/components/pulse/chips'
import { DragCalendar } from '@/components/pulse/DragCalendar'
import { VelocityZoneSlider } from '@/components/pulse/VelocityZoneSlider'
import { supabase } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const EXERCISE_LIBRARY = [
  'Back Squat', 'Front Squat', 'Romanian Deadlift', 'Trap Bar Deadlift',
  'Bench Press', 'Incline Bench Press', 'Overhead Press', 'Push Press',
  'Power Clean', 'Hang Clean', 'Box Jump', 'Broad Jump',
  'Bulgarian Split Squat', 'Single Leg RDL', 'Pull-ups', 'Barbell Row',
  'Nordic Curl', 'Hip Thrust', 'Med Ball Throw', 'Sled Push',
]

const toKey = (d: Date) => format(d, 'yyyy-MM-dd')

interface BuilderExercise {
  name: string
  sets: number
  reps: number
  weight: number
  weightUnit: 'lbs' | 'kg'
  targetVelocity: number | null
}

const fromTemplateExercise = (ex: TemplateExercise): BuilderExercise => ({
  name: ex.name,
  sets: ex.sets ?? 3,
  reps: ex.reps ?? 5,
  weight: 0,
  weightUnit: 'lbs',
  targetVelocity: ex.targetVelocity ?? null,
})

// ─── Exercise editor card (builder) ──────────────────────────────────────────

interface ExerciseCardProps {
  ex: BuilderExercise
  idx: number
  onChange: (idx: number, ex: BuilderExercise) => void
  onRemove: (idx: number) => void
}

function ExerciseCard({ ex, idx, onChange, onRemove }: ExerciseCardProps) {
  const velocityOn = ex.targetVelocity != null
  const set = <K extends keyof BuilderExercise>(field: K, v: BuilderExercise[K]) =>
    onChange(idx, { ...ex, [field]: v })

  return (
    <div className="v-card" style={{ padding: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="v-avatar" style={{ width: 22, height: 22, fontSize: 10.5, background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}>
          {idx + 1}
        </span>
        <input
          className="v-input grow"
          list="ex-library"
          placeholder="Exercise name"
          value={ex.name}
          onChange={e => set('name', e.target.value)}
          style={{ height: 32 }}
        />
        <button
          className="v-btn ghost"
          style={{ width: 30, padding: 0, justifyContent: 'center', color: 'var(--bad)' }}
          onClick={() => onRemove(idx)}
          title="Remove exercise"
        >
          <Trash2 size={12} strokeWidth={1.5} />
        </button>
      </div>
      <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {([['sets', 'Sets'], ['reps', 'Reps'], ['weight', 'Weight']] as const).map(([f, label]) => (
          <div key={f} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="v-label" style={{ fontSize: 9 }}>{label}</span>
            <input
              className="v-input mono"
              type="number"
              min={0}
              value={ex[f]}
              onChange={e => set(f, e.target.value === '' ? 0 : Number(e.target.value))}
              style={{ width: 64, height: 30 }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="v-label" style={{ fontSize: 9 }}>Unit</span>
          <select
            className="v-input"
            value={ex.weightUnit}
            onChange={e => set('weightUnit', e.target.value as 'lbs' | 'kg')}
            style={{ height: 30, width: 60 }}
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>
        </div>
        <button
          className="v-btn"
          style={{ height: 30, marginLeft: 'auto', fontSize: 11.5 }}
          onClick={() => set('targetVelocity', velocityOn ? null : 0.75)}
        >
          {velocityOn ? <X size={12} strokeWidth={1.5} /> : <Plus size={12} strokeWidth={1.5} />}
          Velocity target
        </button>
      </div>
      {velocityOn && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-0)' }}>
          <VelocityZoneSlider value={ex.targetVelocity ?? 0.75} onChange={v => set('targetVelocity', v)} showInfo />
        </div>
      )}
    </div>
  )
}

// ─── Athlete picker ───────────────────────────────────────────────────────────

interface AthletePickerProps {
  athletes: PlayerWithStats[]
  groupsList: Array<{ id: string; name: string }>
  selected: string[]
  onToggle: (id: string) => void
  onBulk: (ids: string[]) => void
  filterGroup: string
  setFilterGroup: (id: string) => void
  loading: boolean
}

function AthletePicker({ athletes, groupsList, selected, onToggle, onBulk, filterGroup, setFilterGroup, loading }: AthletePickerProps) {
  const list = athletes.filter(a => filterGroup === 'all' || a.team_id === filterGroup)
  return (
    <div className="v-card flush" style={{ overflow: 'hidden' }}>
      <div style={{ padding: 14, borderBottom: '1px solid var(--line-0)', background: 'var(--surface-2)' }}>
        <div className="v-label" style={{ marginBottom: 8 }}>
          Recipients{selected.length > 0 ? ` · ${selected.length} selected` : ''}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select
            className="v-input"
            value={filterGroup}
            onChange={e => setFilterGroup(e.target.value)}
            style={{ height: 32, minWidth: 150 }}
          >
            <option value="all">All groups</option>
            {groupsList.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <button className="v-btn" style={{ height: 32, fontSize: 12 }} onClick={() => onBulk(list.map(a => a.id))}>
            Select all ({list.length})
          </button>
          <button className="v-btn ghost" style={{ height: 32, fontSize: 12 }} onClick={() => onBulk([])}>
            Clear
          </button>
        </div>
      </div>
      <div className="v-scroll" style={{ maxHeight: 320, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)', fontSize: 12.5 }}>Loading athletes…</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)', fontSize: 12.5 }}>No athletes found</div>
        ) : (
          list.map(a => {
            const on = selected.includes(a.id)
            return (
              <label
                key={a.id}
                className="row"
                style={{
                  gap: 10,
                  padding: '9px 14px',
                  borderBottom: '1px solid var(--line-0)',
                  cursor: 'pointer',
                  background: on ? 'var(--brand-soft)' : 'transparent',
                }}
              >
                <span
                  style={{
                    width: 17, height: 17, borderRadius: 5, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1.5px solid ' + (on ? 'var(--brand)' : 'var(--line-2)'),
                    background: on ? 'var(--brand)' : 'var(--surface-1)',
                    color: 'var(--brand-ink)',
                  }}
                >
                  {on && <Check size={12} strokeWidth={2} />}
                </span>
                <input type="checkbox" checked={on} onChange={() => onToggle(a.id)} style={{ display: 'none' }} />
                <Avatar name={a.name} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</div>
                  <div className="v-meta mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                    {a.jersey_number != null ? `#${a.jersey_number} · ` : ''}{a.group || '—'}
                  </div>
                </div>
                <LoadRecChip rec={a.loadRec} />
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Template editor dialog (create / edit) ──────────────────────────────────

type EditorExercise = TemplateExercise & { showVelocity: boolean }

const toEditorExercise = (ex: TemplateExercise): EditorExercise => ({
  ...ex,
  showVelocity: ex.targetVelocity != null,
})

interface TemplateEditorDialogProps {
  open: boolean
  initial: WorkoutTemplate | null
  onSave: (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => void
  onClose: () => void
}

function TemplateEditorDialog({ open, initial, onSave, onClose }: TemplateEditorDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [exercises, setExercises] = useState<EditorExercise[]>([])

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setDescription(initial?.description ?? '')
      setExercises(initial?.exercises.map(toEditorExercise) ?? [])
    }
  }, [open, initial])

  const update = (idx: number, updates: Partial<EditorExercise>) =>
    setExercises(p => p.map((ex, i) => (i === idx ? { ...ex, ...updates } : ex)))

  const save = () => {
    if (!name.trim()) return toast.error('Template name is required')
    if (exercises.length === 0) return toast.error('Add at least one exercise')
    const incomplete = exercises.findIndex(ex => !ex.name.trim())
    if (incomplete !== -1) return toast.error(`Exercise ${incomplete + 1} is missing a name`)
    const clean = exercises.map(({ showVelocity, ...ex }) => ({
      ...ex,
      targetVelocity: showVelocity ? ex.targetVelocity : undefined,
    }))
    onSave({ name: name.trim(), description: description.trim(), exercises: clean })
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 18 }}>{initial ? 'Edit template' : 'New template'}</DialogTitle>
          <DialogDescription>Reusable workout that loads into new programming.</DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="v-label" style={{ marginBottom: 6 }}>Template name</div>
            <input
              className="v-input"
              placeholder="e.g. In-Season Maintenance"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: '100%', height: 36 }}
            />
          </div>
          <div>
            <div className="v-label" style={{ marginBottom: 6 }}>Description</div>
            <textarea
              className="v-input"
              placeholder="Notes about goal, tempo, etc."
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ width: '100%', height: 64, padding: 10, resize: 'vertical', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}
            />
          </div>

          <div>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="v-label">Exercises · {exercises.length}</div>
              <button
                className="v-btn"
                style={{ fontSize: 12 }}
                onClick={() => setExercises(p => [...p, { name: '', sets: 3, reps: 5, showVelocity: false }])}
              >
                <Plus size={12} strokeWidth={1.5} />Add
              </button>
            </div>
            {exercises.length === 0 ? (
              <div style={{ border: '1px dashed var(--line-2)', borderRadius: 8, padding: '28px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12.5 }}>
                No exercises yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {exercises.map((ex, i) => (
                  <div key={i} className="v-card" style={{ padding: 12 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="v-avatar" style={{ width: 22, height: 22, fontSize: 10.5, background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}>{i + 1}</span>
                      <input
                        className="v-input grow"
                        list="ex-library"
                        placeholder="Exercise name"
                        value={ex.name}
                        onChange={e => update(i, { name: e.target.value })}
                        style={{ height: 32 }}
                      />
                      <button
                        className="v-btn ghost"
                        style={{ width: 30, padding: 0, justifyContent: 'center', color: 'var(--bad)' }}
                        onClick={() => setExercises(p => p.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="row" style={{ gap: 10, marginTop: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      {([['sets', 'Sets'], ['reps', 'Reps']] as const).map(([f, label]) => (
                        <div key={f} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className="v-label" style={{ fontSize: 9 }}>{label}</span>
                          <input
                            className="v-input mono"
                            type="number"
                            min={0}
                            value={ex[f] ?? ''}
                            placeholder="—"
                            onChange={e => update(i, { [f]: e.target.value === '' ? undefined : Number(e.target.value) })}
                            style={{ width: 64, height: 30 }}
                          />
                        </div>
                      ))}
                      <button
                        className="v-btn"
                        style={{ height: 30, marginLeft: 'auto', fontSize: 11.5 }}
                        onClick={() =>
                          ex.showVelocity
                            ? update(i, { showVelocity: false, targetVelocity: undefined })
                            : update(i, { showVelocity: true, targetVelocity: ex.targetVelocity ?? 0.75 })
                        }
                      >
                        {ex.showVelocity ? <X size={12} strokeWidth={1.5} /> : <Plus size={12} strokeWidth={1.5} />}
                        Velocity target
                      </button>
                    </div>
                    {ex.showVelocity && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-0)' }}>
                        <VelocityZoneSlider value={ex.targetVelocity ?? 0.75} onChange={v => update(i, { targetVelocity: v })} showInfo />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--line-0)', paddingTop: 16, marginTop: 4 }}>
          <button className="v-btn ghost" onClick={onClose}>Cancel</button>
          <button className="v-btn primary" onClick={save}>
            {initial ? 'Update template' : 'Create template'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Templates tab ────────────────────────────────────────────────────────────

interface TemplatesTabProps {
  onUse: (t: WorkoutTemplate) => void
}

function TemplatesTab({ onUse }: TemplatesTabProps) {
  const { templates, loading, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate } = useTemplates()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null)

  const openCreate = () => { setEditing(null); setEditorOpen(true) }
  const openEdit = (t: WorkoutTemplate) => { setEditing(t); setEditorOpen(true) }

  const handleSave = (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => {
    if (editing) {
      updateTemplate(editing.id, data)
      toast.success('Template updated')
    } else {
      addTemplate(data)
      toast.success('Template created')
    }
    setEditorOpen(false)
    setEditing(null)
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="v-meta">
          {loading ? 'Loading templates…' : `${templates.length} reusable template${templates.length !== 1 ? 's' : ''} · click "Use template" to load one into new programming.`}
        </div>
        <button className="v-btn brand" onClick={openCreate}>
          <Plus size={12} strokeWidth={1.5} />New template
        </button>
      </div>

      {!loading && templates.length === 0 ? (
        <div className="v-card padded" style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 12.5, padding: '48px 16px' }}>
          No templates yet — create one to speed up programming.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {templates.map(t => (
            <div key={t.id} className="v-card padded" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="v-h3">{t.name}</div>
                  <span className="v-chip" data-tone="neutral" style={{ marginTop: 6 }}>
                    <span className="dot" style={{ background: 'var(--brand)' }} />
                    {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="v-btn ghost" style={{ width: 28, padding: 0, justifyContent: 'center' }} title="Edit" onClick={() => openEdit(t)}>
                    <Pencil size={12} strokeWidth={1.5} />
                  </button>
                  <button
                    className="v-btn ghost"
                    style={{ width: 28, padding: 0, justifyContent: 'center' }}
                    title="Duplicate"
                    onClick={() => { duplicateTemplate(t); toast.success('Template duplicated') }}
                  >
                    <Copy size={12} strokeWidth={1.5} />
                  </button>
                  <button
                    className="v-btn ghost"
                    style={{ width: 28, padding: 0, justifyContent: 'center', color: 'var(--bad)' }}
                    title="Delete"
                    onClick={() => { deleteTemplate(t.id); toast.success('Template deleted') }}
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {t.description && (
                <div className="v-meta" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)' }}>{t.description}</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--line-0)', paddingTop: 10 }}>
                {t.exercises.map((e, i) => {
                  const zone = e.targetVelocity != null ? zoneOf(e.targetVelocity) : null
                  return (
                    <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                      <span className="row" style={{ gap: 8, minWidth: 0 }}>
                        <Dumbbell size={12} strokeWidth={1.5} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                        <span className="ellipsis" style={{ color: 'var(--ink-1)' }}>{e.name}</span>
                      </span>
                      <span className="row" style={{ gap: 8, flexShrink: 0 }}>
                        <span className="mono v-mute2" style={{ fontSize: 11 }}>
                          {e.sets != null && e.reps != null ? `${e.sets}×${e.reps}` : '—'}
                        </span>
                        {zone && e.targetVelocity != null ? (
                          <span className="v-chip" style={{ background: zone.color, color: '#fff', fontSize: 10 }}>
                            {e.targetVelocity.toFixed(2)}
                          </span>
                        ) : (
                          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>—</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                <span className="v-meta mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                  edited {t.lastModified.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <button className="v-btn" style={{ height: 28, fontSize: 12 }} onClick={() => onUse(t)}>
                  Use template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateEditorDialog
        open={editorOpen}
        initial={editing}
        onSave={handleSave}
        onClose={() => { setEditorOpen(false); setEditing(null) }}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SendProgramming = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { templates } = useTemplates()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'templates' ? 'templates' : 'build'
  const setTab = (t: 'build' | 'templates') =>
    setSearchParams(t === 'templates' ? { tab: 'templates' } : {}, { replace: true })

  const [workoutName, setWorkoutName] = useState('')
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [exercises, setExercises] = useState<BuilderExercise[]>([])
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([])
  const [filterGroup, setFilterGroup] = useState('all')
  const [sending, setSending] = useState(false)

  const [athletes, setAthletes] = useState<PlayerWithStats[]>([])
  const [groupsList, setGroupsList] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [coachDbId, setCoachDbId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      // Client generics collapse to `never` on filtered queries (pre-existing) — cast per codebase convention.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: coachRow } = await (supabase as any)
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle() as { data: { id: string } | null }

      setCoachDbId(coachRow?.id ?? null)

      const groupQuery = coachRow?.id
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('groups').select('id, name').eq('coach_id', coachRow.id).order('name', { ascending: true })
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
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Templates in builder ─────────────────────────────────────────────────

  const rebuildFromTemplates = (ids: string[]) =>
    setExercises(ids.flatMap(id => (templates.find(t => t.id === id)?.exercises ?? []).map(fromTemplateExercise)))

  const toggleTemplate = (id: string) =>
    setSelectedTemplateIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      rebuildFromTemplates(next)
      return next
    })

  const useTemplate = (t: WorkoutTemplate) => {
    setSelectedTemplateIds([t.id])
    rebuildFromTemplates([t.id])
    if (!workoutName.trim()) setWorkoutName(t.name)
    setTab('build')
  }

  // ── Exercises ────────────────────────────────────────────────────────────

  const changeExercise = (i: number, v: BuilderExercise) =>
    setExercises(p => p.map((e, idx) => (idx === i ? v : e)))
  const removeExercise = (i: number) => setExercises(p => p.filter((_, idx) => idx !== i))
  const addExercise = () =>
    setExercises(p => [...p, { name: '', sets: 3, reps: 5, weight: 0, weightUnit: 'lbs', targetVelocity: null }])

  const resetBuilder = () => {
    setWorkoutName('')
    setSelectedDates([])
    setSelectedTemplateIds([])
    setExercises([])
    setSelectedAthletes([])
  }

  // ── Send ─────────────────────────────────────────────────────────────────

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
      const planData = {
        workoutName,
        exercises: exercises.map(ex => ({ ...ex, targetVelocity: ex.targetVelocity ?? 0 })),
        notes: 'Assigned by Coach',
      }

      let totalCount = 0
      for (const date of selectedDates) {
        const result = await sendWorkoutPlan(selectedAthletes, coachDbId, date, planData)
        if (result.success) totalCount += result.count ?? 0
        else toast.error(result.error ?? `Failed to send for ${format(date, 'MMM d')}`)
      }

      if (totalCount > 0) {
        toast.success(
          `"${workoutName}" sent to ${selectedAthletes.length} athlete${selectedAthletes.length !== 1 ? 's' : ''} across ${selectedDates.length} date${selectedDates.length !== 1 ? 's' : ''}`
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

  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="v-app">
      <TopNav />
      <datalist id="ex-library">
        {EXERCISE_LIBRARY.map(e => <option key={e} value={e} />)}
      </datalist>
      <LoadingOverlay isLoading={sending} fullScreen message="Sending programming..." />

      <main style={{ padding: '20px 28px 0', maxWidth: 1320, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <PageHeader
          eyebrow="Coach"
          title="Programming"
          subtitle="Assign velocity-based workouts to athletes across one or more dates."
          actions={
            <div className="row" style={{ gap: 4, background: 'var(--surface-sunk)', padding: 3, borderRadius: 9 }}>
              {([['build', 'New programming'], ['templates', 'Templates']] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className="v-btn"
                  style={{
                    height: 30,
                    fontSize: 12.5,
                    border: 'none',
                    background: tab === id ? 'var(--surface-1)' : 'transparent',
                    color: tab === id ? 'var(--ink-0)' : 'var(--ink-2)',
                    boxShadow: tab === id ? '0 1px 2px rgba(7,16,31,0.08)' : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />

        <div style={{ flex: 1 }}>
          {tab === 'templates' ? (
            <TemplatesTab onUse={useTemplate} />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32, alignItems: 'start' }}>
                {/* Left: name + calendar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div className="v-label" style={{ marginBottom: 6 }}>Program name</div>
                    <input
                      className="v-input"
                      placeholder="e.g. Spring Phase 1 — Power"
                      value={workoutName}
                      onChange={e => setWorkoutName(e.target.value)}
                      style={{ width: '100%', height: 36 }}
                    />
                  </div>
                  <div>
                    <div className="v-label" style={{ marginBottom: 2 }}>Schedule dates</div>
                    <div className="v-meta" style={{ fontSize: 11.5, marginBottom: 10 }}>
                      Click to toggle · hold &amp; drag to select a span.
                    </div>
                    <div className="v-card padded">
                      <DragCalendar selected={selectedDates} onSelect={setSelectedDates} />
                    </div>
                    {sortedDates.length > 0 && (
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                        {sortedDates.map(d => (
                          <button
                            key={toKey(d)}
                            className="v-chip"
                            data-tone="brand"
                            style={{ cursor: 'pointer', border: 'none' }}
                            onClick={() => setSelectedDates(prev => prev.filter(x => toKey(x) !== toKey(d)))}
                            title="Remove date"
                          >
                            {format(d, 'EEE MMM d')}
                            <X size={10} strokeWidth={2} style={{ marginLeft: 2 }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: templates + exercises + athletes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="v-card padded">
                    <div className="v-label" style={{ marginBottom: 10 }}>Load from templates</div>
                    {templates.length === 0 ? (
                      <div className="v-meta" style={{ fontSize: 12 }}>
                        No templates yet — create one in the Templates tab.
                      </div>
                    ) : (
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        {templates.map(t => {
                          const on = selectedTemplateIds.includes(t.id)
                          return (
                            <button
                              key={t.id}
                              onClick={() => toggleTemplate(t.id)}
                              className="v-btn"
                              style={{
                                height: 30,
                                fontSize: 12,
                                background: on ? 'var(--ink-0)' : 'var(--surface-1)',
                                color: on ? '#fff' : 'var(--ink-1)',
                                borderColor: on ? 'var(--ink-0)' : 'var(--line-1)',
                              }}
                            >
                              {on && <Check size={12} strokeWidth={1.5} />}
                              {t.name}
                              <span className="mono" style={{ opacity: 0.55, fontSize: 10.5, marginLeft: 2 }}>{t.exercises.length}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="v-card padded">
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div className="v-h3">Exercises</div>
                        <div className="v-meta" style={{ fontSize: 11.5, marginTop: 1 }}>
                          {exercises.length
                            ? `${exercises.length} prescribed · adjust loads & velocity targets`
                            : 'Pick a template or add exercises manually.'}
                        </div>
                      </div>
                      <button className="v-btn" style={{ fontSize: 12 }} onClick={addExercise}>
                        <Plus size={12} strokeWidth={1.5} />Add
                      </button>
                    </div>
                    {exercises.length === 0 ? (
                      <div style={{ border: '1px dashed var(--line-2)', borderRadius: 8, padding: '28px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12.5 }}>
                        No exercises yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {exercises.map((ex, i) => (
                          <ExerciseCard key={i} ex={ex} idx={i} onChange={changeExercise} onRemove={removeExercise} />
                        ))}
                      </div>
                    )}
                  </div>

                  <AthletePicker
                    athletes={athletes}
                    groupsList={groupsList}
                    selected={selectedAthletes}
                    filterGroup={filterGroup}
                    setFilterGroup={setFilterGroup}
                    onToggle={id => setSelectedAthletes(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))}
                    onBulk={setSelectedAthletes}
                    loading={loading}
                  />
                </div>
              </div>

              {/* Sticky action bar */}
              <div
                style={{
                  position: 'sticky',
                  bottom: 0,
                  marginTop: 28,
                  marginLeft: -28,
                  marginRight: -28,
                  padding: '14px 28px',
                  borderTop: '1px solid var(--line-0)',
                  background: 'var(--surface-1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  zIndex: 10,
                }}
              >
                <div className="v-meta mono" style={{ fontSize: 11.5 }}>
                  {selectedAthletes.length} athlete{selectedAthletes.length !== 1 ? 's' : ''} · {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''} · {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                </div>
                <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
                  <button className="v-btn ghost" onClick={resetBuilder} disabled={sending}>Reset</button>
                  <button className="v-btn brand" onClick={handleSend} disabled={sending}>
                    <Send size={12} strokeWidth={1.5} />
                    {sending ? 'Sending…' : 'Send programming'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default SendProgramming
