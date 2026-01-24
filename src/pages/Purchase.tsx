import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isAuthConfigured, supabase } from '../lib/supabaseClient'
import { PURCHASE_PLANS } from '../lib/purchasePlans'
import { TopNav } from '../components/TopNav'
import './camera.css'

const OAUTH_REDIRECT_URL =
  import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? (typeof window !== 'undefined' ? window.location.origin : undefined)

export function Purchase() {
  const [session, setSession] = useState<Session | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [authMessage, setAuthMessage] = useState('')
  const [ticketCount, setTicketCount] = useState<number | null>(null)
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [ticketMessage, setTicketMessage] = useState('')
  const [purchaseStatus, setPurchaseStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [purchaseMessage, setPurchaseMessage] = useState('')

  const accessToken = session?.access_token ?? ''

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthStatus('idle')
      setAuthMessage('')
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
        setAuthStatus('error')
        setAuthMessage(error.message)
        return
      }
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      url.searchParams.delete('state')
      window.history.replaceState({}, document.title, url.toString())
    })
  }, [])

  const fetchTickets = useCallback(async (token: string) => {
    if (!token) return
    setTicketStatus('loading')
    setTicketMessage('')
    const res = await fetch('/api/tickets', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setTicketStatus('error')
      setTicketMessage(data?.error || 'チケット情報の取得に失敗しました。')
      setTicketCount(null)
      return
    }
    setTicketStatus('idle')
    setTicketMessage('')
    setTicketCount(Number(data?.tickets ?? 0))
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

  const handleGoogleSignIn = async () => {
    if (!supabase || !isAuthConfigured) {
      setAuthStatus('error')
      setAuthMessage('認証の設定が未完了です。')
      return
    }
    setAuthStatus('loading')
    setAuthMessage('')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
    })
    if (error) {
      setAuthStatus('error')
      setAuthMessage(error.message)
      return
    }
    if (data?.url) {
      window.location.assign(data.url)
      return
    }
    setAuthStatus('error')
    setAuthMessage('認証URLを取得できませんでした。')
  }

  const handleSignOut = async () => {
    if (!supabase) return
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (error) {
      setAuthStatus('error')
      setAuthMessage(error instanceof Error ? error.message : 'ログアウトに失敗しました。')
    }
  }

  const handleCheckout = async (priceId: string) => {
    if (!session || !accessToken) {
      setPurchaseStatus('error')
      setPurchaseMessage('購入にはログインが必要です。')
      return
    }
    setPurchaseStatus('loading')
    setPurchaseMessage('決済ページへ移動します…')
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ price_id: priceId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.url) {
      setPurchaseStatus('error')
      setPurchaseMessage(data?.error || '決済ページの作成に失敗しました。')
      return
    }
    window.location.assign(data.url)
  }

  return (
    <div className="camera-app purchase-app">
      <TopNav />
      <header className="camera-hero">
        <div>
          <p className="camera-hero__eyebrow">YAJU AI</p>
          <h1>チケット購入</h1>
          <p className="camera-hero__lede">必要な枚数だけ、いつでも追加できます。</p>
        </div>
        <div className="camera-hero__badge">
          <span>安全決済</span>
          <strong>Stripe Checkout</strong>
        </div>
      </header>

      <div className="purchase-shell">
        <section className="purchase-panel">
          <div className="panel-header">
            <div className="panel-title">
              <h2>アカウント</h2>
              <span>{session ? 'ログイン中' : 'ログインしてください。'}</span>
            </div>
            <div className="panel-auth">
              {session ? (
                <div className="auth-status">
                  <span className="auth-email">{session.user?.email ?? 'ログイン中'}</span>
                  <button type="button" className="ghost-button" onClick={handleSignOut}>
                    ログアウト
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleGoogleSignIn}
                  disabled={authStatus === 'loading'}
                >
                  {authStatus === 'loading' ? '接続中…' : 'Googleで新規登録 / ログイン'}
                </button>
              )}
            </div>
          </div>
          {authMessage && <div className="auth-message">{authMessage}</div>}
          {session && (
            <div className="ticket-message">
              {ticketStatus === 'loading' && 'チケット確認中…'}
              {ticketStatus !== 'loading' && `残りチケット: ${ticketCount ?? 0}`}
              {ticketStatus === 'error' && ticketMessage ? ` / ${ticketMessage}` : ''}
            </div>
          )}
        </section>

        <section className="purchase-panel">
          <div className="panel-header">
            <div className="panel-title">
              <h2>プラン</h2>
              <span>必要な分だけ購入できます。</span>
            </div>
          </div>
          <div className="plan-grid">
            {PURCHASE_PLANS.map((plan) => (
              <div key={plan.id} className="plan-card">
                <div>
                  <div className="plan-label">{plan.label}</div>
                  <div className="plan-tickets">{plan.tickets}枚</div>
                </div>
                <div className="plan-price">¥{plan.price.toLocaleString()}</div>
                <button
                  type="button"
                  className="plan-action"
                  onClick={() => handleCheckout(plan.priceId)}
                  disabled={!session || purchaseStatus === 'loading'}
                >
                  購入
                </button>
              </div>
            ))}
          </div>
          {purchaseMessage && <div className="purchase-message">{purchaseMessage}</div>}
        </section>
      </div>
    </div>
  )
}
