'use client'

import { useState, useEffect } from 'react'
import { Shield, Loader2 } from 'lucide-react'

interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
}

interface Permission {
  id: string
  name: string
  description: string | null
  category: string
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const res = await fetch('/api/admin/roles')
        if (!res.ok) throw new Error('Failed to fetch roles')
        const json = await res.json()
        setRoles(json.data.roles)
        setPermissions(json.data.permissions)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadRoles()
  }, [])

  const togglePermission = async (roleId: string, permissionName: string, enabled: boolean) => {
    setSaving(`${roleId}-${permissionName}`)
    try {
      const res = await fetch('/api/admin/roles/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId, permissionName, enabled }),
      })
      
      if (!res.ok) throw new Error('Failed to update permission')
      
      setRoles(roles.map(r => {
        if (r.id === roleId) {
          const newPerms = enabled 
            ? [...r.permissions, permissionName]
            : r.permissions.filter(p => p !== permissionName)
          return { ...r, permissions: newPerms }
        }
        return r
      }))
    } catch (err) {
      console.error(err)
      alert('Failed to save permission')
    } finally {
      setSaving(null)
    }
  }

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
  if (error) return <div className="p-8 text-danger">{error}</div>

  const categories = Array.from(new Set(permissions.map(p => p.category)))
  const activeRole = roles.find(r => r.id === selectedRole)

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-6 h-6 text-text" />
            <h1 className="text-2xl font-semibold text-text">Roles & Permissions</h1>
          </div>
          <p className="text-sm text-text-muted ml-9">Manage role-based access control for your organization.</p>
        </div>

        <div className="flex gap-6 items-start">
          <div className="w-72 shrink-0">
            <div className="bg-surface border border-border rounded-lg">
              <div className="px-4 py-3 border-b border-border bg-header-bg">
                <h2 className="text-sm font-medium text-white/70">Roles</h2>
              </div>
              <ul className="divide-y divide-border-light">
                {roles.map(role => {
                  const isActive = role.id === selectedRole
                  return (
                    <li key={role.id}>
                      <button
                        onClick={() => setSelectedRole(role.id)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          isActive
                            ? 'bg-primary-light border-l-2 border-l-primary'
                            : 'hover:bg-surface-alt border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-text'}`}>
                            {role.name}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-primary-light text-primary' : 'bg-surface-alt text-text-muted'
                          }`}>
                            {role.permissions.length}
                          </span>
                        </div>
                        {role.description && (
                          <p className="text-xs text-text-muted mt-1 line-clamp-2">{role.description}</p>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {!activeRole && (
                <div className="px-4 py-6 text-center text-sm text-text-muted">
                  Select a role to manage permissions
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {activeRole ? (
              <div className="bg-surface border border-border rounded-lg">
                <div className="px-6 py-4 border-b border-border bg-header-bg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-medium text-white">{activeRole.name}</h2>
                      {activeRole.description && (
                        <p className="text-sm text-text-secondary mt-0.5">{activeRole.description}</p>
                      )}
                    </div>
                    <span className="text-sm text-text-muted">
                      {activeRole.permissions.length} of {permissions.length} permissions enabled
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-border-light">
                  {categories.map(category => {
                    const isCollapsed = collapsedCategories.has(category)
                    const categoryPerms = permissions.filter(p => p.category === category)
                    const enabledCount = categoryPerms.filter(p => activeRole.permissions.includes(p.name)).length

                    return (
                      <div key={category}>
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between px-6 py-3 bg-surface-alt hover:bg-primary-light transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <svg
                              className={`w-4 h-4 text-text-muted transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-sm font-medium text-text-secondary capitalize">{category}</span>
                          </div>
                          <span className="text-xs text-text-muted">
                            {enabledCount}/{categoryPerms.length}
                          </span>
                        </button>
                        {!isCollapsed && (
                          <div className="px-6 py-2">
                            {categoryPerms.map(permission => {
                              const hasPerm = activeRole.permissions.includes(permission.name)
                              const isAdmin = activeRole.name === 'ADMIN'
                              const isSaving = saving === `${activeRole.id}-${permission.name}`

                              return (
                                <label
                                  key={permission.id}
                                  className={`flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer ${
                                    isAdmin
                                      ? 'cursor-not-allowed opacity-60'
                                      : 'hover:bg-surface-alt'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                    checked={isAdmin ? true : hasPerm}
                                    disabled={isAdmin || isSaving}
                                    onChange={(e) => togglePermission(activeRole.id, permission.name, e.target.checked)}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-text">{permission.name}</div>
                                    {permission.description && (
                                      <div className="text-xs text-text-muted mt-0.5">{permission.description}</div>
                                    )}
                                  </div>
                                  {isSaving && (
                                    <Loader2 className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                                  )}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-lg px-6 py-12 text-center">
                <Shield className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-muted">Select a role from the list to view and edit its permissions.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
