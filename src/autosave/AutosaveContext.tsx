import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateFloor, updateInstance, updateProject } from '../api/projectsApi'
import type { Floor, Project } from '../types/api'

export type AutosaveStatus = 'idle' | 'saving' | 'saved'

type InstanceTask = {
  kind: 'instance'
  projectId: string
  instanceId: string
  patch: Record<string, unknown>
}

type ProjectTask = {
  kind: 'project'
  projectId: string
  patch: Partial<Project>
}

type FloorTask = {
  kind: 'floor'
  projectId: string
  floorDocId: string
  patch: Partial<Floor>
}

type AutosaveTask = InstanceTask | ProjectTask | FloorTask

type AutosaveContextValue = {
  status: AutosaveStatus
  /** Queue a PATCH; shows "saving…" immediately, flushes after ~700ms. */
  schedule: (task: AutosaveTask) => void
  /** Flush pending PATCHes now (manual Save). */
  flush: () => Promise<void>
  /** Run an immediate write (create/delete) with the same status indicator. */
  runImmediate: <T>(fn: () => Promise<T>) => Promise<T>
}

const AutosaveContext = createContext<AutosaveContextValue | null>(null)

const DEBOUNCE_MS = 700
const SAVED_FLASH_MS = 2200

function taskKey(task: AutosaveTask): string {
  if (task.kind === 'instance') return `instance:${task.instanceId}`
  if (task.kind === 'floor') return `floor:${task.floorDocId}`
  return `project:${task.projectId}`
}

function deepMergePatch(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k]
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      prev &&
      typeof prev === 'object' &&
      !Array.isArray(prev)
    ) {
      out[k] = deepMergePatch(prev as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

function mergeTasks(prev: AutosaveTask | undefined, next: AutosaveTask): AutosaveTask {
  if (!prev || prev.kind !== next.kind) return next
  if (prev.kind === 'instance' && next.kind === 'instance') {
    return {
      ...next,
      patch: deepMergePatch(prev.patch, next.patch),
    }
  }
  if (prev.kind === 'project' && next.kind === 'project') {
    return {
      ...next,
      patch: deepMergePatch(
        prev.patch as Record<string, unknown>,
        next.patch as Record<string, unknown>,
      ) as Partial<Project>,
    }
  }
  if (prev.kind === 'floor' && next.kind === 'floor') {
    return {
      ...next,
      patch: { ...prev.patch, ...next.patch },
    }
  }
  return next
}

async function executeTask(task: AutosaveTask): Promise<void> {
  if (task.kind === 'instance') {
    await updateInstance(task.projectId, task.instanceId, task.patch)
    return
  }
  if (task.kind === 'floor') {
    await updateFloor(task.projectId, task.floorDocId, task.patch)
    return
  }
  await updateProject(task.projectId, task.patch)
}

export function AutosaveProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const pending = useRef<Map<string, AutosaveTask>>(new Map())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushing = useRef(false)

  const flashSaved = useCallback(() => {
    setStatus('saved')
    if (clearSavedTimer.current) clearTimeout(clearSavedTimer.current)
    clearSavedTimer.current = setTimeout(() => {
      setStatus((s) => (s === 'saved' ? 'idle' : s))
    }, SAVED_FLASH_MS)
  }, [])

  const invalidateForTasks = useCallback(
    (tasks: AutosaveTask[]) => {
      const projectIds = new Set<string>()
      let touchedInstances = false
      let touchedFloors = false
      tasks.forEach((t) => {
        projectIds.add(t.projectId)
        if (t.kind === 'instance') touchedInstances = true
        if (t.kind === 'floor') touchedFloors = true
      })
      projectIds.forEach((id) => {
        void qc.invalidateQueries({ queryKey: ['project', id] })
        void qc.invalidateQueries({ queryKey: ['reports', id] })
        if (touchedInstances) {
          void qc.invalidateQueries({ queryKey: ['instances', id] })
          void qc.invalidateQueries({ queryKey: ['calculate', id] })
          void qc.invalidateQueries({ queryKey: ['instance-counts', id] })
        }
        if (touchedFloors) {
          void qc.invalidateQueries({ queryKey: ['instance-counts', id] })
        }
      })
    },
    [qc],
  )

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (flushing.current) return
    const tasks = Array.from(pending.current.values())
    if (tasks.length === 0) return
    flushing.current = true
    pending.current.clear()
    setStatus('saving')
    try {
      await Promise.all(tasks.map(executeTask))
      invalidateForTasks(tasks)
      flashSaved()
    } catch {
      setStatus('idle')
      tasks.forEach((t) => pending.current.set(taskKey(t), t))
    } finally {
      flushing.current = false
    }
  }, [flashSaved, invalidateForTasks])

  const schedule = useCallback(
    (task: AutosaveTask) => {
      const key = taskKey(task)
      const prev = pending.current.get(key)
      pending.current.set(key, mergeTasks(prev, task))
      setStatus('saving')
      if (clearSavedTimer.current) clearTimeout(clearSavedTimer.current)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void flush()
      }, DEBOUNCE_MS)
    },
    [flush],
  )

  const runImmediate = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
      await flush()
      setStatus('saving')
      try {
        const result = await fn()
        flashSaved()
        return result
      } catch (err) {
        setStatus('idle')
        throw err
      }
    },
    [flashSaved, flush],
  )

  // Flush on tab close / refresh
  useEffect(() => {
    const onUnload = () => {
      if (pending.current.size === 0) return
      // Best-effort: kick flush (may not complete in unload)
      void flush()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      if (timer.current) clearTimeout(timer.current)
      if (clearSavedTimer.current) clearTimeout(clearSavedTimer.current)
    }
  }, [flush])

  const value = useMemo(
    () => ({ status, schedule, flush, runImmediate }),
    [status, schedule, flush, runImmediate],
  )

  return <AutosaveContext.Provider value={value}>{children}</AutosaveContext.Provider>
}

export function useAutosave(): AutosaveContextValue {
  const ctx = useContext(AutosaveContext)
  if (!ctx) throw new Error('useAutosave must be used within AutosaveProvider')
  return ctx
}

/** Status label matching AgileQS-Takeoff.html #saveStatus */
export function AutosaveStatusLabel({ status }: { status: AutosaveStatus }) {
  if (status === 'idle') {
    return <span className="text-[11px] text-steel/60 min-w-[54px] inline-block" />
  }
  if (status === 'saving') {
    return (
      <span className="text-[11px] text-steel/70 min-w-[54px] inline-block">saving…</span>
    )
  }
  return (
    <span className="text-[11px] text-verified min-w-[54px] inline-block">saved ✓</span>
  )
}
