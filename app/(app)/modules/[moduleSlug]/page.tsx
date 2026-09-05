'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Camera,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ImageIcon,
} from 'lucide-react'

interface EvidenceItem {
  id: string
  name: string
  size: number
  storagePath?: string
}

interface CheckpointData {
  id: string
  title: string
  description: string | null
  score: number
  displayOrder: number
  isAccuracyRequired: boolean
  isCorrectiveActionRequired: boolean
  isPhotoRequired: boolean
  status: string
  submissionId: string | null
  hasAnswer: boolean
  answer?: {
    complianceStatus: string | null
    accuracyStatus: string | null
    comments: string | null
    correctiveAction: string | null
  } | null
  evidence?: EvidenceItem[]
}

interface ModuleData {
  module: {
    id: string
    name: string
    slug: string
    description: string | null
    department: string
  }
  checkpoints: CheckpointData[]
  totalCheckpoints: number
  submittedCount: number
}

const COMPLIANCE_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'FULLY_FOLLOWED', label: '1. Fully Followed' },
  { value: 'PARTIALLY_FOLLOWED', label: '2. Partially Followed' },
  { value: 'NOT_FOLLOWED', label: '3. Not Followed' },
  { value: 'NO_TRANSACTION', label: '4. No Transaction' },
  { value: 'YET_TO_IMPLEMENT', label: '5. Yet to Implement' },
]

const ACCURACY_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'FULLY_ACCURATE', label: '1. Fully accurate' },
  { value: 'PARTLY_ACCURATE', label: '2. Partly accurate' },
  { value: 'INACCURATE', label: '3. Inaccurate' },
  { value: 'NA', label: '4. NA' },
]

