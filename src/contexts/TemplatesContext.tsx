import { createContext, useContext, useState, ReactNode } from 'react'

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

const INITIAL_TEMPLATES: WorkoutTemplate[] = [
  {
    id: '1',
    name: 'Hypertrophy Phase 1',
    description: 'Focus on volume and controlled eccentrics.',
    lastModified: new Date(),
    exercises: [
      { name: 'Back Squat', sets: 4, reps: 8, showSetsReps: true, targetVelocity: 0.6, showVelocity: true },
      { name: 'RDL', sets: 3, reps: 10, showSetsReps: true, showVelocity: false },
    ],
  },
  {
    id: '2',
    name: 'Power Development',
    description: 'Low volume, high velocity.',
    lastModified: new Date(),
    exercises: [
      { name: 'Power Clean', sets: 5, reps: 3, showSetsReps: true, targetVelocity: 1.3, showVelocity: true },
    ],
  },
]

interface TemplatesContextValue {
  templates: WorkoutTemplate[]
  addTemplate: (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => WorkoutTemplate
  updateTemplate: (id: string, data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => void
  deleteTemplate: (id: string) => void
  duplicateTemplate: (template: WorkoutTemplate) => void
}

const TemplatesContext = createContext<TemplatesContextValue | null>(null)

export const TemplatesProvider = ({ children }: { children: ReactNode }) => {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(INITIAL_TEMPLATES)

  const addTemplate = (data: Omit<WorkoutTemplate, 'id' | 'lastModified'>): WorkoutTemplate => {
    const t: WorkoutTemplate = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      lastModified: new Date(),
    }
    setTemplates(prev => [...prev, t])
    return t
  }

  const updateTemplate = (id: string, data: Omit<WorkoutTemplate, 'id' | 'lastModified'>) => {
    setTemplates(prev =>
      prev.map(t => (t.id === id ? { ...t, ...data, lastModified: new Date() } : t))
    )
  }

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const duplicateTemplate = (template: WorkoutTemplate) => {
    const t: WorkoutTemplate = {
      ...template,
      id: Math.random().toString(36).substr(2, 9),
      name: `${template.name} (Copy)`,
      lastModified: new Date(),
    }
    setTemplates(prev => [...prev, t])
  }

  return (
    <TemplatesContext.Provider value={{ templates, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate }}>
      {children}
    </TemplatesContext.Provider>
  )
}

export const useTemplates = () => {
  const ctx = useContext(TemplatesContext)
  if (!ctx) throw new Error('useTemplates must be used within TemplatesProvider')
  return ctx
}
