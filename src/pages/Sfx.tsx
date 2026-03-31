import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { isAuthConfigured, supabase } from '../lib/supabaseClient'
import { TopNav } from '../components/TopNav'
import { GuestIntro } from '../components/GuestIntro'
import './camera.css'

type RenderResult = {
  id: string
  status: 'queued' | 'running' | 'done' | 'error'
  video?: string
  error?: string
}

const API_ENDPOINT = '/api/mmaudio'
const VIDEO_TICKET_COST = 1
const MAX_SOURCE_SECONDS = 10.5
const OAUTH_REDIRECT_URL =
  import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? (typeof window !== 'undefined' ? window.location.origin : undefined)

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const toBase64 = (dataUrl: string) => {
  const parts = dataUrl.split(',')
  return parts.length > 1 ? parts[1] : dataUrl
}

const normalizeVideo = (value: unknown, filename?: string) => {
  if (typeof value !== 'string' || !value) return null
  if (value.startsWith('data:') || value.startsWith('http')) return value
  const ext = filename?.split('.').pop()?.toLowerCase()
  const mime =
    ext === 'webm'
      ? 'video/webm'
      : ext === 'mov' || ext === 'qt'
      ? 'video/quicktime'
      : ext === 'gif'
      ? 'image/gif'
      : 'video/mp4'
  return `data:${mime};base64,${value}`
}

const base64ToBlob = (base64: string, mime: string) => {
  const chunkSize = 0x8000
  const byteChars = atob(base64)
  const byteArrays: Uint8Array[] = []
  for (let offset = 0; offset < byteChars.length; offset += chunkSize) {
    const slice = byteChars.slice(offset, offset + chunkSize)
    const byteNumbers = new Array(slice.length)
    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i)
    }
    byteArrays.push(new Uint8Array(byteNumbers))
  }
  return new Blob(byteArrays, { type: mime })
}

const dataUrlToBlob = (dataUrl: string, fallbackMime: string) => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!match) return base64ToBlob(dataUrl, fallbackMime)
  const mime = match[1] || fallbackMime
  const base64 = match[2] || ''
  return base64ToBlob(base64, mime)
}

const extractErrorMessage = (payload: any) =>
  payload?.error ||
  payload?.message ||
  payload?.output?.error ||
  payload?.result?.error ||
  payload?.output?.output?.error ||
  payload?.result?.output?.error

const normalizeErrorMessage = (value: unknown) => {
  if (!value) return 'Request failed.'
  if (typeof value === 'object') {
    const maybe = value as { error?: unknown; message?: unknown; detail?: unknown }
    const picked = maybe.error ?? maybe.message ?? maybe.detail
    if (typeof picked === 'string' && picked) return picked
    if (value instanceof Error && value.message) return value.message
  }
  const raw = typeof value === 'string' ? value : value instanceof Error ? value.message : String(value)
  const lowered = raw.toLowerCase()
  if (
    lowered.includes('out of memory') ||
    lowered.includes('would exceed allowed memory') ||
    lowered.includes('allocation on device') ||
    lowered.includes('cuda') ||
    lowered.includes('oom')
  ) {
    return 'Worker out of memory. Please retry with a shorter or lighter video.'
  }
  const trimmed = raw.trim()
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed)
      const message = parsed?.error || parsed?.message || parsed?.detail
      if (typeof message === 'string' && message) return message
    } catch {
      // ignore parse errors
    }
  }
  return raw
}

const isTicketShortage = (status: number, message: string) => {
  if (status === 402) return true
  const lowered = message.toLowerCase()
  return (
    lowered.includes('no ticket') ||
    lowered.includes('no tickets') ||
    lowered.includes('insufficient_tickets') ||
    lowered.includes('insufficient tickets') ||
    lowered.includes('token') ||
    lowered.includes('credit')
  )
}

const isFailureStatus = (status: string) => {
  const normalized = status.toLowerCase()
  return normalized.includes('fail') || normalized.includes('error') || normalized.includes('cancel')
}

const isVideoLike = (value: unknown, filename?: string) => {
  const ext = filename?.split('.').pop()?.toLowerCase()
  if (ext && ['mp4', 'webm', 'mov', 'm4v', 'gif'].includes(ext)) return true
  if (typeof value !== 'string' || !value) return false
  if (value.startsWith('data:video/') || value.startsWith('data:image/gif')) return true
  if (value.startsWith('http')) return true
  return value.length > 64
}

