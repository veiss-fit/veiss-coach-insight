import { useState, useEffect } from 'react'
import { format } from 'date-fns'
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronDown, ChevronRight, Plus, Trash2, Send, Dumbbell } from 'lucide-react'
import { toast } from 'sonner'
import { Validators } from '@/lib/validators'
import { useAuth } from '@/contexts/AuthContext'
import { useTemplates } from '@/contexts/TemplatesContext'
import { getAllPlayersWithStats, PlayerWithStats } from '@/services/playersService'
import { sendWorkoutPlan } from '@/services/workoutPlansService'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { supabase } from '@/lib/supabase'

interface WorkoutBuilderProps {
    open: boolean
    onClose: () => void
}

interface WorkoutExercise {
    name: string
    sets: number
    reps: number
    weight: number
    weightUnit: 'lbs' | 'kg'
    targetVelocityMin: number
    targetVelocityMax: number
}

export const WorkoutBuilder = ({ open, onClose }: WorkoutBuilderProps) => {
    const { profile, user } = useAuth()
    const { templates } = useTemplates()

    const [workoutName, setWorkoutName] = useState('')
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
    const [exercises, setExercises] = useState<WorkoutExercise[]>([])
    const [showExerciseEditor, setShowExerciseEditor] = useState(false)
    const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false)
    const [selectedAthletes, setSelectedAthletes] = useState<string[]>([])
    const [scheduledDates, setScheduledDates] = useState<Date[] | undefined>([])
    const [filterGroup, setFilterGroup] = useState('all')
    const [sending, setSending] = useState(false)

    const [athletes, setAthletes] = useState<PlayerWithStats[]>([])
    const [groupsList, setGroupsList] = useState<Array<{ id: string; name: string }>>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) loadData()
    }, [open, profile])

    const loadData = async () => {
        try {
            setLoading(true)
            const { data: coachRow } = await (supabase as any)
                .from('coaches')
                .select('id')
                .eq('user_id', user?.id)
                .single() as { data: { id: string } | null }

            const groupQuery = coachRow?.id
                ? (supabase as any).from('groups').select('id, name').eq('coach_id', coachRow.id).order('name', { ascending: true })
                : supabase.from('groups').select('id, name').order('name', { ascending: true })

            const [players, groupsResult] = await Promise.all([
                user?.id ? getPlayersWithStatsByCoach(user.id) : getAllPlayersWithStats(),
                groupQuery,
            ])
            setAthletes(players)
            setGroupsList(groupsResult.data || [])
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setWorkoutName('')
        setSelectedTemplateIds([])
        setExercises([])
        setShowExerciseEditor(false)
        setSelectedAthletes([])
        setScheduledDates([])
        setFilterGroup('all')
    }

    const toggleTemplate = (templateId: string) => {
        setSelectedTemplateIds(prev =>
            prev.includes(templateId) ? prev.filter(id => id !== templateId) : [...prev, templateId]
        )
    }

    const handleToggleExerciseEditor = () => {
        if (!showExerciseEditor && exercises.length === 0 && selectedTemplateIds.length > 0) {
            const combined: WorkoutExercise[] = selectedTemplateIds.flatMap(id => {
                const template = templates.find(t => t.id === id)
                return (template?.exercises || []).map(ex => ({
                    name: ex.name,
                    sets: ex.sets ?? 3,
                    reps: ex.reps ?? 5,
                    weight: 0,
                    weightUnit: 'lbs' as const,
                    targetVelocityMin: ex.targetVelocity ?? 0,
                    targetVelocityMax: ex.targetVelocity ?? 0,
                }))
            })
            setExercises(combined)
        }
        setShowExerciseEditor(prev => !prev)
    }

    const addExercise = () => {
        setExercises(prev => [...prev, {
            name: '',
            sets: 3,
            reps: 5,
            weight: 0,
            weightUnit: 'lbs',
            targetVelocityMin: 0,
            targetVelocityMax: 0,
        }])
    }

    const removeExercise = (index: number) => {
        setExercises(prev => prev.filter((_, i) => i !== index))
    }

    const updateExercise = (index: number, field: keyof WorkoutExercise, value: any) => {
        setExercises(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], [field]: value }
            return updated
        })
    }

    const filteredAthletes = athletes.filter(athlete => {
        if (filterGroup !== 'all' && athlete.team_id !== filterGroup) return false
        return true
    })

    const handleSendProgramming = async () => {
        const nameError = Validators.workoutName(workoutName)
        if (nameError) { toast.error(nameError); return }

        if (!scheduledDates || scheduledDates.length === 0) {
            toast.error('Please select at least one date'); return
        }

        if (selectedAthletes.length === 0) {
            toast.error('Please select at least one athlete'); return
        }

        if (exercises.length > 0) {
            for (let i = 0; i < exercises.length; i++) {
                const ex = exercises[i]
                const exNameError = Validators.exerciseName(ex.name)
                if (exNameError) { toast.error(`Exercise ${i + 1}: ${exNameError}`); return }
                const setsError = Validators.workoutSets(ex.sets)
                if (setsError) { toast.error(`Exercise ${i + 1}: ${setsError}`); return }
                const repsError = Validators.workoutReps(ex.reps)
                if (repsError) { toast.error(`Exercise ${i + 1}: ${repsError}`); return }
            }
        }

        try {
            setSending(true)
            const planData = {
                workoutName,
                exercises,
                notes: `Assigned by ${profile?.full_name || 'Coach'}`,
            }

            let totalCount = 0
            for (const date of scheduledDates) {
                const result = await sendWorkoutPlan(
                    selectedAthletes,
                    profile?.coach?.id || null,
                    date,
                    planData
                )
                if (result.success) {
                    totalCount += result.count || 0
                } else {
                    toast.error(result.error || `Failed to send for ${format(date, 'MMM d')}`)
                }
            }

            if (totalCount > 0) {
                toast.success(
                    `"${workoutName}" sent across ${scheduledDates.length} date(s) to ${selectedAthletes.length} athlete(s)`
                )
                resetForm()
                onClose()
            }
        } catch (error) {
            console.error('Error sending programming:', error)
            toast.error('An error occurred while sending the programming')
        } finally {
            setSending(false)
        }
    }

    const exerciseLibrary = [
        'Back Squat', 'Front Squat', 'Romanian Deadlift', 'Bench Press',
        'Overhead Press', 'Power Clean', 'Hang Clean', 'Box Jump',
        'Trap Bar Deadlift', 'Bulgarian Split Squat', 'Pull-ups', 'Barbell Row',
    ]

    const selectedTemplateLabels = selectedTemplateIds
        .map(id => templates.find(t => t.id === id)?.name)
        .filter(Boolean) as string[]

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) { resetForm(); onClose() } }}>
            <DialogContent className="max-w-5xl h-[88vh] p-0 flex flex-col overflow-hidden gap-0">
                <LoadingOverlay isLoading={loading} fullScreen message="Loading athletes..." />
                <LoadingOverlay isLoading={sending} fullScreen message="Sending programming..." />

                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-2xl flex items-center gap-2">
                            <Send className="h-6 w-6 text-primary" />
                            Send Programming
                        </DialogTitle>
                        <DialogDescription>
                            Assign programming to athletes across one or more dates
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Two-panel body */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── Left Panel: Program Name + Calendar ── */}
                    <div className="w-72 border-r flex flex-col gap-5 p-5 shrink-0 overflow-y-auto">
                        <div className="space-y-1.5">
                            <Label htmlFor="programName">Program Name *</Label>
                            <Input
                                id="programName"
                                placeholder="e.g., Spring Phase 1"
                                value={workoutName}
                                onChange={e => setWorkoutName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Schedule Dates *</Label>
                            <p className="text-xs text-muted-foreground">Select one or more dates</p>
                            <Calendar
                                mode="multiple"
                                selected={scheduledDates}
                                onSelect={setScheduledDates}
                                disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                className="border rounded-lg w-full p-2"
                                classNames={{ day_today: '' }}
                            />
                            {scheduledDates && scheduledDates.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                    {[...scheduledDates]
                                        .sort((a, b) => a.getTime() - b.getTime())
                                        .map(d => (
                                            <Badge key={d.toISOString()} variant="secondary" className="text-xs">
                                                {format(d, 'MMM d')}
                                            </Badge>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right Panel ── */}
                    <ScrollArea className="flex-1">
                        <div className="p-5 space-y-4">

                            {/* Cohesive box: Templates + Exercise accordion */}
                            <div className="border rounded-lg divide-y overflow-hidden">

                                {/* Template multi-select */}
                                <div className="p-4 space-y-2">
                                    <Label>Load from Templates</Label>
                                    <Popover open={templateDropdownOpen} onOpenChange={setTemplateDropdownOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between font-normal">
                                                <span className={selectedTemplateIds.length === 0 ? 'text-muted-foreground' : ''}>
                                                    {selectedTemplateIds.length === 0
                                                        ? 'Select templates...'
                                                        : `${selectedTemplateIds.length} template${selectedTemplateIds.length !== 1 ? 's' : ''} selected`}
                                                </span>
                                                <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-1.5 w-[--radix-popover-trigger-width]" align="start">
                                            {templates.length === 0 ? (
                                                <p className="text-sm text-muted-foreground px-2 py-3 text-center">
                                                    No templates yet. Create one in Template Manager.
                                                </p>
                                            ) : (
                                                templates.map(template => (
                                                    <label
                                                        key={template.id}
                                                        className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted cursor-pointer"
                                                    >
                                                        <Checkbox
                                                            checked={selectedTemplateIds.includes(template.id)}
                                                            onCheckedChange={() => toggleTemplate(template.id)}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{template.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {template.exercises.length} exercise{template.exercises.length !== 1 ? 's' : ''}
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))
                                            )}
                                        </PopoverContent>
                                    </Popover>
                                    {selectedTemplateLabels.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-0.5">
                                            {selectedTemplateLabels.map(name => (
                                                <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Modify Exercises accordion */}
                                <div>
                                    <button
                                        type="button"
                                        onClick={handleToggleExerciseEditor}
                                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            {showExerciseEditor
                                                ? <ChevronDown className="h-4 w-4" />
                                                : <ChevronRight className="h-4 w-4" />}
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
                                        <div className="px-4 pb-4 space-y-2 border-t pt-3">
                                            {exercises.length === 0 ? (
                                                <div className="text-center py-5 text-muted-foreground">
                                                    <p className="text-sm">No exercises loaded.</p>
                                                    <p className="text-xs mt-0.5">
                                                        Select templates above, or add exercises manually.
                                                    </p>
                                                </div>
                                            ) : (
                                                exercises.map((exercise, index) => (
                                                    <Card key={index}>
                                                        <CardHeader className="pb-2 pt-3">
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    value={exercise.name}
                                                                    onChange={e => updateExercise(index, 'name', e.target.value)}
                                                                    placeholder="Exercise name"
                                                                    className="flex-1 h-8 text-sm"
                                                                />
                                                                <Select onValueChange={value => updateExercise(index, 'name', value)}>
                                                                    <SelectTrigger className="w-10 h-8 px-0 justify-center" title="Pick from library">
                                                                        <Dumbbell className="h-3.5 w-3.5 opacity-50" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {exerciseLibrary.map(ex => (
                                                                            <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <Button
                                                                    size="sm" variant="ghost"
                                                                    className="h-8 w-8 p-0"
                                                                    onClick={() => removeExercise(index)}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="pb-3 pt-0">
                                                            <div className="grid grid-cols-4 gap-2">
                                                                <div>
                                                                    <Label className="text-xs">Sets</Label>
                                                                    <Input
                                                                        type="number" className="h-8 text-sm"
                                                                        value={exercise.sets}
                                                                        onChange={e => updateExercise(index, 'sets', parseInt(e.target.value))}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-xs">Reps</Label>
                                                                    <Input
                                                                        type="number" className="h-8 text-sm"
                                                                        value={exercise.reps}
                                                                        onChange={e => updateExercise(index, 'reps', parseInt(e.target.value))}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-xs">Weight</Label>
                                                                    <Input
                                                                        type="number" className="h-8 text-sm"
                                                                        value={exercise.weight}
                                                                        onChange={e => updateExercise(index, 'weight', parseInt(e.target.value))}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-xs">Unit</Label>
                                                                    <Select
                                                                        value={exercise.weightUnit}
                                                                        onValueChange={(v: 'lbs' | 'kg') => updateExercise(index, 'weightUnit', v)}
                                                                    >
                                                                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="lbs">lbs</SelectItem>
                                                                            <SelectItem value="kg">kg</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))
                                            )}
                                            <Button size="sm" variant="outline" className="w-full" onClick={addExercise}>
                                                <Plus className="h-3.5 w-3.5 mr-1" /> Add Exercise
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Athletes box */}
                            <div className="border rounded-lg divide-y overflow-hidden">
                                {/* Filter Groups header */}
                                <div className="p-4 space-y-2 bg-muted/20">
                                    <Label>Filter Groups</Label>
                                    <Select value={filterGroup} onValueChange={setFilterGroup}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Groups" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Groups</SelectItem>
                                            {groupsList.map(group => (
                                                <SelectItem key={group.id} value={group.id}>
                                                    {group.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm" variant="outline" className="flex-1"
                                            onClick={() => setSelectedAthletes(filteredAthletes.map(a => a.id))}
                                        >
                                            Select All ({filteredAthletes.length})
                                        </Button>
                                        <Button
                                            size="sm" variant="outline" className="flex-1"
                                            onClick={() => setSelectedAthletes([])}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>

                                {/* Athlete list */}
                                <div className="max-h-60 overflow-y-auto">
                                    {loading ? (
                                        <p className="text-center text-sm text-muted-foreground py-8">Loading athletes...</p>
                                    ) : filteredAthletes.length === 0 ? (
                                        <p className="text-center text-sm text-muted-foreground py-8">No athletes found</p>
                                    ) : (
                                        <div className="p-2 space-y-0.5">
                                            {filteredAthletes.map(athlete => (
                                                <label
                                                    key={athlete.id}
                                                    className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted cursor-pointer"
                                                >
                                                    <Checkbox
                                                        checked={selectedAthletes.includes(athlete.id)}
                                                        onCheckedChange={() =>
                                                            setSelectedAthletes(prev =>
                                                                prev.includes(athlete.id)
                                                                    ? prev.filter(id => id !== athlete.id)
                                                                    : [...prev, athlete.id]
                                                            )
                                                        }
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium">{athlete.name}</p>
                                                        {athlete.group && (
                                                            <p className="text-xs text-muted-foreground">{athlete.group}</p>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {selectedAthletes.length > 0 && (
                                    <div className="px-4 py-2 bg-muted/20 text-xs text-muted-foreground">
                                        {selectedAthletes.length} athlete{selectedAthletes.length !== 1 ? 's' : ''} selected
                                    </div>
                                )}
                            </div>

                        </div>
                    </ScrollArea>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t flex justify-end gap-2 shrink-0 bg-background">
                    <Button variant="outline" onClick={() => { resetForm(); onClose() }} disabled={sending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSendProgramming}
                        className="bg-primary text-navy-dark hover:bg-primary/90"
                        disabled={sending}
                    >
                        <Send className="h-4 w-4 mr-2" />
                        {sending ? 'Sending...' : 'Send Programming'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
