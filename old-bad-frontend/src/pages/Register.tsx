import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { FiMail, FiLock, FiUser, FiUserCheck } from 'react-icons/fi'
import { register } from '../lib/auth'
import { supabase } from '../lib/supabaseClient'
import '../styles/Auth.css'
import { Input, Button, Card, Spinner } from '../ui'
import { AuthLayout } from '../components/AuthLayout'

export function Register() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [idPhotoFile, setIdPhotoFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const navigate = useNavigate()

  const validateForm = () => {
    if (!email || !password || !confirmPassword || !studentId || !fullName) {
      setError(t('register.errors.required'))
      return false
    }
    if (!idPhotoFile || !selfieFile) {
      setError(t('register.errors.upload_id_and_selfie') || 'Please upload your student ID photo and a selfie')
      return false
    }
    if (password !== confirmPassword) {
      setError(t('register.errors.password_mismatch'))
      return false
    }
    if (password.length < 6) {
      setError(t('register.errors.password_short'))
      return false
    }
    if (!email.includes('@')) {
      setError(t('register.errors.invalid_email'))
      return false
    }
    if (fullName.trim().length < 6) {
      setError(t('register.errors.invalid_name'))
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!validateForm()) {
      setLoading(false)
      return
    }

    const res = await register(email, password, studentId, fullName)

    if (res.error) {
      setError(res.error.message)
      setLoading(false)
      return
    }

    // Attempt to determine user id (depends on signup flow/config)
    const createdUserId = res.data?.user?.id || (await (async () => {
      try {
        const s = await supabase.auth.getSession()
        return s?.data?.session?.user?.id ?? null
      } catch (e) {
        return null
      }
    })())

    // If we have a user id, upload files and update profile
    if (createdUserId) {
      try {
        // Upload ID photo
        if (idPhotoFile) {
          const idPath = `id-photos/${createdUserId}/${Date.now()}-${idPhotoFile.name}`
          const { error: uploadErr } = await supabase.storage.from('id-photos').upload(idPath, idPhotoFile, { cacheControl: '3600', upsert: true })
          if (uploadErr) {
            console.error('[Register] upload idPhoto error', uploadErr)
            setError(t('register.errors.upload_failed') || 'Failed to upload ID photo')
            setLoading(false)
            return
          }
          // Update profile with storage path and mark as pending
          const { error: updateErr } = await supabase.from('profiles').update({ id_photo_url: idPath, verification_status: 'pending' }).eq('id', createdUserId)
          if (updateErr) {
            console.error('[Register] update profile error', updateErr)
            setError(t('register.errors.update_profile') || 'Failed to update profile with ID photo')
            setLoading(false)
            return
          }
        }

        // Upload selfie (optional but required by our policy)
        if (selfieFile) {
          const selfiePath = `id-photos/${createdUserId}/selfie-${Date.now()}-${selfieFile.name}`
          const { error: selfieErr } = await supabase.storage.from('id-photos').upload(selfiePath, selfieFile, { cacheControl: '3600', upsert: true })
          if (selfieErr) {
            console.error('[Register] upload selfie error', selfieErr)
            // Not critical for signup completion; surface warning
          }
        }
      } catch (e: any) {
        console.error('[Register] unexpected error during upload:', e)
      }
    } else {
      // If we don't have a user id back (e.g., email confirmation required), instruct user to upload after verification
      console.warn('[Register] no user id available after signup; user may need to confirm email before uploading ID')
    }

    setSuccess(true)
    setTimeout(() => {
      navigate('/dashboard')
    }, 2000)
  }

  const handleIdPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 5 * 1024 * 1024) {
      setError(t('register.errors.file_too_large') || 'File must be 5MB or smaller')
      return
    }
    setIdPhotoFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setIdPhotoPreview(url)
    } else {
      setIdPhotoPreview(null)
    }
  }

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 5 * 1024 * 1024) {
      setError(t('register.errors.file_too_large') || 'File must be 5MB or smaller')
      return
    }
    setSelfieFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setSelfiePreview(url)
    } else {
      setSelfiePreview(null)
    }
  }

  useEffect(() => {
    return () => {
      if (idPhotoPreview) URL.revokeObjectURL(idPhotoPreview)
      if (selfiePreview) URL.revokeObjectURL(selfiePreview)
    }
  }, [idPhotoPreview, selfiePreview])

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{t('register.welcome')}</h1>
          <p className="text-gray-600">{t('register.created')}</p>
        </div>
        <Card>
          <div style={{ textAlign: 'center', paddingTop: 'var(--space-4)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>✓</div>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text)', marginBottom: 'var(--space-3)' }}>
              {t('register.hi_user', { name: fullName })}
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
              {t('register.approval_note')}
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>
              {t('register.redirect')}
            </p>
          </div>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card>
        <div className="auth-                   supabase db pushlayout-header">
          <h1 className="auth-layout-title">{t('register.title')}</h1>
          <p className="auth-layout-subtitle">{t('register.subtitle')}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <Input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} onFocus={() => setFocusedField('fullName')} onBlur={() => setFocusedField(null)} placeholder={t('register.placeholders.fullName')} disabled={loading} icon={<FiUserCheck />} />
            {focusedField === 'fullName' && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', opacity: 0.7, margin: 'var(--space-2) 0 0 0', transition: 'opacity 0.3s ease' }}>
                {t('register.hints.fullName')}
              </p>
            )}
          </div>

          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('register.placeholders.email')} disabled={loading} icon={<FiMail />} />

          <div>
            <Input id="studentId" type="text" value={studentId} onChange={(e) => setStudentId(e.target.value.replace(/\s+/g, '').toUpperCase())} onFocus={() => setFocusedField('studentId')} onBlur={() => setFocusedField(null)} placeholder={t('register.placeholders.studentId')} disabled={loading} icon={<FiUser />} />
            {focusedField === 'studentId' && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', opacity: 0.7, margin: 'var(--space-2) 0 0 0', transition: 'opacity 0.3s ease' }}>
                {t('register.hints.studentId')}
              </p>
            )}
          </div>

          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('register.placeholders.password')} disabled={loading} icon={<FiLock />} />

          <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('register.placeholders.confirmPassword')} disabled={loading} icon={<FiLock />} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Student ID Photo (for verification)</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleIdPhotoChange}
              disabled={loading}
              aria-label="Upload student ID photo"
            />
            <small style={{ color: 'var(--text-muted)' }}>Use the back camera; ensure full card is visible. Max 5MB.</small>
            {idPhotoPreview && (
              <div style={{ marginTop: '8px' }}>
                <img src={idPhotoPreview} alt="ID preview" style={{ maxWidth: 240, borderRadius: 6, display: 'block' }} />
                <button type="button" onClick={() => { setIdPhotoFile(null); URL.revokeObjectURL(idPhotoPreview); setIdPhotoPreview(null); }} style={{ marginTop: 6 }}>Remove</button>
              </div>
            )}

            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>Selfie (for face verification)</label>
            <input
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleSelfieChange}
              disabled={loading}
              aria-label="Upload selfie"
            />
            <small style={{ color: 'var(--text-muted)' }}>Take a clear selfie facing the camera. Max 5MB.</small>
            {selfiePreview && (
              <div style={{ marginTop: '8px' }}>
                <img src={selfiePreview} alt="Selfie preview" style={{ maxWidth: 160, borderRadius: 6, display: 'block' }} />
                <button type="button" onClick={() => { setSelfieFile(null); URL.revokeObjectURL(selfiePreview); setSelfiePreview(null); }} style={{ marginTop: 6 }}>Remove</button>
              </div>
            )}
          </div>

          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? <Spinner size={16} /> : t('register.create_button')}
          </Button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 'var(--space-4) 0 0 0', fontFamily: "'El Messiri', 'Noto Naskh Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif" }}>
          {t('register.have_account')} <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 'var(--font-weight-semibold)' }}>{t('register.sign_in')}</Link>
        </p>
      </Card>
    </AuthLayout>
  )
}
