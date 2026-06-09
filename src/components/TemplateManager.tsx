import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Plus,
  Trash2,
  Save,
  FileText,
  LayoutList,
  Copy,
  Search,
  X,
  ChevronDown,
  Info,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTemplates, WorkoutTemplate, WorkoutExercise } from '@/contexts/TemplatesContext'

interface TemplateManagerProps {
  open: boolean
  onClose: () => void
}

// --- SUB-COMPONENT: Dashed toggle button to add a field ---
const AddFieldBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
  >
    <Plus className="h-3 w-3" />
    {label}
  </button>
)

// --- VBT VELOCITY ZONES ---
const VBT_MAX = 1.6
const VBT_STEP = 0.05

const VELOCITY_ZONES = [
  { label: 'Absolute Strength',     short: 'Absolute',  min: 0,    max: 0.35, color: '#b91c1c' },
  { label: 'Accelerative Strength', short: 'Accel.',    min: 0.35, max: 0.5,  color: '#ef4444' },
  { label: 'Strength/Speed',        short: 'Str/Spd',   min: 0.5,  max: 0.75, color: '#f59e0b' },
  { label: 'Speed/Strength',        short: 'Spd/Str',   min: 0.75, max: 1.0,  color: '#84cc16' },
  { label: 'Starting Strength',     short: 'Starting',  min: 1.0,  max: 1.3,  color: '#22c55e' },
  { label: 'None',                  short: 'None',      min: 1.3,  max: 1.6,  color: '#16a34a' },
]

const TRACK_GRADIENT = VELOCITY_ZONES.map(z => {
  const s = (z.min / VBT_MAX) * 100
  const e = (z.max / VBT_MAX) * 100
  return `${z.color} ${s}%, ${z.color} ${e}%`
}).join(', ')

// Zone boundary tick marks: ms value → approximate %1RM (VBT research standard)
const ZONE_BOUNDARIES = [
  { ms: 0,    pct1rm: 100 },
  { ms: 0.35, pct1rm: 80  },
  { ms: 0.5,  pct1rm: 70  },
  { ms: 0.75, pct1rm: 50  },
  { ms: 1.0,  pct1rm: 30  },
  { ms: 1.3,  pct1rm: 20  },
  { ms: 1.6,  pct1rm: 0   },
]

const getZone = (v: number) =>
  VELOCITY_ZONES.find(z => v >= z.min && v < z.max) ?? VELOCITY_ZONES[VELOCITY_ZONES.length - 1]

const snap = (v: number) =>
  parseFloat((Math.round(Math.max(0, Math.min(VBT_MAX, v)) / VBT_STEP) * VBT_STEP).toFixed(2))
const fmt = (v: number) => v.toFixed(2)