const extractVideoList = (payload: any) => {
  const output = payload?.output ?? payload?.result ?? payload
  const nested = output?.output ?? output?.result ?? output?.data ?? payload?.output?.output ?? payload?.result?.output
  const listCandidates = [
    output?.videos,
    output?.outputs,
    output?.output_videos,
    output?.data,
    payload?.videos,
    payload?.output_videos,
    nested?.videos,
    nested?.outputs,
    nested?.output_videos,
    nested?.data,
  ]

  for (const candidate of listCandidates) {
    if (!Array.isArray(candidate)) continue
    const normalized = candidate
      .map((item: any) => {
        const raw =
          item?.video ??
          item?.video_base64 ??
          item?.output_video ??
          item?.data ??
          item?.url ??
          item?.output?.video ??
          item
        const name = item?.filename ?? item?.name
        if (!isVideoLike(raw, name)) return null
        return normalizeVideo(raw, name)
      })
      .filter(Boolean) as string[]
    if (normalized.length) return normalized
  }

  const singleCandidates = [
    output?.video,
    output?.video_base64,
    output?.output_video,
    output?.output_video_base64,
    payload?.video,
    payload?.video_base64,
    payload?.output_video,
    payload?.output_video_base64,
    nested?.video,
    nested?.video_base64,
    nested?.output_video,
    nested?.output_video_base64,
  ]
  for (const candidate of singleCandidates) {
    if (!isVideoLike(candidate)) continue
    const normalized = normalizeVideo(candidate)
    if (normalized) return [normalized]
  }

  return []
}

const extractJobId = (payload: any) => payload?.id || payload?.jobId || payload?.job_id || payload?.output?.id

