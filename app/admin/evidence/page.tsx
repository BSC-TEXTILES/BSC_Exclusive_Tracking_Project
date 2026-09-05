'use client'
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FileImage,
  Search,
  LayoutGrid,
  List,
  Download,
  Trash2,
  AlertCircle,
  X,
  ExternalLink,
  Clock,
  CheckCircle2,
} from 'lucide-react'

interface EvidenceItem {
  id: string
  originalName: string
  mimeType: string
  fileSize: number
  storagePath: string
  url: string
  createdAt: string
  user: {
    id: string
    fullName: string
    employeeCode: string
    email: string
  }
  submission: {
    id: string
    status: string
    date: string
  }
  checkpoint: {
    id: string
    title: string
    score: number
    module: {
      id: string
      name: string
      slug: string
    }
  }
}

interface FilterOption {
  id: string
  name: string
  slug?: string
  fullName?: string
  employeeCode?: string
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [users, setUsers] = useState<FilterOption[]>([])
  const [modules, setModules] = useState<FilterOption[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Filters
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedModule, setSelectedModule] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  // Preview Lightbox Modal
  const [previewItem, setPreviewItem] = useState<EvidenceItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchEvidence = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (selectedUser) params.append('userId', selectedUser)
      if (selectedModule) params.append('moduleId', selectedModule)
      if (selectedDate) params.append('date', selectedDate)

