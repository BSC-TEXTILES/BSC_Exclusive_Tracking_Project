'use client'

import { useState, useEffect } from 'react'
import {
  User,
  Save,
  Loader2,
  Building2,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface ProfileData {
  id: string
  fullName: string
  email: string
  employeeCode: string
  phone: string | null
  designation: string | null
  specialization: string | null
  bio: string | null
  reportingManager: {
    id: string
    fullName: string
    employeeCode: string
    email: string
  } | null
  departments: Array<{
    id: string
    name: string
    code: string
  }>
  projects: Array<{
    id: string
    name: string
    department: string | null
  }>
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    designation: '',
    specialization: '',
    bio: '',
  })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/supervisor/profile')
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        const result = await res.json()
        if (result.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (result.success) {
          setProfile(result.data.profile)
          setFormData({
            designation: result.data.profile.designation || '',
            specialization: result.data.profile.specialization || '',
            bio: result.data.profile.bio || '',
          })
        }
      } catch {
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/supervisor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const result = await res.json()
      if (result.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
      if (result.success) {
        setSuccess('Profile updated successfully')
        if (result.data.profile) {
          setProfile(prev => prev ? { ...prev, ...result.data.profile } : prev)
        }
      } else {
        setError(result.message || 'Failed to update profile')
      }
    } catch {
      setError('Network error updating profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 bg-background min-h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
        <span className="ml-2 text-sm text-text-muted">Loading profile...</span>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-6 bg-background min-h-full">
        <div className="bg-surface border border-border p-12 text-center">
          <User className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm font-medium text-text">Failed to load profile</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto bg-background">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text flex items-center gap-2">
          <User className="w-5 h-5 text-text-muted" />
          Profile
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          View and manage your supervisor profile.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info Card */}
          <div className="bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text">Personal Information</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-primary-light text-primary border border-primary/20 flex items-center justify-center text-xl font-bold">
                  {profile.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text">{profile.fullName}</h3>
                  <p className="text-sm text-text-muted">{profile.email}</p>
                  <span className="inline-block mt-1 text-[10px] uppercase font-bold tracking-wider bg-primary-light text-primary px-2 py-0.5">
                    SUPERVISOR
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs font-medium text-text-muted">Employee Code</label>
                  <p className="mt-0.5 font-mono text-text">{profile.employeeCode}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Phone</label>
                  <p className="mt-0.5 text-text">{profile.phone || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Profile Form */}
          <div className="bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text">Edit Profile</h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && (
                <div className="bg-surface-alt border border-border-light text-danger text-xs p-2.5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="bg-success/10 border border-success/30 text-success text-xs p-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <div>
                <label htmlFor="designation" className="block text-sm font-medium text-text mb-1">
                  Designation
                </label>
                <input
                  id="designation"
                  type="text"
                  placeholder="e.g. Senior Supervisor"
                  value={formData.designation}
                  onChange={e => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="specialization" className="block text-sm font-medium text-text mb-1">
                  Specialization
                </label>
                <input
                  id="specialization"
                  type="text"
                  placeholder="e.g. Quality Assurance, Compliance"
                  value={formData.specialization}
                  onChange={e => setFormData({ ...formData, specialization: e.target.value })}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-text mb-1">
                  Bio
                </label>
                <textarea
                  id="bio"
                  rows={4}
                  placeholder="Brief description about your role and expertise..."
                  value={formData.bio}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded inline-flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Reporting Manager */}
          <div className="bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text">Reporting Manager</h2>
            </div>
            <div className="p-5">
              {profile.reportingManager ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-surface-alt text-text-muted border border-border flex items-center justify-center text-xs font-bold">
                    {profile.reportingManager.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">{profile.reportingManager.fullName}</p>
                    <p className="text-xs text-text-muted">{profile.reportingManager.employeeCode}</p>
                    <p className="text-xs text-text-muted">{profile.reportingManager.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-text-muted">No reporting manager assigned</p>
              )}
            </div>
          </div>

          {/* Department Assignments */}
          <div className="bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Departments
              </h2>
            </div>
            <div className="divide-y divide-border-light">
              {profile.departments.length === 0 ? (
                <div className="px-5 py-4 text-center text-xs text-text-muted">No departments assigned</div>
              ) : (
                profile.departments.map(dept => (
                  <div key={dept.id} className="px-5 py-3 hover:bg-background transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text">{dept.name}</span>
                      <span className="text-xs text-text-muted font-mono">{dept.code}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Project Assignments */}
          <div className="bg-surface border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-info" />
                Projects
              </h2>
            </div>
            <div className="divide-y divide-border-light">
              {profile.projects.length === 0 ? (
                <div className="px-5 py-4 text-center text-xs text-text-muted">No projects assigned</div>
              ) : (
                profile.projects.map(proj => (
                  <div key={proj.id} className="px-5 py-3 hover:bg-background transition-colors">
                    <span className="text-sm font-medium text-text">{proj.name}</span>
                    {proj.department && (
                      <p className="text-xs text-text-muted mt-0.5">{proj.department}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
