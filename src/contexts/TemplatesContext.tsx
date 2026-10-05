import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface WorkoutSetSpec {
  reps?: number
  targetVelocity?: number
}

export interface WorkoutExercise {
  name: string
  /** Legacy flat fields — kept so templates saved before per-set support still load. */
  sets?: number
  reps?: number
  targetVelocity?: number
  /** One entry per set. Present on templates saved after per-set support shipped. */
  perSet?: WorkoutSetSpec[]
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
  /** Resolves false when the write failed, so callers never report a false success. */
  updateTemplate: (id: string, data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => Promise<boolean>
  deleteTemplate: (id: string) => Promise<boolean>
  duplicateTemplate: (template: WorkoutTemplate) => Promise<boolean>
}

const TemplatesContext = createContext<TemplatesContextValue | null>(null)

const rowToTemplate = (row: any): WorkoutTemplate => ({
  id: row.id,
  name: row.title,
  description: row.description ?? '',
  exercises: (row.exercises as WorkoutExercise[]) ?? [],
  lastModified: new Date(row.updated_at),
})

const db = supabase as any

export const TemplatesProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile } = useAuth()
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!user?.id || !profile?.coach_id) {
        setTemplates([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const { data, error } = await db
          .from('workout_plans')
          .select('*')
          .eq('coach_id', profile.coach_id)
          .eq('is_template', true)
          .order('created_at', { ascending: false }) as { data: any[] | null; error: any }

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
  }, [user?.id, profile?.coach_id])

  const addTemplate = useCallback(async (
    data: Omit<WorkoutTemplate, 'id' | 'lastModified'>
  ): Promise<WorkoutTemplate | null> => {
    if (!profile?.coach_id) return null

    const { data: row, error } = await db
      .from('workout_plans')
      .insert({
        title: data.name,
        description: data.description || null,
        exercises: data.exercises,
        coach_id: profile.coach_id,
        player_id: null,
        is_template: true,
        is_completed: false,
        date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single() as { data: any; error: any }

    if (error) {
      console.error('Error creating template:', error)
      return null
    }

    const template = rowToTemplate(row)
    setTemplates(prev => [template, ...prev])
    return template
  }, [profile?.coach_id])

  const updateTemplate = useCallback(async (
    id: string,
    data: Omit<WorkoutTemplate, 'id' | 'lastModified'>
  ): Promise<boolean> => {
    const { error } = await db
      .from('workout_plans')
      .update({
        title: data.name,
        description: data.description || null,
        exercises: data.exercises,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('is_template', true) as { error: any }

    if (error) {
      console.error('Error updating template:', error)
      return false
    }

    setTemplates(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, name: data.name, description: data.description, exercises: data.exercises, lastModified: new Date() }
          : t
      )
    )
    return true
  }, [])

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await db
      .from('workout_plans')
      .delete()
      .eq('id', id)
      .eq('is_template', true) as { error: any }

    if (error) {
      console.error('Error deleting template:', error)
      return false
    }

    setTemplates(prev => prev.filter(t => t.id !== id))
    return true
  }, [])

  const duplicateTemplate = useCallback(async (template: WorkoutTemplate): Promise<boolean> => {
    if (!profile?.coach_id) return false

    const { data: row, error } = await db
      .from('workout_plans')
      .insert({
        title: `${template.name} (Copy)`,
        description: template.description || null,
        exercises: template.exercises,
        coach_id: profile.coach_id,
        player_id: null,
        is_template: true,
        is_completed: false,
        date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single() as { data: any; error: any }

    if (error) {
      console.error('Error duplicating template:', error)
      return false
    }

    setTemplates(prev => [rowToTemplate(row), ...prev])
    return true
  }, [profile?.coach_id])

  const value = useMemo(
    () => ({ templates, loading, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate }),
    [templates, loading, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate]
  )

  return (
    <TemplatesContext.Provider value={value}>
      {children}
    </TemplatesContext.Provider>
  )
}

export const useTemplates = () => {
  const ctx = useContext(TemplatesContext)
  if (!ctx) throw new Error('useTemplates must be used within TemplatesProvider')
  return ctx
}