      const res = await fetch(`/api/admin/evidence?${params.toString()}`)
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
        setEvidence(result.data.evidence)
        setTotalCount(result.data.totalCount || result.data.total)
        setUsers(result.data.users)
        setModules(result.data.modules)
      } else {
        setError(result.message || 'Failed to load evidence files')
      }
    } catch {
      setError('Network error loading evidence')
    } finally {
      setLoading(false)
    }
  }, [search, selectedUser, selectedModule, selectedDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvidence()
  }, [fetchEvidence])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this evidence file?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/evidence?id=${id}`, { method: 'DELETE' })
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
        setEvidence(prev => prev.filter(e => e.id !== id))
        if (previewItem?.id === id) setPreviewItem(null)
      } else {
        alert(result.message || 'Failed to delete file')
      }
    } catch {
      alert('Error deleting file')
    } finally {
      setDeletingId(null)
    }
  }

  const pendingCount = useMemo(
    () => evidence.filter(e => e.submission.status === 'pending').length,
    [evidence]
  )
  const reviewedCount = useMemo(
    () => evidence.filter(e => e.submission.status === 'reviewed' || e.submission.status === 'approved').length,
    [evidence]
  )

  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text tracking-tight">
              Evidence Management
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Review, manage, and audit all submitted evidence files across modules.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md bg-surface border border-border p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold ${
                viewMode === 'grid'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-surface-alt'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold ${
                viewMode === 'table'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-surface-alt'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
              <FileImage className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted">Total Evidence</p>
              <p className="text-2xl font-bold text-text">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted">Pending Review</p>
              <p className="text-2xl font-bold text-text">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted">Reviewed</p>
              <p className="text-2xl font-bold text-text">{reviewedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-lg border border-border bg-surface p-4 mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="lg:col-span-2">
            <label htmlFor="evidence-search" className="block text-xs font-medium text-text-secondary mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                id="evidence-search"
                type="text"
                placeholder="File name, checkpoint, uploader..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Module filter */}
          <div>
            <label htmlFor="evidence-module" className="block text-xs font-medium text-text-secondary mb-1">
              Module
            </label>
            <select
              id="evidence-module"
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Modules</option>
              {modules.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* User filter */}
          <div>
            <label htmlFor="evidence-user" className="block text-xs font-medium text-text-secondary mb-1">
              Uploader
            </label>
            <select
              id="evidence-user"
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.employeeCode})
                </option>
              ))}
            </select>
          </div>

          {/* Date filter */}
          <div>
            <label htmlFor="evidence-date" className="block text-xs font-medium text-text-secondary mb-1">
              Date
            </label>
            <input
              id="evidence-date"
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {(search || selectedUser || selectedModule || selectedDate) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setSearch('')
                setSelectedUser('')
                setSelectedModule('')
                setSelectedDate('')
              }}
              className="text-xs font-medium text-primary hover:text-primary-hover"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-danger bg-danger/5 p-4 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 h-40 w-full animate-pulse rounded bg-surface-alt" />
              <div className="mb-2 h-3 w-3/4 animate-pulse rounded bg-surface-alt" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-surface-alt" />
            </div>
          ))}
        </div>
      ) : evidence.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface py-16 text-center">
          <FileImage className="mx-auto h-10 w-10 text-text-muted" />
          <h3 className="mt-3 text-sm font-semibold text-text">No evidence files found</h3>
          <p className="mt-1 text-xs text-text-muted">
            {search || selectedUser || selectedModule || selectedDate
              ? 'Try adjusting your filters to see more results.'
              : 'Evidence files will appear here once submitted by employees.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {evidence.map(item => (
            <div
              key={item.id}
              className="group rounded-lg border border-border bg-surface overflow-hidden flex flex-col"
            >
              {/* Thumbnail */}
              <div
                onClick={() => setPreviewItem(item)}
                className="relative h-40 bg-surface-alt cursor-pointer"
              >
                <img
                  src={item.url}
                  alt={item.originalName}
                  className="h-full w-full object-cover"
                  onError={e => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 group-hover:bg-black/20 group-hover:opacity-100 transition-opacity">
                  <span className="inline-flex items-center gap-1 rounded bg-surface px-3 py-1.5 text-xs font-semibold text-text shadow-sm">
                    <ExternalLink className="h-3 w-3" />
                    View
                  </span>
                </div>
              </div>

              {/* Card body */}
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-block truncate rounded bg-primary-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    {item.checkpoint.module.name}
                  </span>
                  <span className="whitespace-nowrap text-[11px] font-mono text-text-muted">
                    {formatBytes(item.fileSize)}
                  </span>
                </div>
                <h4
                  className="mb-2 text-xs font-semibold text-text line-clamp-2"
                  title={item.checkpoint.title}
                >
                  {item.checkpoint.title}
                </h4>
                <div className="mt-auto border-t border-border-light pt-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-text">{item.user.fullName}</p>
                      <p className="text-[10px] font-mono text-text-muted">{item.submission.date}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={item.url}
                        download={item.originalName}
                        className="rounded p-1.5 text-text-muted hover:bg-surface-alt hover:text-text"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="rounded p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-header-bg text-[11px] uppercase tracking-wide text-white/60">
                  <th className="px-4 py-3 font-semibold lg:px-6">Preview</th>
                  <th className="px-4 py-3 font-semibold">File Name</th>
                  <th className="px-4 py-3 font-semibold">Checkpoint / Module</th>
                  <th className="px-4 py-3 font-semibold">Uploader</th>
                  <th className="px-4 py-3 font-semibold">Date &amp; Size</th>
                  <th className="px-4 py-3 text-right font-semibold lg:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light text-text-secondary">
                {evidence.map(item => (
                  <tr key={item.id} className="hover:bg-surface-alt">
                    <td className="px-4 py-3 lg:px-6">
                      <div
                        onClick={() => setPreviewItem(item)}
                        className="h-10 w-10 cursor-pointer overflow-hidden rounded border border-border bg-surface-alt"
                      >
                        <img src={item.url} alt={item.originalName} className="h-full w-full object-cover" />
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 font-medium text-text">
                      {item.originalName}
                    </td>
                    <td className="max-w-sm px-4 py-3">
                      <p className="truncate text-xs font-medium text-text">{item.checkpoint.title}</p>
                      <span className="mt-0.5 inline-block rounded bg-primary-light px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                        {item.checkpoint.module.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-text">{item.user.fullName}</div>
                      <div className="text-xs text-text-muted font-mono">{item.user.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      <div>{item.submission.date}</div>
                      <div className="text-[11px] text-text-muted">{formatBytes(item.fileSize)}</div>
                    </td>
                    <td className="px-4 py-3 text-right lg:px-6">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={item.url}
                          download={item.originalName}
                          className="rounded p-1.5 text-text-muted hover:bg-surface-alt hover:text-text"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="rounded p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 modal-backdrop"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden z-10 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border-light bg-surface-alt px-6 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-text">{previewItem.originalName}</h3>
                <p className="mt-0.5 text-xs text-text-muted">
                  {previewItem.checkpoint.module.name} &bull; {previewItem.user.fullName} &bull; {previewItem.submission.date}
                </p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="ml-4 rounded-lg p-1.5 text-text-muted hover:bg-surface-alt hover:text-text transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Image area */}
            <div className="flex-1 overflow-auto bg-surface-alt p-4 flex items-center justify-center min-h-[300px]">
              <img
                src={previewItem.url}
                alt={previewItem.originalName}
                className="max-h-[60vh] max-w-full object-contain"
              />
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between border-t border-border bg-header-bg px-6 py-4">
              <p className="text-xs text-white/60">
                <span className="font-semibold text-text-secondary">Checkpoint:</span>{' '}
                {previewItem.checkpoint.title}
              </p>
              <a
                href={previewItem.url}
                download={previewItem.originalName}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