export function Sfx() {
  const [sourcePreview, setSourcePreview] = useState<string | null>(null)
  const [sourcePayload, setSourcePayload] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [sourceDurationSec, setSourceDurationSec] = useState<number | null>(null)
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<RenderResult | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [ticketCount, setTicketCount] = useState<number | null>(null)
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [ticketMessage, setTicketMessage] = useState('')
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [errorModalMessage, setErrorModalMessage] = useState<string | null>(null)
  const [previewWidth, setPreviewWidth] = useState(16)
  const [previewHeight, setPreviewHeight] = useState(9)
  const runIdRef = useRef(0)
  const navigate = useNavigate()

  const accessToken = session?.access_token ?? ''
  const totalSteps = 3
  const stepTitles = ['動画をアップロード', '効果音プロンプト', '生成'] as const
  const canAdvanceVideo = Boolean(sourcePayload)
  const canAdvancePrompt = prompt.trim().length > 0
  const displayVideo = result?.video ?? null

  const viewerStyle = useMemo(
    () =>
      ({
        '--viewer-aspect': `${Math.max(1, previewWidth)} / ${Math.max(1, previewHeight)}`,
        '--progress': result?.status === 'done' ? 1 : isRunning ? 0.5 : 0,
      }) as CSSProperties,
    [isRunning, previewHeight, previewWidth, result?.status],
  )

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setAuthReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase) return
    const hasCode = typeof window !== 'undefined' && window.location.search.includes('code=')
    const hasState = typeof window !== 'undefined' && window.location.search.includes('state=')
    if (!hasCode || !hasState) return
    supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      if (error) {
        setStatusMessage(error.message)
        return
      }
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      url.searchParams.delete('state')
      window.history.replaceState({}, document.title, url.toString())
    })
  }, [])

  useEffect(() => {
    return () => {
      if (sourcePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(sourcePreview)
      }
    }
  }, [sourcePreview])

  const fetchTickets = useCallback(async (token: string) => {
    if (!token) return null
    setTicketStatus('loading')
    setTicketMessage('')
    const res = await fetch('/api/tickets', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setTicketStatus('error')
      setTicketMessage(data?.error || 'Failed to load tokens.')
      setTicketCount(null)
      return null
    }
    const nextCount = Number(data?.tickets ?? 0)
    setTicketStatus('idle')
    setTicketMessage('')
    setTicketCount(nextCount)
    return nextCount
  }, [])

  useEffect(() => {
    if (!session || !accessToken) {
      setTicketCount(null)
      setTicketStatus('idle')
      setTicketMessage('')
      return
    }
    void fetchTickets(accessToken)
  }, [accessToken, fetchTickets, session])

  const submitVideo = useCallback(
    async (payload: string, token: string) => {
      if (!sourceDurationSec || !Number.isFinite(sourceDurationSec)) {
        throw new Error('動画の長さを確認できませんでした。')
      }
      const input: Record<string, unknown> = {
        prompt,
        video_base64: payload,
        video_name: sourceName || 'input.mp4',
        duration_sec: sourceDurationSec,
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ input }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const rawMessage = data?.error || data?.message || data?.detail || 'Generation failed.'
        const message = normalizeErrorMessage(rawMessage)
        if (isTicketShortage(res.status, message)) {
          setShowTicketModal(true)
          setStatusMessage('トークン不足')
          throw new Error('TICKET_SHORTAGE')
        }
        setErrorModalMessage(message)
        throw new Error(message)
      }
      const nextTickets = Number(data?.ticketsLeft ?? data?.tickets_left)
      if (Number.isFinite(nextTickets)) setTicketCount(nextTickets)
      const videos = extractVideoList(data)
      if (videos.length) return { videos }
      const jobId = extractJobId(data)
      if (!jobId) throw new Error('Job id not found in response.')
      const usageId = String(data?.usage_id ?? data?.usageId ?? '')
      if (!usageId) throw new Error('usage_id not found in response.')
      return { jobId, usageId }
    },
    [prompt, sourceDurationSec, sourceName],
  )

  const pollJob = useCallback(async (jobId: string, usageId: string, runId: number, token?: string) => {
    let notFoundCount = 0
    for (let i = 0; i < 180; i += 1) {
      if (runIdRef.current !== runId) return { status: 'cancelled' as const, videos: [] as string[] }
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(
        `${API_ENDPOINT}?id=${encodeURIComponent(jobId)}&usage_id=${encodeURIComponent(usageId)}`,
        { headers },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 404) {
          notFoundCount += 1
          if (notFoundCount <= 20) {
            await wait(1200 + i * 50)
            continue
          }
        }
        const rawMessage = data?.error || data?.message || data?.detail || 'Failed to poll status.'
        const message = normalizeErrorMessage(rawMessage)
        if (isTicketShortage(res.status, message)) {
          setShowTicketModal(true)
          setStatusMessage('トークン不足')
          throw new Error('TICKET_SHORTAGE')
        }
        setErrorModalMessage(message)
        throw new Error(message)
      }
      notFoundCount = 0
      const nextTickets = Number(data?.ticketsLeft ?? data?.tickets_left)
      if (Number.isFinite(nextTickets)) setTicketCount(nextTickets)
      const status = String(data?.status || data?.state || '').toLowerCase()
      const statusError = extractErrorMessage(data)
      if (statusError || isFailureStatus(status)) {
        throw new Error(normalizeErrorMessage(statusError || 'Generation failed.'))
      }
      const videos = extractVideoList(data)
      if (videos.length) return { status: 'done' as const, videos }
      await wait(2000 + i * 50)
    }
    throw new Error('Timed out while waiting for output.')
  }, [])

  const startGenerate = useCallback(
    async (payload: string) => {
      const runId = runIdRef.current + 1
      runIdRef.current = runId
      setIsRunning(true)
      setStatusMessage('')
      setResult({ id: makeId(), status: 'running' })

      try {
        const submitted = await submitVideo(payload, accessToken)
        if (runIdRef.current !== runId) return
        if ('videos' in submitted && submitted.videos.length) {
          setResult({ id: makeId(), status: 'done', video: submitted.videos[0] })
          setStatusMessage('完了')
          if (accessToken) void fetchTickets(accessToken)
          return
        }
        const polled = await pollJob(submitted.jobId, submitted.usageId, runId, accessToken)
        if (runIdRef.current !== runId) return
        if (polled.status === 'done' && polled.videos.length) {
          setResult({ id: makeId(), status: 'done', video: polled.videos[0] })
          setStatusMessage('完了')
          if (accessToken) void fetchTickets(accessToken)
        }
      } catch (error) {
        const message = normalizeErrorMessage(error instanceof Error ? error.message : error)
        if (message === 'TICKET_SHORTAGE') {
          setResult({ id: makeId(), status: 'error', error: 'トークン不足' })
          setStatusMessage('トークン不足')
        } else {
          setResult({ id: makeId(), status: 'error', error: message })
          setStatusMessage(message)
          setErrorModalMessage(message)
        }
      } finally {
        if (runIdRef.current === runId) setIsRunning(false)
      }
    },
    [accessToken, fetchTickets, pollJob, submitVideo],
  )

  const handleGenerate = async () => {
    if (!sourcePayload || isRunning) return
    if (!sourceDurationSec || !Number.isFinite(sourceDurationSec)) {
      setStatusMessage('動画の長さを確認できませんでした。別の動画でお試しください。')
      return
    }
    if (sourceDurationSec > MAX_SOURCE_SECONDS) {
      setStatusMessage('素材動画は約10秒以内にしてください。')
      setErrorModalMessage('素材動画は約10秒以内にしてください。')
      return
    }
    if (!session) {
      setStatusMessage('Googleログインが必要です。')
      return
    }
    if (ticketStatus === 'loading') {
      setStatusMessage('トークン確認中...')
      return
    }
    if (accessToken) {
      setStatusMessage('トークン確認中...')
      const latestCount = await fetchTickets(accessToken)
      if (latestCount !== null && latestCount < VIDEO_TICKET_COST) {
        setShowTicketModal(true)
        return
      }
    } else if (ticketCount === null) {
      setStatusMessage('トークン確認中...')
      return
    } else if (ticketCount < VIDEO_TICKET_COST) {
      setShowTicketModal(true)
      return
    }
    await startGenerate(sourcePayload)
  }

  const handleGoogleSignIn = async () => {
    if (!supabase || !isAuthConfigured) {
      window.alert('Auth is not configured.')
      return
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
    })
    if (error) {
      window.alert(error.message)
      return
    }
    if (data?.url) {
      window.location.assign(data.url)
      return
    }
    window.alert('Failed to create OAuth URL.')
  }

  const clearVideo = useCallback(() => {
    if (sourcePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(sourcePreview)
    }
    setSourcePreview(null)
    setSourcePayload(null)
    setSourceName('')
    setSourceDurationSec(null)
    setPreviewWidth(16)
    setPreviewHeight(9)
    setStatusMessage('')
    setStep(0)
  }, [sourcePreview])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (sourcePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(sourcePreview)
    }

    const objectUrl = URL.createObjectURL(file)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      const duration = Number(probe.duration)
      if (!Number.isFinite(duration) || duration <= 0) {
        URL.revokeObjectURL(objectUrl)
        setSourcePreview(null)
        setSourcePayload(null)
        setSourceName('')
        setSourceDurationSec(null)
        setErrorModalMessage('動画の長さを取得できませんでした。別の動画をお試しください。')
        return
      }
      if (duration > MAX_SOURCE_SECONDS) {
        URL.revokeObjectURL(objectUrl)
        setSourcePreview(null)
        setSourcePayload(null)
        setSourceName('')
        setSourceDurationSec(null)
        setErrorModalMessage('素材動画は約10秒以内にしてください。')
        setStatusMessage('素材動画は約10秒以内にしてください。')
        return
      }
      if (probe.videoWidth > 0 && probe.videoHeight > 0) {
        setPreviewWidth(probe.videoWidth)
        setPreviewHeight(probe.videoHeight)
      }
      setSourceDurationSec(duration)
      setSourcePreview(objectUrl)
      setSourceName(file.name)
      setStatusMessage(session ? '動画アップロードOK' : 'Googleログインが必要です。')

      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = String(reader.result || '')
        setSourcePayload(toBase64(dataUrl))
      }
      reader.onerror = () => {
        setSourcePayload(null)
        setErrorModalMessage('動画の読み込みに失敗しました。')
      }
      reader.readAsDataURL(file)
    }
    probe.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setSourcePreview(null)
      setSourcePayload(null)
      setSourceName('')
      setSourceDurationSec(null)
      setErrorModalMessage('動画メタデータの読み込みに失敗しました。')
    }
    probe.src = objectUrl
  }

  const isGif = displayVideo?.startsWith('data:image/gif')
  const canDownload = Boolean(displayVideo && !isGif)

  const handleDownload = useCallback(async () => {
    if (!displayVideo) return
    const baseName = sourceName ? sourceName.replace(/\.[^.]+$/, '') : 'mmaudio-video'
    const ext = isGif ? 'gif' : 'mp4'
    const filename = `${baseName}-sfx.${ext}`
    try {
      let blob: Blob
      if (displayVideo.startsWith('data:')) {
        blob = dataUrlToBlob(displayVideo, isGif ? 'image/gif' : 'video/mp4')
      } else if (displayVideo.startsWith('http') || displayVideo.startsWith('blob:')) {
        const response = await fetch(displayVideo)
        blob = await response.blob()
      } else {
        blob = base64ToBlob(displayVideo, isGif ? 'image/gif' : 'video/mp4')
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      window.location.assign(displayVideo)
    }
  }, [displayVideo, isGif, sourceName])

  if (!authReady) {
    return (
      <div className="camera-app">
        <TopNav />
        <div className="auth-boot" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="camera-app">
        <TopNav />
        <GuestIntro mode="video" onSignIn={handleGoogleSignIn} />
      </div>
    )
  }

  return (
    <div className="camera-app">
      <TopNav />
      <div className="wizard-shell">
        <section className="wizard-panel wizard-panel--inputs">
          <div className="wizard-card wizard-card--step">
            <div className="wizard-stepper">
              <div className="wizard-stepper__meta">
                <span>{`ステップ ${step + 1} / ${totalSteps}`}</span>
                <div className="wizard-dots">
                  {Array.from({ length: totalSteps }).map((_, index) => (
                    <span key={`sfx-step-${index}`} className={`wizard-dot${index <= step ? ' is-active' : ''}`} />
                  ))}
                </div>
              </div>
              <div className="wizard-status">
                {ticketStatus === 'loading' && 'トークン確認中...'}
                {ticketStatus !== 'loading' && `トークン: ${ticketCount ?? 0}`}
                {ticketStatus === 'error' && ticketMessage ? ` / ${ticketMessage}` : ''}
              </div>
              <h2>{stepTitles[step]}</h2>
            </div>

            {step === 0 && (
              <div className="wizard-section">
                <label className="upload-box">
                  <input type="file" accept="video/*" onChange={handleFileChange} />
                  <div>
                    <strong>{sourceName || '動画を選択'}</strong>
                    <span>動画をアップロードして次へ進んでください。</span>
                  </div>
                </label>
                {sourcePreview && (
                  <div className="preview-card">
                    <button type="button" className="preview-card__remove" onClick={clearVideo} aria-label="Remove video">
                      x
                    </button>
                    <video src={sourcePreview} controls muted playsInline preload="metadata" />
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <label className="wizard-field">
                <span>効果音プロンプト</span>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例: 雨音、遠くで雷、足音を追加"
                />
              </label>
            )}

            {step === 2 && (
              <div className="wizard-summary">
                <div>
                  <p>入力動画</p>
                  <strong>{sourceName || '-'}</strong>
                </div>
                <div>
                  <p>長さ</p>
                  <strong>{sourceDurationSec ? `${sourceDurationSec.toFixed(2)}秒` : '-'}</strong>
                </div>
                <div>
                  <p>効果音プロンプト</p>
                  <strong>{prompt || '-'}</strong>
                </div>
              </div>
            )}

            <div className="wizard-actions">
              {step > 0 && (
                <button type="button" className="ghost-button" onClick={() => setStep((prev) => Math.max(prev - 1, 0))}>
                  戻る
                </button>
              )}
              {step === 0 && (
                <button type="button" className="primary-button" onClick={() => setStep(1)} disabled={!canAdvanceVideo}>
                  次へ
                </button>
              )}
              {step === 1 && (
                <button type="button" className="primary-button" onClick={() => setStep(2)} disabled={!canAdvancePrompt}>
                  次へ
                </button>
              )}
              {step === 2 && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleGenerate}
                  disabled={!sourcePayload || !prompt.trim() || isRunning || !session}
                >
                  {isRunning ? '生成中...' : '効果音付き動画を生成'}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="wizard-panel wizard-panel--preview">
          <div className="wizard-card wizard-card--preview">
            <div className="wizard-card__header">
              <div>
                <p className="wizard-eyebrow">プレビュー</p>
                {statusMessage && !isRunning && <span>{statusMessage}</span>}
              </div>
              {canDownload && (
                <button type="button" className="ghost-button" onClick={handleDownload}>
                  ダウンロード
                </button>
              )}
            </div>

            <div className="stage-viewer" style={viewerStyle}>
              <div className="viewer-progress" aria-hidden="true" />
              {isRunning ? (
                <div className="loading-display" role="status" aria-live="polite">
                  <div className="loading-orb" aria-hidden="true" />
                  <span className="loading-blink">生成中...</span>
                  <p>処理が完了するまでお待ちください。</p>
                </div>
              ) : displayVideo ? (
                isGif ? (
                  <img src={displayVideo} alt="Result" />
                ) : (
                  <video controls src={displayVideo} />
                )
              ) : (
                <div className="stage-placeholder">{sourcePayload ? 'まだ結果がありません。' : '動画をアップロードしてください。'}</div>
              )}
            </div>
          </div>
        </section>
      </div>

      {showTicketModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>トークン不足</h3>
            <p>この処理は 1 トークン消費します。購入ページへ移動しますか？</p>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setShowTicketModal(false)}>
                閉じる
              </button>
              <button type="button" className="primary-button" onClick={() => navigate('/purchase')}>
                トークン購入
              </button>
            </div>
          </div>
        </div>
      )}

      {errorModalMessage && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>エラー</h3>
            <p>{errorModalMessage}</p>
            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={() => setErrorModalMessage(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
