'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  Send,
  Camera,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ImageIcon,
} from 'lucide-react'
import { LiveDateTime } from '@/components/ui/live-date-time'

interface CheckpointDetail {
  id: string
  title: string
  description: string | null
  score: number
  isAccuracyRequired: boolean
  isCorrectiveActionRequired: boolean
  isPhotoRequired: boolean
  moduleName: string
  moduleSlug: string
  departmentName: string
}

interface SubmissionData {
  id: string
  status: string
  answer: {
    complianceStatus: string | null
    accuracyStatus: string | null
    comments: string | null
    correctiveAction: string | null
  } | null
  evidence: Array<{
    id: string
    originalName: string
    mimeType: string
    fileSize: number
    storagePath: string
  }>
}

const COMPLIANCE_OPTIONS = [
  { value: 'FULLY_FOLLOWED', label: '1. Fully Followed' },
  { value: 'PARTIALLY_FOLLOWED', label: '2. Partially Followed' },
  { value: 'NOT_FOLLOWED', label: '3. Not Followed' },
  { value: 'NO_TRANSACTION', label: '4. No Transaction' },
  { value: 'YET_TO_IMPLEMENT', label: '5. Yet to Implement' },
]

const ACCURACY_OPTIONS = [
  { value: 'FULLY_ACCURATE', label: '1. Fully accurate' },
  { value: 'PARTLY_ACCURATE', label: '2. Partly accurate' },
  { value: 'INACCURATE', label: '3. Inaccurate' },
  { value: 'NA', label: '4. NA' },
]

const CORRECTIVE_REQUIRED_STATUSES = ['NOT_FOLLOWED', 'PARTIALLY_FOLLOWED', 'YET_TO_IMPLEMENT']

