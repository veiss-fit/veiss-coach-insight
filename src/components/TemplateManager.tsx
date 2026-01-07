import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { 
  Plus, 
  Trash2, 
  Save, 
  Dumbbell, 
  FileText, 
  LayoutList, 
  Copy, 
  ChevronRight,
  Search
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// --- Types ---
export interface WorkoutExercise {
  name: string
  sets: number
  reps: number
  weight: number
  weightUnit: 'lbs' | 'kg'
  targetVelocityMin: number
  targetVelocityMax: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  description: string
  exercises: WorkoutExercise[]
  lastModified: Date
}

interface TemplateManagerProps {
  open: boolean
  onClose: () => void
}

// --- MOCK DATA (Replace with Supabase fetch later) ---
const INITIAL_MOCK_TEMPLATES: WorkoutTemplate[] = [
  {
    id: '1',
    name: 'Hypertrophy Phase 1',
    description: 'Focus on volume and controlled eccentrics.',
    lastModified: new Date(),
    exercises: [
      { name: 'Back Squat', sets: 4, reps: 8, weight: 185, weightUnit: 'lbs', targetVelocityMin: 0.5, targetVelocityMax: 0.75 },
      { name: 'RDL', sets: 3, reps: 10, weight: 135, weightUnit: 'lbs', targetVelocityMin: 0, targetVelocityMax: 0 }
    ]
  },
  {
    id: '2',
    name: 'Power Development',
    description: 'Low volume, high velocity.',
    lastModified: new Date(),
    exercises: [
      { name: 'Power Clean', sets: 5, reps: 3, weight: 135, weightUnit: 'lbs', targetVelocityMin: 1.2, targetVelocityMax: 1.5 }
    ]
  }
]

// --- SUB-COMPONENT: The Form Editor ---
// This contains the logic from your old Builder, but isolated
const TemplateEditor = ({ 
  initialData, 
  onSave, 
  onCancel 
}: { 
  initialData?: WorkoutTemplate | null, 
  onSave: (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => void,
  onCancel: () => void
}) => {
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [exercises, setExercises] = useState<WorkoutExercise[]>(initialData?.exercises || [])

  // Hardcoded library for Quick Select
  const exerciseLibrary = [
    'Back Squat', 'Front Squat', 'Romanian Deadlift', 'Bench Press',
    'Overhead Press', 'Power Clean', 'Box Jump', 'Trap Bar Deadlift',
    'Bulgarian Split Squat', 'Pull-ups', 'Barbell Row',
  ]

  const addExercise = () => {
    setExercises([...exercises, {
      name: '', sets: 3, reps: 5, weight: 0, weightUnit: 'lbs', targetVelocityMin: 0, targetVelocityMax: 0
    }])
  }

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index))
  }

  const updateExercise = (index: number, field: keyof WorkoutExercise, value: any) => {
    const updated = [...exercises]
    updated[index] = { ...updated[index], [field]: value }
    setExercises(updated)
  }

  const handleSave = () => {
    if (!name.trim()) return toast.error('Template name is required')
    if (exercises.length === 0) return toast.error('Add at least one exercise')
    
    // Check for missing exercise names
    const incomplete = exercises.findIndex(ex => !ex.name.trim())
    if (incomplete !== -1) return toast.error(`Exercise #${incomplete + 1} is missing a name`)

    onSave({ name, description, exercises })
  }

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 pr-4 -mr-4">
        <div className="space-y-6 pb-6">
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
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </div>
                        <div className="flex flex-1 gap-2">
                          <Input 
                            value={ex.name} 
                            onChange={e => updateExercise(idx, 'name', e.target.value)}
                            placeholder="Exercise Name" 
                            className="flex-1 font-medium"
                          />
                          <Select onValueChange={v => updateExercise(idx, 'name', v)}>
                            <SelectTrigger className="w-[40px] px-0 justify-center">
                              <Dumbbell className="h-4 w-4 opacity-50" />
                            </SelectTrigger>
                            <SelectContent>
                              {exerciseLibrary.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeExercise(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {/* Sets */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Sets</Label>
                          <Input type="number" value={ex.sets || ''} onChange={e => updateExercise(idx, 'sets', parseInt(e.target.value) || 0)} />
                        </div>
                        {/* Reps */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Reps</Label>
                          <Input type="number" value={ex.reps || ''} onChange={e => updateExercise(idx, 'reps', parseInt(e.target.value) || 0)} />
                        </div>
                        {/* Weight */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Weight</Label>
                          <div className="flex gap-1">
                            <Input className="flex-1" type="number" value={ex.weight || ''} onChange={e => updateExercise(idx, 'weight', parseInt(e.target.value) || 0)} />
                            <Select value={ex.weightUnit} onValueChange={v => updateExercise(idx, 'weightUnit', v)}>
                              <SelectTrigger className="w-[60px] px-2 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="lbs">lbs</SelectItem><SelectItem value="kg">kg</SelectItem></SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* Velocity */}
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs text-muted-foreground">Velocity (m/s)</Label>
                          <div className="flex gap-2 items-center">
                            <Input type="number" step="0.1" placeholder="Min" value={ex.targetVelocityMin || ''} onChange={e => updateExercise(idx, 'targetVelocityMin', parseFloat(e.target.value) || 0)} />
                            <span className="text-muted-foreground">-</span>
                            <Input type="number" step="0.1" placeholder="Max" value={ex.targetVelocityMax || ''} onChange={e => updateExercise(idx, 'targetVelocityMax', parseFloat(e.target.value) || 0)} />
                          </div>
                        </div>
                      </div>
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
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(INITIAL_MOCK_TEMPLATES)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter templates for sidebar
  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const activeTemplate = templates.find(t => t.id === selectedTemplateId)

  // -- Actions --

  const handleCreate = (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => {
    const newTemplate: WorkoutTemplate = {
      ...data,
      id: Math.random().toString(36).substr(2, 9), // Mock ID
      lastModified: new Date()
    }
    setTemplates([...templates, newTemplate])
    setIsCreating(false)
    setSelectedTemplateId(newTemplate.id)
    toast.success('Template created successfully')
  }

  const handleUpdate = (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => {
    if (!selectedTemplateId) return
    const updatedTemplates = templates.map(t => 
      t.id === selectedTemplateId 
        ? { ...t, ...data, lastModified: new Date() }
        : t
    )
    setTemplates(updatedTemplates)
    toast.success('Template updated successfully')
  }

  const handleDelete = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id))
    if (selectedTemplateId === id) {
      setSelectedTemplateId(null)
      setIsCreating(false)
    }
    toast.success('Template deleted')
  }

  const handleDuplicate = (template: WorkoutTemplate) => {
    const newTemplate = {
      ...template,
      id: Math.random().toString(36).substr(2, 9),
      name: `${template.name} (Copy)`,
      lastModified: new Date()
    }
    setTemplates([...templates, newTemplate])
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
                onClick={() => { setSelectedTemplateId(null); setIsCreating(true); }}
                variant={isCreating ? "secondary" : "default"}
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
                        "group flex items-center justify-between p-3 rounded-md text-sm transition-colors cursor-pointer border border-transparent",
                        selectedTemplateId === template.id && !isCreating 
                          ? "bg-background border-border shadow-sm" 
                          : "hover:bg-background/50 hover:border-border/50"
                      )}
                      onClick={() => { setIsCreating(false); setSelectedTemplateId(template.id); }}
                    >
                      <div className="flex flex-col gap-1 overflow-hidden">
                        <span className="font-medium truncate">{template.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {template.exercises.length} exercises • {template.lastModified.toLocaleDateString()}
                        </span>
                      </div>
                      
                      {/* Action Buttons (visible on hover or active) */}
                      <div className={cn(
                        "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                        selectedTemplateId === template.id ? "opacity-100" : ""
                      )}>
                        <Button 
                          size="icon" variant="ghost" className="h-7 w-7" 
                          title="Duplicate"
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(template); }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" 
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
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
              // Mode: Create New
              <TemplateEditor 
                key="new" // Forces reset when switching to new
                initialData={null} 
                onSave={handleCreate} 
                onCancel={() => setIsCreating(false)} 
              />
            ) : activeTemplate ? (
              // Mode: Edit Existing
              <TemplateEditor 
                key={activeTemplate.id} // Forces reset when switching templates
                initialData={activeTemplate} 
                onSave={handleUpdate} 
                onCancel={() => setSelectedTemplateId(null)} 
              />
            ) : (
              // Mode: Empty State
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