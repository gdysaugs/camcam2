import { createClient, type User } from '@supabase/supabase-js'
import { buildCorsHeaders, isCorsBlocked } from '../_shared/cors'

type Env = {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

const corsMethods = 'POST, OPTIONS'

const INTERNAL_SERVER_ERROR_MESSAGE = '\u30b5\u30fc\u30d0\u30fc\u5185\u90e8\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002'

const jsonResponse = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })

const extractBearerToken = (request: Request) => {
  const header = request.headers.get('Authorization') || ''
  const match = header.match(/Bearer\s+(.+)/i)
  return match ? match[1] : ''
}

const getSupabaseAdmin = (env: Env) => {
  const url = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const isGoogleUser = (user: User) => {
  if (user.app_metadata?.provider === 'google') return true
  if (Array.isArray(user.identities)) {
    return user.identities.some((identity) => identity.provider === 'google')
  }
  return false
}

const requireGoogleUser = async (request: Request, env: Env, corsHeaders: HeadersInit) => {
  const token = extractBearerToken(request)
  if (!token) {
    return { response: jsonResponse({ error: '繝ｭ繧ｰ繧､繝ｳ縺悟ｿ・ｦ√〒縺吶・ }, 401, corsHeaders) }
  }
  const admin = getSupabaseAdmin(env)
  if (!admin) {
    return {
      response: jsonResponse(
        { error: 'SUPABASE_URL 縺ｾ縺溘・ SUPABASE_SERVICE_ROLE_KEY 縺瑚ｨｭ螳壹＆繧後※縺・∪縺帙ｓ縲・ },
        500,
        corsHeaders,
      ),
    }
  }
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) {
    return { response: jsonResponse({ error: '隱崎ｨｼ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・ }, 401, corsHeaders) }
  }
  if (!isGoogleUser(data.user)) {
    return { response: jsonResponse({ error: 'Google繝ｭ繧ｰ繧､繝ｳ縺ｮ縺ｿ蟇ｾ蠢懊＠縺ｦ縺・∪縺吶・ }, 403, corsHeaders) }
  }
  return { admin, user: data.user }
}

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  const corsHeaders = buildCorsHeaders(request, env, corsMethods)
  if (isCorsBlocked(request, env)) {
    return new Response(null, { status: 403, headers: corsHeaders })
  }
  return new Response(null, { headers: corsHeaders })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const corsHeaders = buildCorsHeaders(request, env, corsMethods)
  if (isCorsBlocked(request, env)) {
    return new Response(null, { status: 403, headers: corsHeaders })
  }

  const auth = await requireGoogleUser(request, env, corsHeaders)
  if ('response' in auth) {
    return auth.response
  }

  const email = auth.user.email ?? ''
  const { data, error } = await auth.admin.rpc('claim_daily_bonus', {
    p_user_id: auth.user.id,
    p_email: email,
  })

  if (error) {
    return jsonResponse({ error: INTERNAL_SERVER_ERROR_MESSAGE }, 500, corsHeaders)
  }

  const result = Array.isArray(data) ? data[0] : data
  return jsonResponse(
    {
      granted: Boolean(result?.granted),
      next_eligible_at: result?.next_eligible_at ?? null,
      reason: result?.reason ?? null,
    },
    200,
    corsHeaders,
  )
}