// --- SUB-COMPONENT: Single-handle velocity zone slider ---
const VelocitySlider = ({
  value,
  onChange,
  onRemove,
}: {
  value: number
  onChange: (v: number) => void
  onRemove: () => void
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const toPct = (v: number) => (v / VBT_MAX) * 100

  const valFromClientX = (clientX: number) => {
    if (!trackRef.current) return 0
    const { left, width } = trackRef.current.getBoundingClientRect()
    return snap(((clientX - left) / width) * VBT_MAX)
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      onChangeRef.current(valFromClientX(e.clientX))
    }
    const onUp = () => { draggingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const zone = getZone(value)
  const pct = toPct(value)

  return (
    <div className="w-full space-y-2.5 pt-1 pb-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target Velocity (m/s)</span>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-muted-foreground/50 hover:text-primary transition-colors">
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-96 p-4 text-sm">
              <p className="font-semibold mb-1">Velocity-Based Training Zones</p>
              <p className="text-xs text-muted-foreground mb-3">
                Developed by <span className="font-medium text-foreground">Dr. Bryan Mann</span> from data collected on Division I athletes. Each zone targets a distinct neuromuscular adaptation based on bar speed.
              </p>
              <div className="space-y-1.5">
                {[
                  { label: 'Absolute Strength',     min: 0,    max: 0.35, color: '#b91c1c', pct: '>90%'   },
                  { label: 'Accelerative Strength', min: 0.35, max: 0.5,  color: '#ef4444', pct: '80–90%' },
                  { label: 'Strength/Speed',        min: 0.5,  max: 0.75, color: '#f59e0b', pct: '70–80%' },
                  { label: 'Speed/Strength',        min: 0.75, max: 1.0,  color: '#84cc16', pct: '50–70%' },
                  { label: 'Starting Strength',     min: 1.0,  max: 1.3,  color: '#22c55e', pct: '30–50%' },
                ].map(z => (
                  <div key={z.label} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: z.color }} />
                    <span className="font-medium">{z.label}</span>
                    <span className="text-muted-foreground ml-auto">{z.min}–{z.max} m/s · {z.pct} 1RM</span>
                  </div>
                ))}
              </div>
              <a
                href="https://www.vbtcoach.com/blog/velocity-zones-part-1"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline"
              >
                Learn more about Bryan Mann's velocity zones →
              </a>
            </PopoverContent>
          </Popover>
        </div>
        <button type="button" onClick={onRemove} className="text-muted-foreground/40 hover:text-destructive transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Zone color track with axes */}
      <div className="select-none">

        {/* %1RM axis — above bar */}
        <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">%1RM</p>
        <div className="relative h-3 mb-1">
          {ZONE_BOUNDARIES.map((b, i) => (
            <span
              key={b.ms}
              className="absolute top-0 text-[11px] text-muted-foreground leading-none"
              style={{
                left: `${(b.ms / VBT_MAX) * 100}%`,
                transform: i === 0 ? 'none' : i === ZONE_BOUNDARIES.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {b.pct1rm}%
            </span>
          ))}
        </div>

        {/* Colored bar */}
        <div
          ref={trackRef}
          className="relative h-7 rounded-lg cursor-crosshair"
          style={{ background: `linear-gradient(to right, ${TRACK_GRADIENT})` }}
          onMouseDown={e => {
            draggingRef.current = true
            onChangeRef.current(valFromClientX(e.clientX))
          }}
        >
          {/* Tick lines at zone boundaries */}
          {ZONE_BOUNDARIES.map(b => (
            <div
              key={b.ms}
              className="absolute top-0 bottom-0 w-px bg-black/20 pointer-events-none"
              style={{ left: `${(b.ms / VBT_MAX) * 100}%` }}
            />
          ))}

          {/* Handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-lg border-2 cursor-grab active:cursor-grabbing z-20 hover:scale-110 transition-transform"
            style={{ left: `${pct}%`, borderColor: zone.color }}
            onMouseDown={e => { e.stopPropagation(); draggingRef.current = true }}
          />
        </div>

        {/* m/s axis — below bar */}
        <div className="relative h-3 mt-1">
          {ZONE_BOUNDARIES.map((b, i) => (
            <span
              key={b.ms}
              className="absolute top-0 text-[11px] text-muted-foreground leading-none"
              style={{
                left: `${(b.ms / VBT_MAX) * 100}%`,
                transform: i === 0 ? 'none' : i === ZONE_BOUNDARIES.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {b.ms === 0 ? '0' : b.ms}
            </span>
          ))}
        </div>
        <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">m/s</p>

      </div>

      {/* Numeric input + active zone badge */}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step={VBT_STEP}
          min={0}
          max={VBT_MAX}
          value={fmt(value)}
          onChange={e => onChange(snap(parseFloat(e.target.value) || 0))}
          className="w-20 h-8 text-sm text-center"
        />
        <span
          className="text-[10px] font-semibold px-2 py-1 rounded-md text-white"
          style={{ background: zone.color }}
        >
          {zone.label}
        </span>
      </div>
    </div>
  )
}

// LocalExercise extends the persisted shape with UI-only toggle flags
type LocalExercise = WorkoutExercise & {
  showSetsReps: boolean
  showVelocity: boolean
}

const toLocal = (ex: WorkoutExercise): LocalExercise => ({
  ...ex,
  showSetsReps: ex.sets != null || ex.reps != null,
  showVelocity: ex.targetVelocity != null,
})

// --- SUB-COMPONENT: The Form Editor ---
const TemplateEditor = ({
  initialData,
  onSave,
  onCancel,
}: {
  initialData?: WorkoutTemplate | null
  onSave: (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => void
  onCancel: () => void
}) => {
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [exercises, setExercises] = useState<LocalExercise[]>(
    initialData?.exercises.map(toLocal) || []
  )
  const [openLibraryIdx, setOpenLibraryIdx] = useState<number | null>(null)

  const exerciseLibrary = [
    'Back Squat', 'Front Squat', 'Romanian Deadlift', 'Bench Press',
    'Overhead Press', 'Power Clean', 'Box Jump', 'Trap Bar Deadlift',
    'Bulgarian Split Squat', 'Pull-ups', 'Barbell Row',
  ]

  const addExercise = () => {
    setExercises([...exercises, {
      name: '',
      showSetsReps: false,
      showVelocity: false,
    }])
  }

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index))
  }

  const updateExercise = (index: number, updates: Partial<LocalExercise>) => {
    const updated = [...exercises]
    updated[index] = { ...updated[index], ...updates }
    setExercises(updated)
  }

  const handleSave = () => {
    if (!name.trim()) return toast.error('Template name is required')
    if (exercises.length === 0) return toast.error('Add at least one exercise')
    const incomplete = exercises.findIndex(ex => !ex.name.trim())
    if (incomplete !== -1) return toast.error(`Exercise #${incomplete + 1} is missing a name`)
    // Strip UI-only flags before persisting
    const clean = exercises.map(({ showSetsReps, showVelocity, ...ex }) => ex)
    onSave({ name, description, exercises: clean })
  }

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 pr-4 -mr-4">
        <div className="space-y-6 pb-6">
          {/* Template meta */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. In-Season Maintenance"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Notes about goal, tempo, etc."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Exercise list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Exercises ({exercises.length})</Label>
              <Button size="sm" variant="secondary" onClick={addExercise}>
                <Plus className="h-4 w-4 mr-1" /> Add Exercise
              </Button>
            </div>

            {exercises.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground bg-muted/30">
                <p>No exercises added yet.</p>
                <Button variant="link" onClick={addExercise}>Add your first exercise</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {exercises.map((ex, idx) => (
                  <Card key={idx} className="relative">
                    {/* Exercise name row */}
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                          {idx + 1}
                        </div>
                        <div className="relative flex-1">
                          <Input
                            value={ex.name}
                            onChange={e => updateExercise(idx, { name: e.target.value })}
                            onFocus={() => setOpenLibraryIdx(idx)}
                            onBlur={() => setTimeout(() => setOpenLibraryIdx(null), 150)}
                            placeholder="Exercise Name"
                            className="w-full font-medium pr-8"
                          />
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                          {openLibraryIdx === idx && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
                              {exerciseLibrary
                                .filter(e => !ex.name || e.toLowerCase().includes(ex.name.toLowerCase()))
                                .map(e => (
                                  <button
                                    key={e}
                                    type="button"
                                    onMouseDown={ev => ev.preventDefault()}
                                    onClick={() => { updateExercise(idx, { name: e }); setOpenLibraryIdx(null) }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                                  >
                                    {e}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => removeExercise(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 space-y-3">
                      {/* Compact fields row: Sets/Reps pill + add-buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {ex.showSetsReps && (
                          <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
                            <span className="text-xs text-muted-foreground">Sets</span>
                            <Input
                              type="number"
                              className="w-14 h-7 text-xs px-2"
                              placeholder="0"
                              value={ex.sets ?? ''}
                              onChange={e => updateExercise(idx, { sets: parseInt(e.target.value) || undefined })}
                            />
                            <span className="text-xs text-muted-foreground">Reps</span>
                            <Input
                              type="number"
                              className="w-14 h-7 text-xs px-2"
                              placeholder="0"
                              value={ex.reps ?? ''}
                              onChange={e => updateExercise(idx, { reps: parseInt(e.target.value) || undefined })}
                            />
                            <button
                              type="button"
                              className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => updateExercise(idx, { showSetsReps: false, sets: undefined, reps: undefined })}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {!ex.showSetsReps && (
                          <AddFieldBtn label="Sets/Reps" onClick={() => updateExercise(idx, { showSetsReps: true })} />
                        )}
                        {!ex.showVelocity && (
                          <AddFieldBtn label="Velocity" onClick={() => updateExercise(idx, { showVelocity: true })} />
                        )}
                      </div>

                      {/* Velocity zone slider — full width */}
                      {ex.showVelocity && (
                        <VelocitySlider
                          value={ex.targetVelocity ?? 0.75}
                          onChange={v => updateExercise(idx, { targetVelocity: v })}
                          onRemove={() => updateExercise(idx, { showVelocity: false, targetVelocity: undefined })}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="pt-4 mt-auto border-t flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          {initialData ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </div>
  )
}

// --- MAIN COMPONENT ---
export const TemplateManager = ({ open, onClose }: TemplateManagerProps) => {
  const { templates, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate } = useTemplates()
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const activeTemplate = templates.find(t => t.id === selectedTemplateId)

  const handleCreate = (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => {
    addTemplate(data)
    setIsCreating(false)
    setSelectedTemplateId(null)
    toast.success('Template created successfully')
  }

  const handleUpdate = (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => {
    if (!selectedTemplateId) return
    updateTemplate(selectedTemplateId, data)
    setSelectedTemplateId(null)
    toast.success('Template updated successfully')
  }

  const handleDelete = (id: string) => {
    deleteTemplate(id)
    if (selectedTemplateId === id) {
      setSelectedTemplateId(null)
      setIsCreating(false)
    }
    toast.success('Template deleted')
  }

  const handleDuplicate = (template: WorkoutTemplate) => {
    duplicateTemplate(template)
    toast.success('Template duplicated')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] p-0 flex flex-col overflow-hidden gap-0">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center bg-muted/10">
          <div>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <LayoutList className="h-6 w-6 text-primary" />
              Template Manager
            </DialogTitle>
            <DialogDescription>
              Create, edit, and manage your reusable workout templates.
            </DialogDescription>
          </div>
        </div>

        {/* Split View */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT SIDEBAR: Template List */}
          <div className="w-1/3 border-r bg-muted/10 flex flex-col">
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  className="pl-8 bg-background"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                className="w-full justify-start"
                onClick={() => { setSelectedTemplateId(null); setIsCreating(true) }}
                variant={isCreating ? 'secondary' : 'default'}
              >
                <Plus className="h-4 w-4 mr-2" /> New Template
              </Button>
            </div>

            <Separator />

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {filteredTemplates.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No templates found.</p>
                ) : (
                  filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      className={cn(
                        'group flex items-center justify-between p-3 rounded-md text-sm transition-colors cursor-pointer border border-transparent',
                        selectedTemplateId === template.id && !isCreating
                          ? 'bg-background border-border shadow-sm'
                          : 'hover:bg-background/50 hover:border-border/50'
                      )}
                      onClick={() => { setIsCreating(false); setSelectedTemplateId(template.id) }}
                    >
                      <div className="flex flex-col gap-1 overflow-hidden">
                        <span className="font-medium truncate">{template.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {template.exercises.length} exercises • {template.lastModified.toLocaleDateString()}
                        </span>
                      </div>

                      <div className={cn(
                        'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
                        selectedTemplateId === template.id ? 'opacity-100' : ''
                      )}>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          title="Duplicate"
                          onClick={e => { e.stopPropagation(); handleDuplicate(template) }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Delete"
                          onClick={e => { e.stopPropagation(); handleDelete(template.id) }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT PANE: Editor or Empty State */}
          <div className="flex-1 p-6 flex flex-col bg-background">
            {isCreating ? (
              <TemplateEditor
                key="new"
                initialData={null}
                onSave={handleCreate}
                onCancel={() => setIsCreating(false)}
              />
            ) : activeTemplate ? (
              <TemplateEditor
                key={activeTemplate.id}
                initialData={activeTemplate}
                onSave={handleUpdate}
                onCancel={() => setSelectedTemplateId(null)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <FileText className="h-16 w-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-foreground">No Template Selected</h3>
                <p className="max-w-xs text-center mt-2">
                  Select a template from the list to edit, or create a new one to get started.
                </p>
                <Button variant="outline" className="mt-6" onClick={() => setIsCreating(true)}>
                  Create New Template
                </Button>
              </div>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
