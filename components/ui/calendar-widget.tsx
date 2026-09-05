'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarTask {
  id: string
  checkpointTitle?: string
  title?: string
  moduleName?: string
  module?: string
  status: string
  date?: string
  assignedDate?: string
  submissionDate?: string
}

interface CalendarWidgetProps {
  className?: string
}

export function CalendarWidget({ className = '' }: CalendarWidgetProps) {
  const [currentDate] = useState(new Date())
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<number | null>(null)
  const [tasks, setTasks] = useState<CalendarTask[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = currentDate.getDate()
  const isCurrentMonth = currentDate.getMonth() === month && currentDate.getFullYear() === year

  const monthName = viewDate.toLocaleString('en-US', { month: 'short' })
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  useEffect(() => {
    if (selectedDate === null) return

    let cancelled = false
    const fetchTasks = async () => {
      setLoadingTasks(true)
      try {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
        const res = await fetch(`/api/notifications?date=${dateStr}`)
        const data = await res.json()
        if (!cancelled && data.success) {
          const allTasks: CalendarTask[] = [
            ...(data.data.upcoming || []).map((t: CalendarTask) => ({
              id: t.id,
              title: t.checkpointTitle || t.title,
              module: t.moduleName || t.module,
              status: 'upcoming',
              date: t.assignedDate || t.date,
            })),
            ...(data.data.recent || []).map((t: CalendarTask) => ({
              id: t.id,
              title: t.checkpointTitle || t.title,
              module: t.moduleName || t.module,
              status: (t.status || 'pending').toLowerCase(),
              date: t.submissionDate || t.date,
            })),
          ]
          setTasks(allTasks)
        }
      } catch {
        if (!cancelled) setTasks([])
      } finally {
        if (!cancelled) setLoadingTasks(false)
      }
    }
    fetchTasks()
    return () => { cancelled = true }
  }, [selectedDate, year, month])

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
  }

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-1 hover:bg-surface-alt transition" aria-label="Previous month">
          <ChevronLeft className="w-3.5 h-3.5 text-text-secondary" />
        </button>
        <span className="text-xs font-semibold text-text">
          {monthName} {year}
        </span>
        <button onClick={nextMonth} className="p-1 hover:bg-surface-alt transition" aria-label="Next month">
          <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0">
        {dayNames.map((d, i) => (
          <div key={i} className="text-[10px] font-medium text-text-muted text-center py-1">
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />

          const isToday = isCurrentMonth && day === today
          const isSelected = selectedDate === day

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : day)}
              className={`text-center py-1 text-[11px] transition cursor-pointer ${
                isSelected
                  ? 'bg-text text-surface font-bold'
                  : isToday
                    ? 'bg-primary text-surface font-bold'
                    : 'text-text-secondary hover:bg-surface-alt'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Tasks for selected day */}
      {selectedDate !== null && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            {monthName} {selectedDate}
          </p>
          {loadingTasks ? (
            <p className="text-[10px] text-text-muted py-1">Loading...</p>
          ) : tasks.length === 0 ? (
            <p className="text-[10px] text-text-muted py-1">No tasks on this day</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {tasks.map(task => (
                <div key={task.id} className="text-[10px] p-1.5 bg-surface-alt border border-border-light">
                  <p className="text-text truncate font-medium">{task.checkpointTitle || task.title}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-text-muted">{task.moduleName || task.module}</span>
                    <span className={`font-medium ${
                      task.status === 'approved' ? 'text-success' :
                      task.status === 'submitted' ? 'text-primary' :
                      task.status === 'rejected' ? 'text-danger' :
                      'text-text-secondary'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
