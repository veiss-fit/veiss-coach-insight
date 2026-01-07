import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Plus, Trash2, Save, Dumbbell, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface TemplateBuilderProps {
  open: boolean
  onClose: () => void
  onSave?: (templateData: any) => void // Optional callback for when backend is ready
}

// Reuse the type definition
interface WorkoutExercise {
  name: string
  sets: number
  reps: number
  weight: number
  weightUnit: 'lbs' | 'kg'
  targetVelocityMin: number
  targetVelocityMax: number
}

export const TemplateBuilder = ({ open, onClose, onSave }: TemplateBuilderProps) => {
  const [templateName, setTemplateName] = useState('')
  const [description, setDescription] = useState('')
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [saving, setSaving] = useState(false)

  // Hardcoded library for the "Quick Select" feature
  const exerciseLibrary = [
    'Back Squat', 'Front Squat', 'Romanian Deadlift', 'Bench Press',
    'Overhead Press', 'Power Clean', 'Box Jump', 'Trap Bar Deadlift',
    'Bulgarian Split Squat', 'Pull-ups', 'Barbell Row',
  ]

  const addExercise = () => {
    setExercises([
      ...exercises,
      {
        name: '',
        sets: 3,
        reps: 5,
        weight: 0,
        weightUnit: 'lbs',
        targetVelocityMin: 0,
        targetVelocityMax: 0,
      },
    ])
  }

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index))
  }

  const updateExercise = (index: number, field: keyof WorkoutExercise, value: any) => {
    const updated = [...exercises]
    updated[index] = { ...updated[index], [field]: value }
    setExercises(updated)
  }

    const handleSave = async () => {
        // 1. Basic Check: Template Name is required
        if (!templateName.trim()) {
        toast.error('Please give your template a name')
        return
        }

        // 2. Basic Check: Must have at least one exercise
        if (exercises.length === 0) {
        toast.error('Please add at least one exercise')
        return
        }

        // 3. New Check: Every exercise MUST have a name
        // We find the index of the first exercise that has an empty name
        const incompleteExerciseIndex = exercises.findIndex(ex => !ex.name.trim())

        if (incompleteExerciseIndex !== -1) {
        // Show an error telling the user exactly which exercise is the problem
        toast.error(`Exercise #${incompleteExerciseIndex + 1} is missing a name`)
        return
        }

        setSaving(true)

        // Simulating API call (Replace with actual Supabase insert later)
        setTimeout(() => {
        const templateData = {
            name: templateName,
            description,
            exercises
        }
        
        console.log('Template to save:', templateData)
        
        if (onSave) onSave(templateData)
        
        toast.success(`Template "${templateName}" created!`)
        setSaving(false)
        onClose()
        
        // Reset form
        setTemplateName('')
        setDescription('')
        setExercises([])
        }, 800)
    }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Create Workout Template
          </DialogTitle>
          <DialogDescription>
            Design a reusable workout structure that you can assign to athletes later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Template Details */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="e.g., Phase 1: Hypertrophy A"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief notes about this workout (e.g., Focus on eccentric tempo)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-lg font-semibold">Exercises</Label>
              <Button size="sm" onClick={addExercise} variant="secondary">
                <Plus className="h-4 w-4 mr-1" />
                Add Exercise
              </Button>
            </div>

            {exercises.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground bg-muted/50">
                <Dumbbell className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No exercises added yet.</p>
                <Button variant="link" onClick={addExercise}>Click here to add one</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {exercises.map((exercise, index) => (
                  <Card key={index} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        
                        {/* Hybrid Input/Select Logic */}
                        <div className="flex flex-1 gap-2">
                          <Input
                            value={exercise.name}
                            onChange={(e) => updateExercise(index, 'name', e.target.value)}
                            placeholder="Exercise Name"
                            className="flex-1 font-medium"
                          />
                          <Select onValueChange={(value) => updateExercise(index, 'name', value)}>
                            <SelectTrigger className="w-[40px] px-0 justify-center" title="Pick from library">
                              <Dumbbell className="h-4 w-4 opacity-50" />
                            </SelectTrigger>
                            <SelectContent>
                              {exerciseLibrary.map((ex) => (
                                <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-destructive hover:text-destructive/90"
                          onClick={() => removeExercise(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Sets</Label>
                        <Input 
                            type="number" 
                            // If 0, show empty string so user can type freely
                            value={exercise.sets === 0 ? '' : exercise.sets} 
                            onChange={(e) => updateExercise(index, 'sets', parseInt(e.target.value) || 0)}
                        />
                        </div>
                        <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Reps</Label>
                        <Input 
                            type="number" 
                            value={exercise.reps === 0 ? '' : exercise.reps} 
                            onChange={(e) => updateExercise(index, 'reps', parseInt(e.target.value) || 0)}
                        />
                        </div>
                        <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Weight</Label>
                        <div className="flex gap-1">
                            <Input 
                            type="number" 
                            className="flex-1"
                            // Fix: Show empty string if 0 to prevent "01"
                            value={exercise.weight === 0 ? '' : exercise.weight} 
                            onChange={(e) => updateExercise(index, 'weight', parseInt(e.target.value) || 0)}
                            />
                            <Select 
                            value={exercise.weightUnit} 
                            onValueChange={(v: any) => updateExercise(index, 'weightUnit', v)}
                            >
                            <SelectTrigger className="w-[60px] px-2 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="lbs">lbs</SelectItem>
                                <SelectItem value="kg">kg</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                        </div>
                        <div className="space-y-1 col-span-2">
                        <Label className="text-xs text-muted-foreground">Velocity Target (m/s)</Label>
                        <div className="flex items-center gap-2">
                            <Input 
                            type="number" 
                            step="0.1" 
                            placeholder="Min"
                            // Fix: Show empty string if 0
                            value={exercise.targetVelocityMin === 0 ? '' : exercise.targetVelocityMin} 
                            onChange={(e) => updateExercise(index, 'targetVelocityMin', parseFloat(e.target.value) || 0)}
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input 
                            type="number" 
                            step="0.1" 
                            placeholder="Max"
                            // Fix: Show empty string if 0
                            value={exercise.targetVelocityMax === 0 ? '' : exercise.targetVelocityMax} 
                            onChange={(e) => updateExercise(index, 'targetVelocityMax', parseFloat(e.target.value) || 0)}
                            />
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[140px]">
            {saving ? (
              "Saving..." 
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}