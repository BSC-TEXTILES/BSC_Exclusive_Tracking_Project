import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { UserCircle, Lock, Save, Loader2, CheckCircle2, ShieldCheck, Building2, Camera, Trash2 } from 'lucide-react'
import { get, put, post, del } from '../lib/api'
import { apiUrl } from '../lib/api'
import { Spinner, ErrorState, PageHeader } from '../components/States'
import { useAuth } from '../lib/auth'
import { fmtDateTime } from '../lib/format'

interface ProfileData {
  id: string
  employee_code: string
  full_name: string
  email: string
  phone: string | null
  username: string
  profile_image: string | null
  must_change_password: boolean
  last_login_at: string | null
  role_name: string
  department_name: string | null
  created_at: string
}

export default function Profile() {
  const { user, refresh } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoMsg, setInfoMsg] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    setError('')
    get<{ profile: ProfileData }>('/api/profile')
      .then((d) => {
        setProfile(d.profile)
        setFullName(d.profile.full_name)
        setEmail(d.profile.email)
        setPhone(d.profile.phone || '')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const saveInfo = async (e: FormEvent) => {
    e.preventDefault()
    setSavingInfo(true)
    setInfoMsg('')
    try {
      await put('/api/profile', { fullName, email, phone: phone || null })
      setInfoMsg('Profile updated successfully')
      await refresh()
    } catch (err) {
      setInfoMsg((err as Error).message)
    } finally {
      setSavingInfo(false)
    }
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (newPassword.length < 8) {
      setPwMsg({ ok: false, text: 'New password must be at least 8 characters' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ ok: false, text: 'Passwords do not match' })
      return
    }
    setSavingPw(true)
    try {
      await put('/api/profile/password', { currentPassword, newPassword })
      setPwMsg({ ok: true, text: 'Password changed successfully' })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err) {
      setPwMsg({ ok: false, text: (err as Error).message })
    } finally {
      setSavingPw(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setPhotoMsg({ ok: false, text: 'Photo must be under 5 MB' })
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoMsg({ ok: false, text: 'Only JPG, PNG, and WEBP images are allowed' })
      return
    }
    setUploadingPhoto(true)
    setPhotoMsg(null)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      const result = await post<{ profileImage: string }>('/api/profile/photo', formData)
      if (profile) setProfile({ ...profile, profile_image: result.profileImage })
      setPhotoMsg({ ok: true, text: 'Profile photo updated successfully' })
      await refresh()
    } catch (err) {
      setPhotoMsg({ ok: false, text: (err as Error).message })
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePhotoRemove = async () => {
    setUploadingPhoto(true)
    setPhotoMsg(null)
    try {
      await del('/api/profile/photo')
      if (profile) setProfile({ ...profile, profile_image: null })
      setPhotoMsg({ ok: true, text: 'Profile photo removed' })
      await refresh()
    } catch (err) {
      setPhotoMsg({ ok: false, text: (err as Error).message })
    } finally {
      setUploadingPhoto(false)
    }
  }

  if (loading) return <Spinner text="Loading profile..." />
  if (error || !profile) return <ErrorState message={error || 'Failed to load profile'} onRetry={load} />

  const initials = profile.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your personal information and security" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Identity card */}
        <div className="card p-6 text-center">
          <div className="relative w-24 h-24 mx-auto group">
            {profile.profile_image ? (
              <img
                src={profile.profile_image.startsWith('http') ? profile.profile_image : apiUrl(profile.profile_image)}
                alt={profile.full_name}
                className="w-24 h-24 rounded-2xl object-cover shadow-lg border-2 border-white"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-700 text-white text-2xl font-extrabold flex items-center justify-center shadow-lg">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
              title="Upload photo"
            >
              {uploadingPhoto ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
          {profile.profile_image && (
            <button
              onClick={handlePhotoRemove}
              disabled={uploadingPhoto}
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-danger hover:text-red-700 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Remove photo
            </button>
          )}
          {photoMsg && (
            <p className={`text-[10px] font-semibold mt-2 ${photoMsg.ok ? 'text-success' : 'text-danger'}`}>
              {photoMsg.text}
            </p>
          )}
          <h2 className="text-base font-bold text-text mt-3">{profile.full_name}</h2>
          <p className="text-xs text-text-muted">{profile.employee_code}</p>
          <div className="flex justify-center gap-2 mt-3 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-primary-light text-primary-deep text-[11px] font-bold">{profile.role_name}</span>
            {profile.department_name && (
              <span className="px-2.5 py-1 rounded-full bg-surface-alt border border-border text-text-secondary text-[11px] font-semibold flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {profile.department_name}
              </span>
            )}
          </div>
          <div className="mt-5 text-left space-y-2.5 text-xs">
            <div className="flex justify-between"><span className="text-text-muted">Username</span><b className="text-text">{profile.username}</b></div>
            <div className="flex justify-between"><span className="text-text-muted">Email</span><b className="text-text">{profile.email}</b></div>
            <div className="flex justify-between"><span className="text-text-muted">Last login</span><b className="text-text">{fmtDateTime(profile.last_login_at)}</b></div>
            <div className="flex justify-between"><span className="text-text-muted">Member since</span><b className="text-text">{fmtDateTime(profile.created_at)}</b></div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {/* Info form */}
          <form onSubmit={saveInfo} className="card p-5">
            <h3 className="text-sm font-bold text-text flex items-center gap-2 mb-4">
              <UserCircle className="w-4 h-4 text-primary" /> Personal information
            </h3>
            {infoMsg && (
              <p className={`text-xs font-semibold mb-3 ${infoMsg.startsWith('Profile') ? 'text-success' : 'text-danger'}`}>{infoMsg}</p>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
              </div>
            </div>
            <button type="submit" disabled={savingInfo} className="btn btn-primary mt-4">
              {savingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save changes
            </button>
          </form>

          {/* Password form */}
          <form onSubmit={savePassword} className="card p-5">
            <h3 className="text-sm font-bold text-text flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 text-primary" /> Change password
            </h3>
            {pwMsg && (
              <div className={`flex items-center gap-2 text-xs font-semibold mb-3 px-3 py-2 rounded-lg ${pwMsg.ok ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>
                {pwMsg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {pwMsg.text}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Current password</label>
                <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <div />
              <div>
                <label className="label">New password</label>
                <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            <button type="submit" disabled={savingPw} className="btn btn-primary mt-4">
              {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-3.5 h-3.5" />} Update password
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