export default function CheckpointFormPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const checkpointId = params?.id as string
  const moduleSlug = searchParams?.get('module') || ''

  const [checkpoint, setCheckpoint] = useState<CheckpointDetail | null>(null)
  const [submission, setSubmission] = useState<SubmissionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form state
  const [complianceStatus, setComplianceStatus] = useState('')
  const [accuracyStatus, setAccuracyStatus] = useState('')
  const [comments, setComments] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')

  // Autosave state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Evidence
  const [evidenceFiles, setEvidenceFiles] = useState<Array<{ id: string; name: string; size: number }>>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Autosave debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSubmitted = submission?.status === 'SUBMITTED' || submission?.status === 'APPROVED'

  // Load checkpoint data
  useEffect(() => {
    fetch(`/api/checkpoints/${checkpointId}`)
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
          setCheckpoint(result.data.checkpoint)
          setSubmission(result.data.submission)

          // Populate form from existing data
          if (result.data.submission?.answer) {
            const a = result.data.submission.answer
            setComplianceStatus(a.complianceStatus || '')
            setAccuracyStatus(a.accuracyStatus || '')
            setComments(a.comments || '')
            setCorrectiveAction(a.correctiveAction || '')
          }
          if (result.data.submission?.evidence) {
            setEvidenceFiles(result.data.submission.evidence.map((e: SubmissionData['evidence'][0]) => ({
              id: e.id,
              name: e.originalName,
              size: e.fileSize,
            })))
          }
        } else {
          setError(result.message)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load checkpoint')
        setLoading(false)
      })
  }, [checkpointId])

  // Autosave function
  const saveDraft = useCallback(async (data: {
    complianceStatus: string
    accuracyStatus: string
    comments: string
    correctiveAction: string
  }) => {
    if (isSubmitted) return

    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/checkpoints/${checkpointId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
        setSaveStatus('saved')
        if (!submission) {
          setSubmission({ id: result.data.submissionId, status: 'DRAFT', answer: null, evidence: [] })
        }
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    }
  }, [checkpointId, isSubmitted, submission])

  // Debounced autosave on field change
  const triggerAutosave = useCallback(() => {
    if (isSubmitted) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft({ complianceStatus, accuracyStatus, comments, correctiveAction })
    }, 1000)
  }, [complianceStatus, accuracyStatus, comments, correctiveAction, saveDraft, isSubmitted])

  useEffect(() => {
    if (!loading && checkpoint) {
      triggerAutosave()
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [complianceStatus, accuracyStatus, comments, correctiveAction, loading, checkpoint, triggerAutosave])

  const handleSaveDraft = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    await saveDraft({ complianceStatus, accuracyStatus, comments, correctiveAction })
  }

  const handleSubmit = async () => {
    setSubmitMessage('')
    setSubmitSuccess(false)
    setSubmitting(true)

    // Save first
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    await saveDraft({ complianceStatus, accuracyStatus, comments, correctiveAction })

    try {
      const res = await fetch(`/api/checkpoints/${checkpointId}`, {
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
        setSubmitSuccess(true)
        setSubmitMessage('Checkpoint submitted successfully!')
        setSubmission(prev => prev ? { ...prev, status: 'SUBMITTED' } : null)
      } else {
        setSubmitMessage(result.message || 'Failed to submit')
      }
    } catch {
      setSubmitMessage('Failed to submit. Please try again.')
    }
    setSubmitting(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', files[0])
    formData.append('checkpointId', checkpointId)

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
        setEvidenceFiles(prev => [...prev, {
          id: result.data.id,
          name: result.data.originalName,
          size: result.data.fileSize,
        }])
      }
    } catch {
      // Handle error
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveEvidence = async (evidenceId: string) => {
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
      setEvidenceFiles(prev => prev.filter(f => f.id !== evidenceId))
    } catch {
      // Handle error
    }
  }

  const needsCorrectiveAction = CORRECTIVE_REQUIRED_STATUSES.includes(complianceStatus)

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-surface-alt w-24" />
          <div className="h-6 bg-surface-alt w-full" />
          <div className="h-48 bg-surface-alt" />
        </div>
      </div>
    )
  }

  if (error || !checkpoint) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-danger/5 border border-danger/20 p-5 text-center">
          <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
          <p className="text-danger text-sm">{error || 'Checkpoint not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={moduleSlug ? `/modules/${moduleSlug}` : '/dashboard'}
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text"
        >
          <ArrowLeft className="w-4 h-4" />
          {checkpoint.moduleName}
        </Link>
        <LiveDateTime
          showSeconds={false}
          dateFormat="compact"
          timeFormat="12h"
          dateClassName="text-sm font-medium text-text"
          timeClassName="text-xs text-text-muted font-mono"
        />
      </div>

      {/* Title Card */}
      <div className="bg-surface border border-border p-5 mb-5">
        <h1 className="text-lg font-semibold text-text leading-snug">
          {checkpoint.title}
        </h1>
        {checkpoint.description && (
          <p className="text-sm text-text-muted mt-1.5">{checkpoint.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-surface-alt text-text-secondary border border-border">
            {checkpoint.moduleName}
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-warning/5 text-warning border border-warning/20">
            Score: {checkpoint.score}
          </span>
        </div>

        {isSubmitted && (
          <div className="mt-3 flex items-center gap-2 text-success bg-success/5 px-3 py-1.5 text-xs font-medium border border-success/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>This checkpoint has been submitted</span>
          </div>
        )}
      </div>

      {/* Autosave indicator */}
      {!isSubmitted && (
        <div className="flex items-center justify-end mb-3 text-[11px] text-text-muted">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="w-3 h-3" /> Auto-saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-danger">
              <AlertCircle className="w-3 h-3" /> Save failed
            </span>
          )}
        </div>
      )}

      {/* Section: Compliance Status */}
      <div className="bg-surface border border-border mb-4">
        <div className="px-5 py-3 border-b border-border bg-header-bg">
          <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider">Compliance Status</h2>
        </div>
        <div className="p-5">
          <label htmlFor="compliance-status" className="block text-sm font-medium text-text mb-1.5">
            Select compliance status <span className="text-danger">*</span>
          </label>
          <select
            id="compliance-status"
            value={complianceStatus}
            onChange={(e) => setComplianceStatus(e.target.value)}
            disabled={isSubmitted}
            className="w-full px-3 py-2 border border-border text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-surface disabled:bg-surface-alt disabled:cursor-not-allowed"
          >
            <option value="">Select compliance status</option>
            {COMPLIANCE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Section: Accuracy */}
      {checkpoint.isAccuracyRequired && (
        <div className="bg-surface border border-border mb-4">
          <div className="px-5 py-3 border-b border-border bg-header-bg">
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider">Accuracy</h2>
          </div>
          <div className="p-5">
            <label htmlFor="accuracy-status" className="block text-sm font-medium text-text mb-1.5">
              Select accuracy <span className="text-danger">*</span>
            </label>
            <select
              id="accuracy-status"
              value={accuracyStatus}
              onChange={(e) => setAccuracyStatus(e.target.value)}
              disabled={isSubmitted}
              className="w-full px-3 py-2 border border-border text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-surface disabled:bg-surface-alt disabled:cursor-not-allowed"
            >
              <option value="">Select accuracy</option>
              {ACCURACY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Section: Corrective Action */}
      {(needsCorrectiveAction || correctiveAction || checkpoint.isCorrectiveActionRequired) && (
        <div className="bg-surface border border-border mb-4">
          <div className="px-5 py-3 border-b border-border bg-header-bg">
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider">
              Corrective Action
              {needsCorrectiveAction && <span className="text-danger ml-1">*</span>}
            </h2>
          </div>
          <div className="p-5">
            <label htmlFor="corrective-action" className="block text-sm font-medium text-text mb-1.5">
              Describe the corrective action taken
              {!needsCorrectiveAction && <span className="text-text-muted font-normal ml-1">(Optional)</span>}
            </label>
            <textarea
              id="corrective-action"
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              disabled={isSubmitted}
              rows={4}
              placeholder="Describe the corrective action taken..."
              className="w-full px-3 py-2 border border-border text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none disabled:bg-surface-alt disabled:cursor-not-allowed"
            />
          </div>
        </div>
      )}

      {/* Section: Comments */}
      <div className="bg-surface border border-border mb-4">
        <div className="px-5 py-3 border-b border-border bg-header-bg">
          <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider">Comments</h2>
        </div>
        <div className="p-5">
          <label htmlFor="comments" className="block text-sm font-medium text-text mb-1.5">
            Additional comments <span className="text-text-muted font-normal">(Optional)</span>
          </label>
          <textarea
            id="comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={isSubmitted}
            rows={3}
            placeholder="Add any additional comments..."
            className="w-full px-3 py-2 border border-border text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none disabled:bg-surface-alt disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Section: Photo Evidence */}
      <div className="bg-surface border border-border mb-5">
        <div className="px-5 py-3 border-b border-border bg-header-bg">
          <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider">
            Photo Evidence
            {checkpoint.isPhotoRequired && <span className="text-danger ml-1">*</span>}
            {!checkpoint.isPhotoRequired && <span className="text-text-muted font-normal ml-1">(Optional)</span>}
          </h2>
        </div>
        <div className="p-5">
          {/* Uploaded files */}
          {evidenceFiles.length > 0 && (
            <div className="space-y-2 mb-3">
              {evidenceFiles.map(file => (
                <div key={file.id} className="flex items-center justify-between bg-surface-alt border border-border px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ImageIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                    <span className="text-sm text-text truncate">{file.name}</span>
                    <span className="text-[10px] text-text-muted">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  {!isSubmitted && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEvidence(file.id)}
                      aria-label="Remove file"
                      className="text-danger/70 hover:text-danger flex-shrink-0 ml-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload area */}
          {!isSubmitted && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              role="button"
              tabIndex={0}
              className="border-2 border-dashed border-border p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 text-primary mx-auto animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-text-muted mx-auto mb-1" />
              )}
              <p className="text-xs text-text-muted">
                {uploading ? 'Uploading...' : 'Take photo or choose from gallery'}
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Action Buttons */}
      {!isSubmitted && (
        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={submitting}
            className="flex-1 py-2.5 px-4 border border-border bg-surface text-text text-sm font-medium hover:bg-surface-alt flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !complianceStatus}
            className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-hover disabled:bg-surface-alt disabled:text-text-muted disabled:cursor-not-allowed text-white text-sm font-medium flex items-center justify-center gap-2 btn-press"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit
              </>
            )}
          </button>
        </div>
      )}

      {/* Submit Message */}
      {submitMessage && (
        <div className={`p-3 mb-5 text-sm ${submitSuccess ? 'bg-success/5 border border-success/20 text-success' : 'bg-danger/5 border border-danger/20 text-danger'}`}>
          <div className="flex items-center gap-2">
            {submitSuccess ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <p>{submitMessage}</p>
          </div>
          {submitSuccess && moduleSlug && (
            <Link
              href={`/modules/${moduleSlug}`}
              className="inline-block mt-1.5 text-sm text-primary hover:text-primary-hover font-medium"
            >
              ← Back to {checkpoint.moduleName}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
