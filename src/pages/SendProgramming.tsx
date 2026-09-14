import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, startOfDay } from 'date-fns'
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
import { LoadError } from '@/components/pulse/LoadError'
import { Avatar } from '@/components/pulse/Avatar'
import { LoadRecChip } from '@/components/pulse/chips'
import { AthletePicker } from '@/components/pulse/AthletePicker'
import { HistoryPanel } from '@/components/pulse/HistoryPanel'
import { DragCalendar } from '@/components/pulse/DragCalendar'
import { VelocityZoneSlider } from '@/components/pulse/VelocityZoneSlider'
import { supabase } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const EXERCISE_LIBRARY = [
  // Squat pattern
  'Back Squat', 'Front Squat', 'Box Squat', 'Safety Bar Squat', 'Overhead Squat',
  'Zercher Squat', 'Split Squat', 'Bulgarian Split Squat', 'Goblet Squat', 'Hack Squat',
  // Hinge pattern
  'Deadlift', 'Romanian Deadlift', 'Trap Bar Deadlift', 'Sumo Deadlift', 'Stiff-Leg Deadlift',
  'Single Leg RDL', 'Good Morning', 'Hip Thrust', 'Rack Pull',
  // Upper body press
  'Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Close-Grip Bench Press',
  'Floor Press', 'Overhead Press', 'Push Press', 'Split Jerk',
  // Upper body pull
  'Barbell Row', 'Pendlay Row', 'T-Bar Row', 'Pull-ups', 'Chin-ups', 'Face Pull',
  // Olympic lifts
  'Power Clean', 'Hang Clean', 'Squat Clean', 'Clean Pull', 'Power Snatch',
  'Hang Snatch', 'Squat Snatch', 'Snatch Pull', 'Clean and Jerk',
  // Plyo / speed
  'Box Jump', 'Broad Jump', 'Depth Jump', 'Med Ball Throw', 'Med Ball Slam',
  'Sled Push', 'Sled Pull',
  // Accessory / single-leg
  'Walking Lunge', 'Reverse Lunge', 'Step-Up', 'Nordic Curl', 'Glute Ham Raise',
  'Calf Raise', "Farmer's Carry",
]

const toKey = (d: Date) => format(d, 'yyyy-MM-dd')

/** Default program name so the field is never blank — the coach can still overwrite it. */
const defaultWorkoutName = () => `Program — ${format(new Date(), 'MMM d')}`

interface SetSpec {
  reps: number
  targetVelocity: number | null
}

interface BuilderExercise {
  name: string
  /** One entry per set — the source of truth for both the count and each set's reps/velocity. */
  perSet: SetSpec[]
  weight: number
  weightUnit: 'lbs' | 'kg'
  /** UI-only: false = one Reps field + one velocity slider apply to every set (default). */
  customized: boolean
  /**
   * Optional target velocity RANGE (m/s) for this exercise — what "Targets
   * Reached" evaluates logged reps against. Distinct from perSet[].targetVelocity
   * (a single prescribed point per set, shown on the slider above). Both
   * optional; both must be set for the exercise to count as targeted.
   */
  targetVelocityMin: number | null
  targetVelocityMax: number | null
}

const DEFAULT_SET: SetSpec = { reps: 5, targetVelocity: 0.75 }

const makeUniformSets = (count: number, template: SetSpec = DEFAULT_SET): SetSpec[] =>
  Array.from({ length: Math.max(1, count) }, () => ({ ...template }))

const fromTemplateExercise = (ex: TemplateExercise): BuilderExercise => {
  const targetVelocityMin = ex.targetVelocityMin ?? null
  const targetVelocityMax = ex.targetVelocityMax ?? null
  if (ex.perSet && ex.perSet.length > 0) {
    const perSet = ex.perSet.map(s => ({ reps: s.reps ?? 5, targetVelocity: s.targetVelocity ?? null }))
    const varies = perSet.some(s => s.reps !== perSet[0].reps || s.targetVelocity !== perSet[0].targetVelocity)
    return { name: ex.name, perSet, weight: 0, weightUnit: 'lbs', customized: varies, targetVelocityMin, targetVelocityMax }
  }
  // Template saved before per-set support existed — synthesize a uniform set list.
  return {
    name: ex.name,
    perSet: makeUniformSets(ex.sets ?? 3, { reps: ex.reps ?? 5, targetVelocity: ex.targetVelocity ?? 0.75 }),
    weight: 0,
    weightUnit: 'lbs',
    customized: false,
    targetVelocityMin,
    targetVelocityMax,
  }
}

