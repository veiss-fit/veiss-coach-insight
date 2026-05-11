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
import { workoutTemplates } from '@/data/mockData'
import { Plus, Trash2, Send, Dumbbell, CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Validators } from '@/lib/validators'
import { useAuth } from '@/contexts/AuthContext'
import { getPlayersByTeamIds, PlayerWithStats, getSportsList } from '@/services/playersService'
import { sendWorkoutPlan } from '@/services/workoutPlansService'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

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
    const { profile } = useAuth()
    const [workoutName, setWorkoutName] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState<string>('')
    const [exercises, setExercises] = useState<WorkoutExercise[]>([])
    const [selectedAthletes, setSelectedAthletes] = useState<string[]>([])
    const [scheduledDate, setScheduledDate] = useState<Date>()
    const [filterSport, setFilterSport] = useState('all')
    const [filterLevel, setFilterLevel] = useState('all')
    // Removed filterGroup state
    const [sending, setSending] = useState(false)

    // Real data
    const [athletes, setAthletes] = useState<PlayerWithStats[]>([])
    const [sportsList, setSportsList] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    // Load athletes and sports when modal opens
    useEffect(() => {
        if (open) {
            loadData()
        }
    }, [open, profile])

    const loadData = async () => {
        try {
            setLoading(true)

            // Load athletes based on coach's team
            let players: PlayerWithStats[] = []
            if (profile?.coach?.team_id) {
                players = await getPlayersByTeamIds([profile.coach.team_id])
                console.log(`Loaded ${players.length} players for team ${profile.coach.team_id}`)
            } else {
                console.warn('Coach has no team_id assigned - no players will be loaded')
            }
            setAthletes(players)

            // Load sports list
            const sports = await getSportsList()
            setSportsList(sports)
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const exerciseLibrary = [
        'Back Squat',
        'Front Squat',
        'Romanian Deadlift',
        'Bench Press',
        'Overhead Press',
        'Power Clean',
        'Hang Clean',
        'Box Jump',
        'Trap Bar Deadlift',
        'Bulgarian Split Squat',
        'Single Leg RDL',
        'Incline Bench Press',
        'Push Press',
        'Pull-ups',
        'Barbell Row',
    ]

    const handleTemplateSelect = (templateId: string) => {
        const template = workoutTemplates.find((t) => t.id === templateId)
        if (template) {
            setWorkoutName(template.name)
            setExercises(
                template.exercises.map((ex) => ({
                    ...ex,
                    targetVelocityMin: ex.targetVelocityMin,
                    targetVelocityMax: ex.targetVelocityMax,
                }))
            )
            setSelectedTemplate(templateId)
        }
    }

    const addExercise = () => {
        setExercises([
            ...exercises,
            {
                name: 'Back Squat',
                sets: 3,
                reps: 5,
                weight: 135,
                weightUnit: 'lbs',
                targetVelocityMin: 1.0,
                targetVelocityMax: 1.5,
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

    const toggleAthlete = (athleteId: string) => {
        setSelectedAthletes((prev) => {
            const isSelected = prev.includes(athleteId)
            const newSelection = isSelected
                ? prev.filter((id) => id !== athleteId)
                : [...prev, athleteId]
            console.log('Athlete selection changed:', {
                athleteId,
                isSelected,
                newCount: newSelection.length,
            })
            return newSelection
        })
    }

    const selectAllFiltered = () => {
        const filtered = filteredAthletes.map((a) => a.id)
        setSelectedAthletes(filtered)
    }

    const filteredAthletes = athletes.filter((athlete) => {
        if (filterSport !== 'all' && athlete.sport !== filterSport) return false
        if (filterLevel !== 'all' && athlete.level !== filterLevel) return false
        // Removed group filter check
        return true
    })

    const handleSendWorkout = async () => {
        // Validation
        const nameError = Validators.workoutName(workoutName);
        if (nameError) {
            toast.error(nameError);
            return;
        }

        if (exercises.length === 0) {
            toast.error("Please add at least one exercise");
            return;
        }

        if (selectedAthletes.length === 0) {
            toast.error("Please select at least one athlete");
            return;
        }

        if (!scheduledDate) {
            toast.error("Please select a scheduled date");
            return;
        }

        // Validate all exercises
        for (let i = 0; i < exercises.length; i++) {
            const ex = exercises[i];
            
            const exNameError = Validators.exerciseName(ex.name);
            if (exNameError) {
                toast.error(`Exercise ${i + 1}: ${exNameError}`);
                return;
            }

            const setsError = Validators.workoutSets(ex.sets);
            if (setsError) {
                toast.error(`Exercise ${i + 1}: ${setsError}`);
                return;
            }

            const repsError = Validators.workoutReps(ex.reps);
            if (repsError) {
                toast.error(`Exercise ${i + 1}: ${repsError}`);
                return;
            }

            const weightError = Validators.workoutWeight(ex.weight);
            if (weightError) {
                toast.error(`Exercise ${i + 1}: ${weightError}`);
                return;
            }
        }

        try {
            setSending(true)

            // Prepare workout plan data
            const planData = {
                workoutName,
                exercises,
                notes: `Assigned by ${profile?.full_name || 'Coach'}`,
            }

            // Send to Supabase
            const result = await sendWorkoutPlan(
                selectedAthletes,
                profile?.coach?.id || null,
                scheduledDate,
                planData
            )

            if (result.success) {
                const dateInfo = format(scheduledDate, 'PPP')
                toast.success(
                    `Workout "${workoutName}" sent to ${result.count} athlete(s) for ${dateInfo}`
                )
                onClose()

                // Reset form
                setWorkoutName('')
                setExercises([])
                setSelectedAthletes([])
                setSelectedTemplate('')
                setScheduledDate(undefined)
            } else {
                toast.error(result.error || 'Failed to send workout plan')
            }
        } catch (error) {
            console.error('Error sending workout:', error)
            toast.error('An error occurred while sending the workout')
        } finally {
            setSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className='max-w-6xl max-h-[90vh] overflow-y-auto'>
                <LoadingOverlay isLoading={loading} fullScreen message="Loading athletes..." />
                <LoadingOverlay isLoading={sending} fullScreen message="Sending workout..." />
                <DialogHeader>
                    <DialogTitle className='text-2xl flex items-center gap-2'>
                        <Dumbbell className='h-6 w-6 text-primary' />
                        Send Workout
                    </DialogTitle>
                    <DialogDescription>
                        Create a workout and assign it to athletes
                    </DialogDescription>
                </DialogHeader>

                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4'>
                    {/* Left Column - Workout Builder */}
                    <div className='space-y-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='workoutName'>Workout Name</Label>
                            <Input
                                id='workoutName'
                                placeholder='e.g., Lower Body Power'
                                value={workoutName}
                                onChange={(e) => setWorkoutName(e.target.value)}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label>Scheduled Date *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant='outline'
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !scheduledDate && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className='mr-2 h-4 w-4' />
                                        {scheduledDate ? (
                                            format(scheduledDate, 'PPP')
                                        ) : (
                                            <span>Pick a date (required)</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className='w-auto p-0' align='start'>
                                    <Calendar
                                        mode='single'
                                        selected={scheduledDate}
                                        onSelect={setScheduledDate}
                                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                        initialFocus
                                        className='p-3 pointer-events-auto'
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className='space-y-2'>
                            <Label>Load from Template</Label>
                            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder='Select a template...' />
                                </SelectTrigger>
                                <SelectContent>
                                    {workoutTemplates.map((template) => (
                                        <SelectItem key={template.id} value={template.id}>
                                            {template.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className='space-y-3'>
                            <div className='flex items-center justify-between'>
                                <Label>Exercises</Label>
                                <Button size='sm' onClick={addExercise}>
                                    <Plus className='h-4 w-4 mr-1' />
                                    Add Exercise
                                </Button>
                            </div>

                            {exercises.map((exercise, index) => (
                                <Card key={index}>
                                    <CardHeader className='pb-3'>
                                        <div className='flex items-center justify-between gap-4'>
                                            <div className="flex flex-1 gap-2">
                                                <Input
                                                    value={exercise.name}
                                                    onChange={(e) => updateExercise(index, 'name', e.target.value)}
                                                    placeholder="Exercise Name (e.g. Sled Push)"
                                                    className="flex-1"
                                                />
                                                <Select onValueChange={(value) => updateExercise(index, 'name', value)}>
                                                    <SelectTrigger className="w-[50px] px-0 justify-center" title="Pick from library">
                                                        <Dumbbell className="h-4 w-4 opacity-50" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {exerciseLibrary.map((ex) => (
                                                            <SelectItem key={ex} value={ex}>
                                                                {ex}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button size='sm' variant='ghost' onClick={() => removeExercise(index)}>
                                                <Trash2 className='h-4 w-4 text-destructive' />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className='space-y-3'>
                                        <div className='grid grid-cols-4 gap-2'>
                                            <div>
                                                <Label className='text-xs'>Sets</Label>
                                                <Input
                                                    type='number'
                                                    value={exercise.sets}
                                                    onChange={(e) =>
                                                        updateExercise(index, 'sets', parseInt(e.target.value))
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <Label className='text-xs'>Reps</Label>
                                                <Input
                                                    type='number'
                                                    value={exercise.reps}
                                                    onChange={(e) =>
                                                        updateExercise(index, 'reps', parseInt(e.target.value))
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <Label className='text-xs'>Weight</Label>
                                                <Input
                                                    type='number'
                                                    value={exercise.weight}
                                                    onChange={(e) =>
                                                        updateExercise(index, 'weight', parseInt(e.target.value))
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <Label className='text-xs'>Unit</Label>
                                                <Select
                                                    value={exercise.weightUnit}
                                                    onValueChange={(value: 'lbs' | 'kg') =>
                                                        updateExercise(index, 'weightUnit', value)
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value='lbs'>lbs</SelectItem>
                                                        <SelectItem value='kg'>kg</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className='space-y-2'>
                                            <Label className='text-xs'>Target Velocity Range (m/s)</Label>
                                            <div className='flex gap-2'>
                                                <Input
                                                    type='number'
                                                    step='0.1'
                                                    placeholder='Min'
                                                    value={exercise.targetVelocityMin}
                                                    onChange={(e) =>
                                                        updateExercise(
                                                            index,
                                                            'targetVelocityMin',
                                                            parseFloat(e.target.value)
                                                        )
                                                    }
                                                />
                                                <Input
                                                    type='number'
                                                    step='0.1'
                                                    placeholder='Max'
                                                    value={exercise.targetVelocityMax}
                                                    onChange={(e) =>
                                                        updateExercise(
                                                            index,
                                                            'targetVelocityMax',
                                                            parseFloat(e.target.value)
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Right Column - Athlete Selection */}
                    <div className='space-y-4'>
                        <div>
                            <Label className='mb-2 block'>Filter Athletes</Label>
                            {/* Changed to grid-cols-2 since Group is removed */}
                            <div className='grid grid-cols-2 gap-2'>
                                <Select value={filterSport} onValueChange={setFilterSport}>
                                    <SelectTrigger>
                                        <SelectValue placeholder='Sport' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='all'>All Sports</SelectItem>
                                        {sportsList.map((sport) => (
                                            <SelectItem key={sport} value={sport}>
                                                {sport}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={filterLevel} onValueChange={setFilterLevel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder='Level' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='all'>All Levels</SelectItem>
                                        <SelectItem value='Varsity'>Varsity</SelectItem>
                                        <SelectItem value='JV'>JV</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className='flex gap-2 mt-2'>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    className='flex-1'
                                    onClick={selectAllFiltered}
                                >
                                    Select All ({filteredAthletes.length})
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    className='flex-1'
                                    onClick={() => setSelectedAthletes([])}
                                >
                                    Clear Selection
                                </Button>
                            </div>
                        </div>

                        <div>
                            <Label className='mb-2 block'>
                                Selected Athletes ({selectedAthletes.length})
                            </Label>
                            <Card className='max-h-[500px] overflow-y-auto'>
                                <CardContent className='p-3 space-y-2'>
                                    {loading ? (
                                        <div className='text-center py-8 text-muted-foreground'>
                                            <p>Loading athletes...</p>
                                        </div>
                                    ) : filteredAthletes.length === 0 ? (
                                        <div className='text-center py-8 text-muted-foreground'>
                                            <p>No athletes found</p>
                                        </div>
                                    ) : (
                                        filteredAthletes.map((athlete) => {
                                            const isSelected = selectedAthletes.includes(athlete.id)
                                            return (
                                                <label
                                                    key={athlete.id}
                                                    className='flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer'
                                                    htmlFor={`athlete-${athlete.id}`}
                                                >
                                                    <Checkbox
                                                        id={`athlete-${athlete.id}`}
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleAthlete(athlete.id)}
                                                    />
                                                    <div className='flex-1'>
                                                        <p className='text-sm font-medium'>{athlete.name}</p>
                                                        <div className='flex gap-1 mt-1'>
                                                            <Badge variant='outline' className='text-xs'>
                                                                {athlete.group || 'No Group'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </label>
                                            )
                                        })
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>

                <div className='flex justify-end gap-2 mt-4'>
                    <Button variant='outline' onClick={onClose} disabled={sending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSendWorkout}
                        className='bg-primary text-navy-dark hover:bg-primary/90'
                        disabled={sending}
                    >
                        <Send className='h-4 w-4 mr-2' />
                        {sending ? 'Sending...' : 'Send Workout'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}