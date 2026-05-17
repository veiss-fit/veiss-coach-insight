import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface WorkoutExercise {
  name: string
  sets?: number
  reps?: number
  targetVelocity?: number
  showSetsReps: boolean
  showVelocity: boolean
}

export interface WorkoutTemplate {
  id: string
  name: string
  description: string
  exercises: WorkoutExercise[]
  lastModified: Date
}

interface TemplatesContextValue {
  templates: WorkoutTemplate[]
  loading: boolean
  addTemplate: (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => Promise<WorkoutTemplate | null>
  updateTemplate: (id: string, data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  duplicateTemplate: (template: WorkoutTemplate) => Promise<void>
}

const TemplatesContext = createContext<TemplatesContextValue | null>(null)

const rowToTemplate = (row: any): WorkoutTemplate => ({
  id: row.id,
  name: row.title,
  description: row.description ?? '',
  exercises: (row.exercises as WorkoutExercise[]) ?? [],
  lastModified: new Date(row.updated_at),
})

export const TemplatesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setTemplates([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        // Step 1: resolve coaches.id from auth user id
        const { data: coach, error: coachErr } = await supabase
          .from('coaches')
          .select('id')
          .eq('user_id', user.id as any)
          .single()

        if (coachErr || !coach) {
          setTemplates([])
          return
        }

        // Step 2: fetch this coach's templates only
        const { data, error } = await supabase
          .from('workout_plans')
          .select('*')
          .eq('coach_id', coach.id as any)
          .eq('is_template', true as any)
          .order('created_at', { ascending: false })

        if (!error) {
          setTemplates((data ?? []).map(rowToTemplate))
        } else {
          console.error('Error fetching templates:', error)
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id])

  const addTemplate = async (
    data: Omit<WorkoutTemplate, 'id' | 'lastModified'>
  ): Promise<WorkoutTemplate | null> => {
    if (!user?.id) return null

    const { data: coach } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', user.id as any)
      .single()

    if (!coach) return null

    const { data: row, error } = await supabase
      .from('workout_plans')
      .insert({
        title: data.name,
        description: data.description || null,
        exercises: data.exercises,
        coach_id: coach.id,
        player_id: null as any,
        is_template: true as any,
        is_completed: false,
        date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return null
    }

    const template = rowToTemplate(row)
    setTemplates(prev => [template, ...prev])
    return template
  }

  const updateTemplate = async (
    id: string,
    data: Omit<WorkoutTemplate, 'id' | 'lastModified'>
  ): Promise<void> => {
    const { error } = await supabase
      .from('workout_plans')
      .update({
        title: data.name,
        description: data.description || null,
        exercises: data.exercises,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('is_template', true as any)

    if (error) {
      console.error('Error updating template:', error)
      return
    }

    setTemplates(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, name: data.name, description: data.description, exercises: data.exercises, lastModified: new Date() }
          : t
      )
    )
  }

  const deleteTemplate = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('workout_plans')
      .delete()
      .eq('id', id)
      .eq('is_template', true as any)

    if (error) {
      console.error('Error deleting template:', error)
      return
    }

    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const duplicateTemplate = async (template: WorkoutTemplate): Promise<void> => {
    if (!user?.id) return

    const { data: coach } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', user.id as any)
      .single()

    if (!coach) return

    const { data: row, error } = await supabase
      .from('workout_plans')
      .insert({
        title: `${template.name} (Copy)`,
        description: template.description || null,
        exercises: template.exercises,
        coach_id: coach.id,
        player_id: null as any,
        is_template: true as any,
        is_completed: false,
        date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (error) {
      console.error('Error duplicating template:', error)
      return
    }

    setTemplates(prev => [rowToTemplate(row), ...prev])
  }

  return (
    <TemplatesContext.Provider
      value={{ templates, loading, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate }}
    >
      {children}
    </TemplatesContext.Provider>
  )
}

export const useTemplates = () => {
  const ctx = useContext(TemplatesContext)
  if (!ctx) throw new Error('useTemplates must be used within TemplatesProvider')
  return ctx
}