// ─── Exercise editor card (builder) ──────────────────────────────────────────

interface ExerciseCardProps {
  ex: BuilderExercise
  idx: number
  onChange: (idx: number, ex: BuilderExercise) => void
  onRemove: (idx: number) => void
}

const EXERCISE_LIBRARY_LOWER = new Set(EXERCISE_LIBRARY.map(e => e.toLowerCase()))

/**
 * Exercise-name field with a filtered, capped suggestion dropdown instead of a
 * native <datalist> — with ~57 library entries, the browser's own datalist UI
 * just dumps the entire list as one long unstyled scrollbox. Custom names are
 * still freely allowed; unrecognized ones get a warning (1RM tracking is keyed
 * by exact name, so inconsistent spelling splits it across "two" exercises).
 */
function ExerciseNameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const trimmed = value.trim()
  const suggestions = trimmed.length > 0
    ? EXERCISE_LIBRARY.filter(e => e.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 6)
    : []
  const unrecognized = trimmed.length > 0 && !EXERCISE_LIBRARY_LOWER.has(trimmed.toLowerCase())

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        className="v-input"
        placeholder="Exercise name"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{ height: 32, width: '100%' }}
      />
      {open && suggestions.length > 0 && (
        <div className="v-card v-pop" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20, padding: 4, maxHeight: 216, overflow: 'auto' }}>
          {suggestions.map(s => (
            <div
              key={s}
              className="v-menuitem"
              style={{ padding: '7px 10px', fontSize: 12.5 }}
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false) }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
      {unrecognized && (
        <div className="v-meta" style={{ fontSize: 11, color: 'var(--warn)', marginTop: 6 }}>
          Not in the exercise library — double-check spelling. Inconsistent names split 1RM tracking for the same lift.
        </div>
      )}
    </div>
  )
}

/** Small square on/off checkbox matching the app's existing checkbox pattern. */
function MiniCheckbox({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 15, height: 15, borderRadius: 4, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1.5px solid ' + (on ? 'var(--brand)' : 'var(--line-2)'),
        background: on ? 'var(--brand)' : 'var(--surface-1)',
        color: 'var(--brand-ink)',
      }}
    >
      {on && <Check size={11} strokeWidth={2.5} />}
    </span>
  )
}

/**
 * Optional target-velocity-range inputs (m/s) — what "Targets Reached" scores
 * an athlete's logged reps against. Deliberately just two plain number fields:
 * no slider, no zone picker — data entry only, and both are optional.
 */
