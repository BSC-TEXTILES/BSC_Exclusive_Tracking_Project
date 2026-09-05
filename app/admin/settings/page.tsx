'use client'

import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  Pencil,
} from 'lucide-react'

interface Setting {
  id: string
  key: string
  value: string
  type: string
  category: string
}

const settingLabels: Record<string, { label: string; description: string; type: string }> = {
  app_name: { label: 'App Name', description: 'Display name of the application', type: 'text' },
  timezone: { label: 'Timezone', description: 'Default timezone for date/time display', type: 'select' },
  max_file_size: { label: 'Max File Size (MB)', description: 'Maximum file upload size in megabytes', type: 'number' },
  allowed_file_types: { label: 'Allowed File Types', description: 'Comma-separated list of allowed MIME types', type: 'text' },
  autosave_interval: { label: 'Autosave Interval (seconds)', description: 'How often to autosave draft submissions', type: 'number' },
}

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings')
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        const data = await res.json()
        if (data.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (data.success) {
          const flat: Setting[] = []
          const grouped = data.data.settings as Record<string, Array<{ id: string; key: string; value: string; type: string }>>
          for (const items of Object.values(grouped)) {
            for (const s of items) {
              flat.push(s as Setting)
            }
          }
          setSettings(flat)
          const editMap: Record<string, string> = {}
          flat.forEach((s: Setting) => { editMap[s.key] = s.value })
          setEditing(editMap)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage('')
    try {
      const updates = settings.map(s => ({
        key: s.key,
        value: editing[s.key] ?? s.value,
      }))
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updates }),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const data = await res.json().catch(() => null)
      if (data?.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
      if (res.ok) {
        setSaveMessage('Settings saved successfully')
        setIsEditing(false)
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveMessage('Failed to save settings')
      }
    } catch {
      setSaveMessage('An error occurred')
    }
    setSaving(false)
  }

  const generalSettings = settings.filter(s => s.category === 'general' || settingLabels[s.key])

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text">Settings</h1>
            <p className="text-sm text-text-secondary mt-1">Configure application settings</p>
          </div>
          <div className="flex items-center gap-3">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium bg-primary-hover transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); window.location.reload() }}
                  className="px-4 py-2 text-sm font-medium text-text bg-surface border border-border rounded-md hover:bg-surface-alt transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium bg-primary-hover disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>

        {saveMessage && (
          <div className={`mb-6 px-4 py-3 rounded-md text-sm font-medium border ${saveMessage.includes('success') ? 'bg-primary-light text-success border-success/20' : 'bg-surface-alt text-danger border-danger/20'}`}>
            {saveMessage}
          </div>
        )}

        {loading ? (
          <div className="bg-surface border border-border rounded-md p-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-text-muted" />
            <span className="ml-2 text-sm text-text-muted">Loading settings...</span>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-md">
            <div className="px-6 py-4 border-b border-border bg-header-bg rounded-t-md">
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-text-muted" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wide">General</h2>
              </div>
            </div>

            {generalSettings.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-text-muted">
                No settings configured yet.
              </div>
            ) : (
              <div className="divide-y divide-border-light">
                {generalSettings.map(setting => {
                  const meta = settingLabels[setting.key] || { label: setting.key, description: '', type: setting.type }
                  const inputId = `setting-${setting.key}`
                  return (
                    <div key={setting.id} className="px-6 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="sm:w-1/2">
                          <label htmlFor={inputId} className="block text-sm font-medium text-text">
                            {meta.label}
                          </label>
                          {meta.description && (
                            <p className="mt-0.5 text-xs text-text-muted">{meta.description}</p>
                          )}
                        </div>
                        <div className="sm:w-1/2">
                          {isEditing ? (
                            meta.type === 'select' && setting.key === 'timezone' ? (
                              <select
                                id={inputId}
                                value={editing[setting.key] || ''}
                                onChange={e => setEditing(prev => ({ ...prev, [setting.key]: e.target.value }))}
                                className="w-full px-3 py-1.5 border border-border rounded-md text-sm bg-surface text-text focus:outline-none focus:border-primary transition-colors"
                              >
                                {timezones.map(tz => (
                                  <option key={tz} value={tz}>{tz}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                id={inputId}
                                type={meta.type === 'number' ? 'number' : 'text'}
                                value={editing[setting.key] || ''}
                                onChange={e => setEditing(prev => ({ ...prev, [setting.key]: e.target.value }))}
                                className="w-full px-3 py-1.5 border border-border rounded-md text-sm bg-surface text-text focus:outline-none focus:border-primary transition-colors"
                              />
                            )
                          ) : (
                            <div className="px-3 py-1.5 bg-surface-alt border border-border-light rounded-md text-sm text-text font-mono">
                              {setting.value || '(not set)'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