export default function ModuleDetailPage() {
  const params = useParams()
  const moduleSlug = params?.moduleSlug as string

  const [data, setData] = useState<ModuleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Expanded checkpoint accordion state (store active checkpoint id)
  const [expandedCheckpointId, setExpandedCheckpointId] = useState<string | null>(null)

  // Local form states per checkpoint id
  const [formState, setFormState] = useState<Record<string, {
    complianceStatus: string
    accuracyStatus: string
    correctiveAction: string
    evidence: EvidenceItem[]
    saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  }>>({})

  // Submit all state
  const [submittingAll, setSubmittingAll] = useState(false)
  const [submitAllMessage, setSubmitAllMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // File upload state & ref
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingCheckpointId, setUploadingCheckpointId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Debounce timeouts map
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  const fetchData = useCallback(() => {
    fetch(`/api/modules/${moduleSlug}`)
      .then(res => {
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        return res.json()
      })
      .then(result => {
        if (!result) return
        if (result.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (result.success) {
          setData(result.data)

          // Initialize form state for all checkpoints
          const initialForms: typeof formState = {}
          result.data.checkpoints.forEach((cp: CheckpointData) => {
            initialForms[cp.id] = {
              complianceStatus: cp.answer?.complianceStatus || '',
              accuracyStatus: cp.answer?.accuracyStatus || '',
              correctiveAction: cp.answer?.correctiveAction || '',
              evidence: cp.evidence || [],
              saveStatus: 'idle',
            }
          })
          setFormState(initialForms)

          // Auto-expand first pending checkpoint if none expanded
          if (!expandedCheckpointId && result.data.checkpoints.length > 0) {
            const firstPending = result.data.checkpoints.find((cp: CheckpointData) => cp.status !== 'SUBMITTED' && cp.status !== 'APPROVED')
            setExpandedCheckpointId(firstPending ? firstPending.id : result.data.checkpoints[0].id)
          }
        } else {
          setError(result.message || 'Failed to load module')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to connect to server')
        setLoading(false)
      })
  }, [moduleSlug, expandedCheckpointId])

  useEffect(() => {
    if (moduleSlug) fetchData()
  }, [moduleSlug, fetchData])

  // Save Draft API call
  const saveCheckpointDraft = useCallback(async (
    cpId: string,
    stateToSave: {
      complianceStatus: string
      accuracyStatus: string
      correctiveAction: string
    }
  ) => {
    setFormState(prev => ({
      ...prev,
      [cpId]: { ...prev[cpId], saveStatus: 'saving' },
    }))

    try {
      const res = await fetch(`/api/checkpoints/${cpId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stateToSave),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const resData = await res.json()
      if (resData.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }

      if (resData.success) {
        setFormState(prev => ({
          ...prev,
          [cpId]: { ...prev[cpId], saveStatus: 'saved' },
        }))

        // Update local checkpoint status to DRAFT if it was PENDING
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            checkpoints: prev.checkpoints.map(cp => {
              if (cp.id === cpId && cp.status === 'PENDING') {
                return { ...cp, status: 'DRAFT', hasAnswer: true }
              }
              return cp
            }),
          }
        })
      } else {
        setFormState(prev => ({
          ...prev,
          [cpId]: { ...prev[cpId], saveStatus: 'error' },
        }))
      }
    } catch {
      setFormState(prev => ({
        ...prev,
        [cpId]: { ...prev[cpId], saveStatus: 'error' },
      }))
    }
  }, [])

  // Debounced auto-save handler
  const handleFieldChange = (
    cpId: string,
    field: 'complianceStatus' | 'accuracyStatus' | 'correctiveAction',
    value: string
  ) => {
    const currentForm = formState[cpId] || {
      complianceStatus: '',
      accuracyStatus: '',
      correctiveAction: '',
      evidence: [],
      saveStatus: 'idle',
    }

    const updated = { ...currentForm, [field]: value, saveStatus: 'saving' as const }
    setFormState(prev => ({ ...prev, [cpId]: updated }))

    // Clear previous timer for this checkpoint
    if (debounceTimers.current[cpId]) {
      clearTimeout(debounceTimers.current[cpId])
    }

    debounceTimers.current[cpId] = setTimeout(() => {
      saveCheckpointDraft(cpId, {
        complianceStatus: updated.complianceStatus,
        accuracyStatus: updated.accuracyStatus,
        correctiveAction: updated.correctiveAction,
      })
    }, 800)
  }

  // Explicit "Save draft" button click
  const handleSaveDraftClick = (cpId: string) => {
    if (debounceTimers.current[cpId]) {
      clearTimeout(debounceTimers.current[cpId])
    }
    const currentForm = formState[cpId]
    if (!currentForm) return
    saveCheckpointDraft(cpId, {
      complianceStatus: currentForm.complianceStatus,
      accuracyStatus: currentForm.accuracyStatus,
      correctiveAction: currentForm.correctiveAction,
    })
  }

  // Handle Photo Evidence Upload
  const handlePhotoClick = (cpId: string) => {
    setUploadingCheckpointId(cpId)
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    const cpId = uploadingCheckpointId
    if (!files || files.length === 0 || !cpId) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', files[0])
    formData.append('checkpointId', cpId)

    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        body: formData,
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
        const newEvidence: EvidenceItem = {
          id: result.data.id,
          name: result.data.originalName,
          size: result.data.fileSize,
        }
        setFormState(prev => ({
          ...prev,
          [cpId]: {
            ...prev[cpId],
            evidence: [...(prev[cpId]?.evidence || []), newEvidence],
          },
        }))
      }
    } catch {
      // Failed to upload
    }
    setUploading(false)
    setUploadingCheckpointId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveEvidence = async (cpId: string, evidenceId: string) => {
    try {
      const res = await fetch(`/api/evidence/${evidenceId}`, { method: 'DELETE' })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const result = await res.json()
      if (result.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
      setFormState(prev => ({
        ...prev,
        [cpId]: {
          ...prev[cpId],
          evidence: prev[cpId]?.evidence.filter(e => e.id !== evidenceId) || [],
        },
      }))
    } catch {
      // Handle error
    }
  }

  // Submit All completed checkpoints
  const handleSubmitAll = async () => {
    if (!data) return
    setSubmittingAll(true)
    setSubmitAllMessage(null)

    try {
      const res = await fetch(`/api/modules/${moduleSlug}/submit-all`, {
        method: 'POST',
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
        setSubmitAllMessage({
          type: 'success',
          text: `Successfully submitted ${result.data.submittedCount} checkpoint(s)!`,
        })
        fetchData()
      } else {
        setSubmitAllMessage({
          type: 'error',
          text: result.message || 'Failed to submit module checkpoints',
        })
      }
    } catch {
      setSubmitAllMessage({
        type: 'error',
        text: 'Connection error while submitting. Please try again.',
      })
    }
    setSubmittingAll(false)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-surface rounded border border-border-light p-5" />
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-surface rounded border border-border-light" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-danger-bg border border-danger-bg rounded p-5 text-center">
          <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
          <p className="text-danger text-sm font-medium">{error || 'Module not found'}</p>
          <Link href="/dashboard" className="text-primary hover:text-primary-hover text-xs font-semibold mt-3 inline-block">
            &larr; Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const progressPercent = data.totalCheckpoints > 0
    ? Math.round((data.submittedCount / data.totalCheckpoints) * 100)
    : 0

  const allSubmitted = data.totalCheckpoints > 0 && data.submittedCount === data.totalCheckpoints

  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const checkpointStatus = (cp: CheckpointData) => {
    if (cp.status === 'SUBMITTED' || cp.status === 'APPROVED') {
      return { label: 'Submitted', dotClass: 'bg-success', badgeClass: 'bg-success-bg text-success border-success-bg' }
    }
    if (cp.status === 'DRAFT') {
      return { label: 'Draft', dotClass: 'bg-warning', badgeClass: 'bg-warning-bg text-warning border-warning-bg' }
    }
    return { label: 'Pending', dotClass: 'bg-text-muted', badgeClass: 'bg-surface-alt text-text-muted border-border-light' }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-slide-up">
      {/* Hidden file input for camera/photo evidence */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Module Header */}
      <div className="flex items-start justify-between mb-5 animate-fade-in">
        <div>
          <h1 className="text-lg font-semibold text-text">{data.module.name}</h1>
          <p className="text-xs text-text-muted mt-0.5">{data.module.department} &middot; {today}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-text">{data.submittedCount}/{data.totalCheckpoints}</p>
          <p className="text-[11px] text-text-muted">checkpoints</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-5">
        <div className="w-full bg-border-light h-1 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Submit All Section */}
      <div className="flex items-center justify-between bg-surface border border-border px-4 py-3 mb-5">
        <span className="text-xs text-text-secondary">
          {allSubmitted ? 'All checkpoints submitted' : `${data.submittedCount} of ${data.totalCheckpoints} submitted`}
        </span>
        <button
          onClick={handleSubmitAll}
          disabled={submittingAll || allSubmitted}
          className="bg-primary hover:bg-primary-hover disabled:bg-border-light disabled:cursor-not-allowed text-white font-medium text-xs px-4 py-2 flex items-center gap-1.5"
        >
          {submittingAll ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : allSubmitted ? (
            <span>Submitted</span>
          ) : (
            <span>Submit All</span>
          )}
        </button>
      </div>

      {/* Submit all status message */}
      {submitAllMessage && (
        <div className={`mb-4 text-xs px-3 py-2 flex items-center gap-2 border ${
          submitAllMessage.type === 'success'
            ? 'bg-success-bg text-success border-success-bg'
            : 'bg-danger-bg text-danger border-danger-bg'
        }`}>
          {submitAllMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{submitAllMessage.text}</span>
        </div>
      )}

      {/* Checkpoint List */}
      <div>
        <div className="border border-border bg-surface">
          {/* Table Header */}
          <div className="flex items-center px-4 py-2 bg-header-bg border-b border-border">
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider flex-1">Checkpoint</span>
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider w-20 text-center">Status</span>
          </div>

          {/* Checkpoint Rows */}
          {data.checkpoints.map((cp) => {
            const isExpanded = expandedCheckpointId === cp.id
            const currentForm = formState[cp.id] || {
              complianceStatus: '',
              accuracyStatus: '',
              correctiveAction: '',
              evidence: [],
              saveStatus: 'idle',
            }

            const isSubmitted = cp.status === 'SUBMITTED' || cp.status === 'APPROVED'
            const status = checkpointStatus(cp)

            return (
              <div key={cp.id} className="border-b border-border-light last:border-b-0 hover-lift">
                {/* Row */}
                <div
                  onClick={() => setExpandedCheckpointId(isExpanded ? null : cp.id)}
                  className="flex items-center px-4 py-3 cursor-pointer hover:bg-surface-alt"
                >
                  {/* Status dot + Title */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dotClass}`} />
                    <span className="text-sm text-text truncate">{cp.title}</span>
                  </div>

                  {/* Status Badge */}
                  <span className={`w-20 text-center text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 border flex-shrink-0 ${status.badgeClass}`}>
                    {status.label}
                  </span>
                </div>

                {/* Expanded Form */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-border-light">
                    {/* Tags */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 bg-surface-alt text-text-muted border border-border-light">
                        {data.module.name}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 bg-surface-alt text-text-muted border border-border-light">
                        Score: {cp.score}
                      </span>
                      {cp.description && (
                        <span className="text-[10px] text-text-muted truncate max-w-xs">{cp.description}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Compliance Status */}
                      <div>
                        <label htmlFor={`compliance-${cp.id}`} className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                          Compliance Status
                        </label>
                        <select
                          id={`compliance-${cp.id}`}
                          value={currentForm.complianceStatus}
                          onChange={(e) => handleFieldChange(cp.id, 'complianceStatus', e.target.value)}
                          disabled={isSubmitted}
                          className="w-full bg-surface border border-border px-3 py-2 text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-surface-alt disabled:text-text-muted"
                        >
                          {COMPLIANCE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Accuracy */}
                      <div>
                        <label htmlFor={`accuracy-${cp.id}`} className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                          Accuracy
                        </label>
                        <select
                          id={`accuracy-${cp.id}`}
                          value={currentForm.accuracyStatus}
                          onChange={(e) => handleFieldChange(cp.id, 'accuracyStatus', e.target.value)}
                          disabled={isSubmitted}
                          className="w-full bg-surface border border-border px-3 py-2 text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-surface-alt disabled:text-text-muted"
                        >
                          {ACCURACY_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Corrective Action */}
                    <div className="mt-4">
                      <label htmlFor={`corrective-${cp.id}`} className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                        Corrective Action
                      </label>
                      <textarea
                        id={`corrective-${cp.id}`}
                        rows={2}
                        placeholder="Describe corrective actions taken..."
                        value={currentForm.correctiveAction}
                        onChange={(e) => handleFieldChange(cp.id, 'correctiveAction', e.target.value)}
                        disabled={isSubmitted}
                        className="w-full bg-surface border border-border px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-surface-alt disabled:text-text-muted resize-none"
                      />
                    </div>

                    {/* Photo Evidence */}
                    <div className="mt-4">
                      <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                        Photo Evidence
                      </label>

                      {/* Uploaded files */}
                      {currentForm.evidence && currentForm.evidence.length > 0 && (
                        <div className="space-y-1.5 mb-2">
                          {currentForm.evidence.map(file => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between bg-surface-alt border border-border-light px-3 py-1.5 text-xs text-text-secondary"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <ImageIcon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                                <span className="truncate">{file.name}</span>
                              </div>
                              {!isSubmitted && (
                                <button
                                  onClick={() => handleRemoveEvidence(cp.id, file.id)}
                                  className="text-text-muted hover:text-danger ml-2"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload area */}
                      {!isSubmitted && (
                        <div
                          onClick={() => handlePhotoClick(cp.id)}
                          className="border border-dashed border-border p-4 text-center cursor-pointer hover:bg-surface-alt"
                        >
                          {uploading && uploadingCheckpointId === cp.id ? (
                            <div className="flex items-center justify-center gap-2 py-1">
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                              <span className="text-xs text-text-muted">Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 py-1">
                              <Camera className="w-4 h-4 text-text-muted" />
                              <span className="text-xs text-text-secondary">Take photo or upload file</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Save Draft */}
                    <div className="mt-4 flex items-center gap-3">
                      {!isSubmitted ? (
                        <button
                          onClick={() => handleSaveDraftClick(cp.id)}
                          disabled={currentForm.saveStatus === 'saving'}
                          className="bg-primary hover:bg-primary-hover disabled:bg-border-light text-white font-medium text-xs px-4 py-2 flex items-center gap-1.5"
                        >
                          {currentForm.saveStatus === 'saving' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <span>Save Draft</span>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-text-muted">This checkpoint has been submitted.</span>
                      )}
                      <span className="text-[11px] text-text-muted ml-auto">
                        {currentForm.saveStatus === 'saving' ? 'Saving changes...' : 'Auto-saved'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