function TargetRangeInputs({
  min, max, onChange,
}: {
  min: number | null
  max: number | null
  onChange: (patch: { targetVelocityMin?: number | null; targetVelocityMax?: number | null }) => void
}) {
  const parse = (raw: string): number | null => (raw === '' ? null : Number(raw))
  return (
    <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="v-label" style={{ fontSize: 9 }}>Target min (m/s)</span>
        <input
          className="v-input mono"
          type="number"
          step={0.05}
          min={0}
          placeholder="optional"
          value={min ?? ''}
          onChange={e => onChange({ targetVelocityMin: parse(e.target.value) })}
          style={{ width: 96, height: 30 }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="v-label" style={{ fontSize: 9 }}>Target max (m/s)</span>
        <input
          className="v-input mono"
          type="number"
          step={0.05}
          min={0}
          placeholder="optional"
          value={max ?? ''}
          onChange={e => onChange({ targetVelocityMax: parse(e.target.value) })}
          style={{ width: 96, height: 30 }}
        />
      </div>
      {min != null && max != null && min > max && (
        <span className="v-meta" style={{ fontSize: 11, color: 'var(--warn)' }}>min is above max</span>
      )}
    </div>
  )
}

/**
 * One compact row for a single set's reps + target velocity. The velocity is a
 * clickable pill rather than its own inline slider — clicking it selects that
 * set, which drives the shared VelocityZoneSlider panel rendered alongside the
 * whole list (see SetVelocityPanel). Only one set is selected at a time.
 */
function SetRow({
  index, spec, isSelected, onSelect, onChange,
}: {
  index: number
  spec: SetSpec
  isSelected: boolean
  onSelect: () => void
  onChange: (patch: Partial<SetSpec>) => void
}) {
  const zone = zoneOf(spec.targetVelocity ?? 0)
  return (
    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
      <span className="v-mute2 mono" style={{ width: 42, fontSize: 11.5, flexShrink: 0 }}>Set {index + 1}</span>
      <input
        className="v-input mono"
        type="number"
        min={1}
        max={100}
        value={spec.reps}
        onChange={e => onChange({ reps: e.target.value === '' ? 0 : Number(e.target.value) })}
        style={{ width: 52, height: 28 }}
        title="Reps"
      />
      <span className="v-mute2" style={{ fontSize: 10.5 }}>reps @</span>
      <button
        type="button"
        onClick={onSelect}
        className="v-chip"
        style={{
          background: zone.color,
          color: '#fff',
          fontSize: 11,
          border: 'none',
          cursor: 'pointer',
          boxShadow: isSelected ? '0 0 0 2px var(--surface-0), 0 0 0 4px var(--ink-2)' : 'none',
        }}
      >
        {(spec.targetVelocity ?? 0).toFixed(2)} m/s
      </button>
    </div>
  )
}

/**
 * Sits to the right of the set list, separated by a hairline divider. Shows the
 * full VelocityZoneSlider bound to whichever set's pill was last clicked, titled
 * "Set N Target Velocity"; before anything's been clicked it shows a placeholder
 * instead of guessing which set to edit.
 */
function SetVelocityPanel({
  selectedIndex, spec, onChange,
}: {
  selectedIndex: number | null
  spec: SetSpec | null
  onChange: (patch: Partial<SetSpec>) => void
}) {
  if (selectedIndex === null || !spec) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          height: '100%',
          minHeight: 150,
          padding: '0 8px',
        }}
      >
        <span className="v-mute2" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
          Click a velocity pill on the left to set that set's target
        </span>
      </div>
    )
  }
  return (
    <VelocityZoneSlider
      value={spec.targetVelocity ?? 0.75}
      onChange={v => onChange({ targetVelocity: v })}
      showInfo
      label={`Set ${selectedIndex + 1} Target Velocity`}
    />
  )
}

function ExerciseCard({ ex, idx, onChange, onRemove }: ExerciseCardProps) {
  const set = <K extends keyof BuilderExercise>(field: K, v: BuilderExercise[K]) =>
    onChange(idx, { ...ex, [field]: v })

  // Which set's velocity panel is showing — at most one at a time across the list.
  const [selectedSetIdx, setSelectedSetIdx] = useState<number | null>(null)

  const setCount = (n: number) => {
    const count = Math.max(1, Math.min(20, n))
    if (count === ex.perSet.length) return
    const next = count > ex.perSet.length
      ? [...ex.perSet, ...Array.from({ length: count - ex.perSet.length }, () => ({ ...ex.perSet[ex.perSet.length - 1] }))]
      : ex.perSet.slice(0, count)
    set('perSet', next)
    if (selectedSetIdx !== null && selectedSetIdx >= count) setSelectedSetIdx(null)
  }

  const updateSet = (setIdx: number, patch: Partial<SetSpec>) =>
    set('perSet', ex.perSet.map((s, i) => (i === setIdx ? { ...s, ...patch } : s)))

  // In uniform mode, the single Reps/velocity fields read set 1 and write to every set.
  const uniformReps = ex.perSet[0]?.reps ?? 5
  const uniformVelocity = ex.perSet[0]?.targetVelocity ?? 0.75
  const setUniform = (patch: Partial<SetSpec>) => set('perSet', ex.perSet.map(s => ({ ...s, ...patch })))

  const toggleCustomized = () => {
    // Collapsing back to uniform applies set 1's values to every set, so nothing
    // is silently lost — the coach can always re-expand to see what they had.
    if (ex.customized) set('perSet', makeUniformSets(ex.perSet.length, ex.perSet[0]))
    set('customized', !ex.customized)
  }

  return (
    <div className="v-card" style={{ padding: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="v-avatar" style={{ width: 22, height: 22, fontSize: 10.5, background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}>
          {idx + 1}
        </span>
        <ExerciseNameInput value={ex.name} onChange={v => set('name', v)} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="v-label" style={{ fontSize: 9 }}>Sets</span>
          <input
            className="v-input mono"
            type="number"
            min={1}
            max={20}
            value={ex.perSet.length}
            onChange={e => setCount(e.target.value === '' ? 1 : Number(e.target.value))}
            style={{ width: 64, height: 30 }}
          />
        </div>
        {!ex.customized && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="v-label" style={{ fontSize: 9 }}>Reps</span>
            <input
              className="v-input mono"
              type="number"
              min={1}
              max={100}
              value={uniformReps}
              onChange={e => setUniform({ reps: e.target.value === '' ? 0 : Number(e.target.value) })}
              style={{ width: 64, height: 30 }}
            />
          </div>
        )}
        <label
          className="row"
          style={{ marginLeft: 'auto', gap: 7, cursor: 'pointer', fontSize: 11.5, color: 'var(--ink-2)' }}
          onClick={toggleCustomized}
        >
          <MiniCheckbox on={!ex.customized} />
          Same for every set
        </label>
      </div>

      <div style={{ marginTop: 10 }}>
        <TargetRangeInputs
          min={ex.targetVelocityMin}
          max={ex.targetVelocityMax}
          onChange={patch => onChange(idx, { ...ex, ...patch })}
        />
      </div>

      {!ex.customized ? (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-0)' }}>
          <VelocityZoneSlider value={uniformVelocity} onChange={v => setUniform({ targetVelocity: v })} showInfo />
        </div>
      ) : (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-0)', display: 'flex', gap: 16 }}>
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ex.perSet.map((s, i) => (
              <SetRow
                key={i}
                index={i}
                spec={s}
                isSelected={selectedSetIdx === i}
                onSelect={() => setSelectedSetIdx(i)}
                onChange={patch => updateSet(i, patch)}
              />
            ))}
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line-0)', flexShrink: 0 }} />
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <SetVelocityPanel
              selectedIndex={selectedSetIdx}
              spec={selectedSetIdx !== null ? ex.perSet[selectedSetIdx] ?? null : null}
              onChange={patch => selectedSetIdx !== null && updateSet(selectedSetIdx, patch)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Template editor dialog (create / edit) ──────────────────────────────────

interface EditorExercise {
  name: string
  perSet: SetSpec[]
  customized: boolean
  showVelocity: boolean
  targetVelocityMin: number | null
  targetVelocityMax: number | null
}

const toEditorExercise = (ex: TemplateExercise): EditorExercise => {
  const targetVelocityMin = ex.targetVelocityMin ?? null
  const targetVelocityMax = ex.targetVelocityMax ?? null
  if (ex.perSet && ex.perSet.length > 0) {
    const perSet = ex.perSet.map(s => ({ reps: s.reps ?? 5, targetVelocity: s.targetVelocity ?? null }))
    const varies = perSet.some(s => s.reps !== perSet[0].reps || s.targetVelocity !== perSet[0].targetVelocity)
    return { name: ex.name, perSet, customized: varies, showVelocity: perSet.some(s => s.targetVelocity != null), targetVelocityMin, targetVelocityMax }
  }
  // Template saved before per-set support existed — synthesize a uniform set list.
  return {
    name: ex.name,
    perSet: makeUniformSets(ex.sets ?? 3, { reps: ex.reps ?? 5, targetVelocity: ex.targetVelocity ?? 0.75 }),
    customized: false,
    showVelocity: ex.targetVelocity != null,
    targetVelocityMin,
    targetVelocityMax,
  }
}

/** One compact template exercise row — mirrors ExerciseCard's per-set editing. */
function TemplateExerciseRow({
  ex, idx, onChange, onRemove,
}: {
  ex: EditorExercise
  idx: number
  onChange: (idx: number, patch: Partial<EditorExercise>) => void
  onRemove: (idx: number) => void
}) {
  const [selectedSetIdx, setSelectedSetIdx] = useState<number | null>(null)

  const setCount = (n: number) => {
    const count = Math.max(1, Math.min(20, n))
    if (count === ex.perSet.length) return
    const next = count > ex.perSet.length
      ? [...ex.perSet, ...Array.from({ length: count - ex.perSet.length }, () => ({ ...ex.perSet[ex.perSet.length - 1] }))]
      : ex.perSet.slice(0, count)
    onChange(idx, { perSet: next })
    if (selectedSetIdx !== null && selectedSetIdx >= count) setSelectedSetIdx(null)
  }
  const updateSet = (si: number, patch: Partial<SetSpec>) =>
    onChange(idx, { perSet: ex.perSet.map((s, i) => (i === si ? { ...s, ...patch } : s)) })
  const uniformReps = ex.perSet[0]?.reps ?? 5
  const uniformVelocity = ex.perSet[0]?.targetVelocity ?? 0.75
  const setUniform = (patch: Partial<SetSpec>) => onChange(idx, { perSet: ex.perSet.map(s => ({ ...s, ...patch })) })
  const toggleCustomized = () => {
    if (ex.customized) onChange(idx, { perSet: makeUniformSets(ex.perSet.length, ex.perSet[0]), customized: false })
    else onChange(idx, { customized: true })
  }
  const toggleVelocity = () =>
    ex.showVelocity
      ? onChange(idx, { showVelocity: false })
      : onChange(idx, { showVelocity: true, perSet: ex.perSet.map(s => ({ ...s, targetVelocity: s.targetVelocity ?? 0.75 })) })

  return (
    <div className="v-card" style={{ padding: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="v-avatar" style={{ width: 22, height: 22, fontSize: 10.5, background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}>{idx + 1}</span>
        <ExerciseNameInput value={ex.name} onChange={v => onChange(idx, { name: v })} />
        <button
          className="v-btn ghost"
          style={{ width: 30, padding: 0, justifyContent: 'center', color: 'var(--bad)' }}
          onClick={() => onRemove(idx)}
        >
          <Trash2 size={12} strokeWidth={1.5} />
        </button>
      </div>
      <div className="row" style={{ gap: 10, marginTop: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="v-label" style={{ fontSize: 9 }}>Sets</span>
          <input
            className="v-input mono"
            type="number"
            min={1}
            max={20}
            value={ex.perSet.length}
            onChange={e => setCount(e.target.value === '' ? 1 : Number(e.target.value))}
            style={{ width: 64, height: 30 }}
          />
        </div>
        {!ex.customized && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="v-label" style={{ fontSize: 9 }}>Reps</span>
            <input
              className="v-input mono"
              type="number"
              min={1}
              max={100}
              value={uniformReps}
              onChange={e => setUniform({ reps: e.target.value === '' ? 0 : Number(e.target.value) })}
              style={{ width: 64, height: 30 }}
            />
          </div>
        )}
        <button className="v-btn" style={{ height: 30, fontSize: 11.5 }} onClick={toggleVelocity}>
          {ex.showVelocity ? <X size={12} strokeWidth={1.5} /> : <Plus size={12} strokeWidth={1.5} />}
          Velocity target
        </button>
        <label
          className="row"
          style={{ marginLeft: 'auto', gap: 7, cursor: 'pointer', fontSize: 11.5, color: 'var(--ink-2)' }}
          onClick={toggleCustomized}
        >
          <MiniCheckbox on={!ex.customized} />
          Same for every set
        </label>
      </div>

      <div style={{ marginTop: 10 }}>
        <TargetRangeInputs
          min={ex.targetVelocityMin}
          max={ex.targetVelocityMax}
          onChange={patch => onChange(idx, patch)}
        />
      </div>

      {ex.customized ? (
        ex.showVelocity ? (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-0)', display: 'flex', gap: 16 }}>
            <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ex.perSet.map((s, i) => (
                <SetRow
                  key={i}
                  index={i}
                  spec={s}
                  isSelected={selectedSetIdx === i}
                  onSelect={() => setSelectedSetIdx(i)}
                  onChange={patch => updateSet(i, patch)}
                />
              ))}
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line-0)', flexShrink: 0 }} />
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <SetVelocityPanel
                selectedIndex={selectedSetIdx}
                spec={selectedSetIdx !== null ? ex.perSet[selectedSetIdx] ?? null : null}
                onChange={patch => selectedSetIdx !== null && updateSet(selectedSetIdx, patch)}
              />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-0)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ex.perSet.map((s, i) => (
              <div key={i} className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span className="v-mute2 mono" style={{ width: 42, fontSize: 11.5, flexShrink: 0 }}>Set {i + 1}</span>
                <input
                  className="v-input mono"
                  type="number"
                  min={1}
                  max={100}
                  value={s.reps}
                  onChange={e => updateSet(i, { reps: e.target.value === '' ? 0 : Number(e.target.value) })}
                  style={{ width: 52, height: 28 }}
                />
                <span className="v-mute2" style={{ fontSize: 10.5 }}>reps</span>
              </div>
            ))}
          </div>
        )
      ) : ex.showVelocity && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-0)' }}>
          <VelocityZoneSlider value={uniformVelocity} onChange={v => setUniform({ targetVelocity: v })} showInfo />
        </div>
      )}
    </div>
  )
}

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
    const clean: TemplateExercise[] = exercises.map(ex => {
      const perSet = ex.perSet.map(s => ({
        reps: s.reps,
        targetVelocity: ex.showVelocity ? (s.targetVelocity ?? undefined) : undefined,
      }))
      const first = perSet[0]
      return {
        name: ex.name,
        sets: perSet.length,
        reps: first?.reps,
        targetVelocity: ex.showVelocity ? (first?.targetVelocity ?? undefined) : undefined,
        perSet,
        targetVelocityMin: ex.targetVelocityMin,
        targetVelocityMax: ex.targetVelocityMax,
      }
    })
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
                onClick={() => setExercises(p => [...p, { name: '', perSet: makeUniformSets(3, { reps: 5, targetVelocity: null }), customized: false, showVelocity: false, targetVelocityMin: null, targetVelocityMax: null }])}
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
                  <TemplateExerciseRow
                    key={i}
                    ex={ex}
                    idx={i}
                    onChange={(idx, patch) => update(idx, patch)}
                    onRemove={idx => setExercises(p => p.filter((_, x) => x !== idx))}
                  />
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

  // Previously this fired the success toast unconditionally — and without even
  // awaiting — so a template that failed to save (RLS rejection, schema mismatch)
  // was reported to the coach as saved, and they'd only discover otherwise when it
  // was missing later (§4.4). The editor now stays open on failure so their work
  // isn't lost.
  const handleSave = async (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => {
    if (editing) {
      const ok = await updateTemplate(editing.id, data)
      if (!ok) {
        toast.error("Couldn't update the template. Please try again.")
        return
      }
      toast.success('Template updated')
    } else {
      const created = await addTemplate(data)
      if (!created) {
        toast.error("Couldn't create the template. Please try again.")
        return
      }
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
        <div className="v-scroll" style={{ maxHeight: 720, overflow: 'auto', paddingRight: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
          {templates.map(t => (
            <div key={t.id} className="v-card padded" style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 280 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
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
                    onClick={async () => {
                      const ok = await duplicateTemplate(t)
                      if (ok) toast.success('Template duplicated')
                      else toast.error("Couldn't duplicate that template. Please try again.")
                    }}
                  >
                    <Copy size={12} strokeWidth={1.5} />
                  </button>
                  <button
                    className="v-btn ghost"
                    style={{ width: 28, padding: 0, justifyContent: 'center', color: 'var(--bad)' }}
                    title="Delete"
                    onClick={async () => {
                      const ok = await deleteTemplate(t.id)
                      if (ok) toast.success('Template deleted')
                      else toast.error("Couldn't delete that template. Please try again.")
                    }}
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {t.description && (
                <div
                  className="v-meta ellipsis"
                  style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)', flexShrink: 0 }}
                >
                  {t.description}
                </div>
              )}

              <div
                className="v-scroll"
                style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--line-0)', paddingTop: 10, flex: 1, minHeight: 0, overflowY: 'auto' }}
              >
                {t.exercises.map((e, i) => {
                  const varies = !!e.perSet && e.perSet.length > 1 &&
                    e.perSet.some(s => s.reps !== e.perSet![0].reps || s.targetVelocity !== e.perSet![0].targetVelocity)
                  const zone = e.targetVelocity != null ? zoneOf(e.targetVelocity) : null
                  return (
                    <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                      <span className="row" style={{ gap: 8, minWidth: 0 }}>
                        <Dumbbell size={12} strokeWidth={1.5} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                        <span className="ellipsis" style={{ color: 'var(--ink-1)' }}>{e.name}</span>
                      </span>
                      <span className="row" style={{ gap: 8, flexShrink: 0 }}>
                        <span className="mono v-mute2" style={{ fontSize: 11 }}>
                          {e.sets != null && e.reps != null ? `${e.sets}×${e.reps}${varies ? ' (varies)' : ''}` : '—'}
                        </span>
                        {!varies && zone && e.targetVelocity != null ? (
                          <span className="v-chip" style={{ background: zone.color, color: '#fff', fontSize: 10 }}>
                            {e.targetVelocity.toFixed(2)}
                          </span>
                        ) : !varies ? (
                          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>—</span>
                        ) : null}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="row" style={{ justifyContent: 'space-between', paddingTop: 4, flexShrink: 0 }}>
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
  const tabParam = searchParams.get('tab')
  const tab = tabParam === 'templates' ? 'templates' : tabParam === 'history' ? 'history' : 'build'
  const setTab = (t: 'build' | 'templates' | 'history') =>
    setSearchParams(t === 'build' ? {} : { tab: t }, { replace: true })

  const [workoutName, setWorkoutName] = useState(defaultWorkoutName)
  const [selectedDates, setSelectedDates] = useState<Date[]>([startOfDay(new Date())])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [exercises, setExercises] = useState<BuilderExercise[]>([])
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([])
  const [filterGroup, setFilterGroup] = useState('all')
  const [sending, setSending] = useState(false)

  const [athletes, setAthletes] = useState<PlayerWithStats[]>([])
  const [groupsList, setGroupsList] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [coachDbId, setCoachDbId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      setLoadError(null)
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
      // Previously console-only, so a failed load rendered the builder with an empty
      // athlete list and no groups — looking like a coach with no roster (§4.3).
      console.error('Error loading data:', err)
      setLoadError(err instanceof Error ? err.message : null)
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
    setExercises(p => [...p, { name: '', perSet: makeUniformSets(3), weight: 0, weightUnit: 'lbs', customized: false, targetVelocityMin: null, targetVelocityMax: null }])

  const resetBuilder = () => {
    setWorkoutName(defaultWorkoutName())
    setSelectedDates([startOfDay(new Date())])
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
        Validators.workoutSets(ex.perSet.length) ||
        Validators.workoutWeight(ex.weight)
      if (err) { toast.error(`Exercise ${i + 1}: ${err}`); return }
      if (ex.targetVelocityMin != null && ex.targetVelocityMax != null && ex.targetVelocityMin > ex.targetVelocityMax) {
        toast.error(`Exercise ${i + 1}: target min can't be above target max`); return
      }
      for (let s = 0; s < ex.perSet.length; s++) {
        const repsErr = Validators.workoutReps(ex.perSet[s].reps)
        if (repsErr) { toast.error(`Exercise ${i + 1}, Set ${s + 1}: ${repsErr}`); return }
      }
    }

    try {
      setSending(true)
      const planData = {
        workoutName,
        exercises: exercises.map(ex => ({
          name: ex.name,
          weight: ex.weight,
          weightUnit: ex.weightUnit,
          perSet: ex.perSet.map(s => ({ reps: s.reps, targetVelocity: s.targetVelocity ?? 0 })),
          targetVelocityMin: ex.targetVelocityMin,
          targetVelocityMax: ex.targetVelocityMax,
        })),
        notes: 'Assigned by Coach',
      }

      // Each date is a separate insert that commits on its own — there is no
      // transaction across them. Track which dates actually succeeded instead of
      // assuming all did: the previous version hardcoded selectedDates.length into
      // the success message, so 4-of-5 sending still claimed "across 5 dates" and
      // then navigated away before the coach could read the error (§2.5).
      const failedDates: string[] = []
      let totalCount = 0
      let pushAttempted = 0
      let pushSent = 0

      for (const date of selectedDates) {
        const result = await sendWorkoutPlan(selectedAthletes, coachDbId, date, planData)
        if (result.success) {
          totalCount += result.count ?? 0
          pushAttempted += result.notificationsAttempted ?? 0
          pushSent += result.notificationsSent ?? 0
        } else {
          failedDates.push(format(date, 'MMM d'))
          console.error(`[Send programming] ${format(date, 'MMM d')} failed:`, result.error)
        }
      }

      const sentDates = selectedDates.length - failedDates.length
      const athleteLabel = `${selectedAthletes.length} athlete${selectedAthletes.length !== 1 ? 's' : ''}`

      // Plans are saved regardless; this only tells the coach whether devices were
      // actually pinged, which used to be console-only information (§6.5).
      if (pushAttempted > 0 && pushSent === 0) {
        toast.warning("Saved, but no push notifications could be delivered.", {
          description: 'Athletes will still see the workout in the app.',
          duration: 8000,
        })
      }

      if (failedDates.length === 0) {
        toast.success(
          `"${workoutName}" sent to ${athleteLabel} across ${sentDates} date${sentDates !== 1 ? 's' : ''}`
        )
        navigate('/')
      } else if (sentDates === 0) {
        toast.error(`Couldn't send "${workoutName}" for any of the selected dates.`)
      } else {
        // Partial success: stay on the page so the coach can see which dates failed
        // and retry just those, rather than being bounced to the dashboard.
        toast.warning(
          `Sent ${sentDates} of ${selectedDates.length} dates to ${athleteLabel}. Failed: ${failedDates.join(', ')}.`,
          { duration: 10000 }
        )
      }
    } catch (err) {
      console.error('[Send programming] Unexpected failure:', err)
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
      <LoadingOverlay isLoading={sending} fullScreen message="Sending programming..." />

      <main style={{ padding: '20px 28px 0', maxWidth: 1320, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <PageHeader
          title="Programming"
          subtitle="Assign velocity-based workouts to athletes across one or more dates."
          actions={
            <div className="row" style={{ gap: 4, background: 'var(--surface-sunk)', padding: 3, borderRadius: 9 }}>
              {([['build', 'New programming'], ['templates', 'Templates'], ['history', 'History']] as const).map(([id, label]) => (
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
          {loadError !== null && tab !== 'templates' && (
            <div style={{ marginBottom: 20 }}>
              <LoadError
                message={loadError}
                onRetry={loadData}
                title="Couldn't load your athletes and groups"
              />
            </div>
          )}
          {tab === 'templates' ? (
            <TemplatesTab onUse={useTemplate} />
          ) : tab === 'history' ? (
            <HistoryPanel />
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
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div className="v-label" style={{ marginBottom: 2 }}>Schedule dates</div>
                      {sortedDates.length > 0 && (
                        <button
                          className="v-btn ghost"
                          style={{ height: 22, fontSize: 11 }}
                          onClick={() => setSelectedDates([])}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
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
