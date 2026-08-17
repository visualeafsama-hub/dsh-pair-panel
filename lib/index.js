/**
 * pair-panel host half: serves GET /pair-panel/snapshot with the live
 * agentbridge pair state, the codex thread rollout tail, and the DSH
 * session context pressure from the token meter.
 * Pure display layer: reads state files and the token meter, never writes.
 */
const STATE_DIR = '/.local/state/agentbridge/pairs'
const CODEX_SESSIONS = '/.codex/sessions'

const lastSize = new Map()
const lastLines = new Map()
const rolloutCache = new Map()
const windowCache = new Map()
let scanBudget = 2000

function parseJson(text) {
  try { return JSON.parse(text) } catch { return null }
}

async function safeRead(ctx, p) {
  try {
    const fs = ctx.get('fs')
    if (!fs) return null
    const target = await fs.resolve(p)
    return { target, text: await fs.readText(target) }
  } catch { return null }
}

async function safeStat(ctx, p) {
  try {
    const fs = ctx.get('fs')
    if (!fs) return null
    const target = await fs.resolve(p)
    return await fs.stat(target)
  } catch { return null }
}

async function safeList(ctx, p) {
  try {
    const fs = ctx.get('fs')
    if (!fs) return []
    const target = await fs.resolve(p)
    return await fs.listDir(target)
  } catch { return [] }
}

function homeOf(cwd) {
  if (typeof cwd !== 'string' || !cwd.startsWith('/')) return undefined
  const parts = cwd.split('/').filter(Boolean)
  if (parts.length < 2) return undefined
  return '/' + parts[0] + '/' + parts[1]
}

async function deriveHome(ctx, session) {
  let home = session && session.meta ? homeOf(session.meta.cwd) : undefined
  if (!home) {
    try {
      const ws = ctx.get('workspaceRegistry')
      const list = ws && typeof ws.list === 'function' ? ws.list() : []
      const w = list.find((x) => x && typeof x.path === 'string')
      home = w ? homeOf(w.path) : undefined
    } catch {}
  }
  return home
}

async function findPair(ctx, home) {
  const root = home + STATE_DIR
  const entries = await safeList(ctx, root)
  let best = null
  let bestT = -1
  for (const e of entries) {
    const name = e && typeof e.name === 'string' ? e.name : ''
    if (!name) continue
    const dir = root + '/' + name
    const ct = await safeRead(ctx, dir + '/current-thread.json')
    if (!ct) continue
    const meta = parseJson(ct.text)
    if (!meta) continue
    let t = 0
    try { t = new Date(meta.updatedAt || 0).getTime() } catch {}
    const stat = await safeStat(ctx, dir + '/current-thread.json')
    if (stat && typeof stat.mtimeMs === 'number' && stat.mtimeMs > t) t = stat.mtimeMs
    if (t <= bestT) continue
    const dm = await safeRead(ctx, dir + '/daemon.json')
    const daemon = dm ? parseJson(dm.text) : null
    best = {
      name: meta.pairName || name,
      threadId: meta.threadId || null,
      cwd: meta.cwd || null,
      status: meta.status || null,
      phase: daemon && daemon.phase ? daemon.phase : null,
      turn: daemon ? !!daemon.turnInProgress : null,
      rolloutPath: meta.rolloutPath || null,
      updatedAt: meta.updatedAt || null,
    }
    bestT = t
  }
  return best
}

async function scanRollouts(ctx, dir, threadId, depth) {
  if (depth > 3 || scanBudget <= 0) return []
  const out = []
  const entries = await safeList(ctx, dir)
  for (const e of entries) {
    const name = e && typeof e.name === 'string' ? e.name : ''
    if (!name) continue
    scanBudget -= 1
    const p = dir + '/' + name
    if (name.startsWith('rollout-') && name.endsWith('.jsonl') && name.indexOf(threadId) >= 0) {
      const st = await safeStat(ctx, p)
      out.push({ p, m: st && typeof st.mtimeMs === 'number' ? st.mtimeMs : 0 })
    } else {
      out.push(...await scanRollouts(ctx, p, threadId, depth + 1))
    }
  }
  return out
}

async function findRollout(ctx, home, threadId) {
  if (!threadId) return null
  const cached = rolloutCache.get(threadId)
  if (cached) {
    const st = await safeStat(ctx, cached)
    if (st) return cached
    rolloutCache.delete(threadId)
  }
  scanBudget = 2000
  const found = await scanRollouts(ctx, home + CODEX_SESSIONS, threadId, 0)
  found.sort((a, b) => b.m - a.m)
  if (found.length > 0) {
    const p = found[0].p
    rolloutCache.set(threadId, p)
    return p
  }
  return null
}

async function tailLines(ctx, p, maxLines) {
  const st = await safeStat(ctx, p)
  const size = st && typeof st.size === 'number' ? st.size : -1
  const prev = lastSize.get(p)
  if (prev === size && lastLines.has(p)) return lastLines.get(p)
  lastSize.set(p, size)
  const lines = []
  try {
    const fs = ctx.get('fs')
    if (!fs) return lines
    const target = await fs.resolve(p)
    const iter = await fs.streamText(target)
    let carry = ''
    for await (const chunk of iter) {
      const text = carry + chunk
      const parts = text.split('\n')
      carry = parts.pop() || ''
      for (const part of parts) {
        if (part.trim()) lines.push(part)
      }
      if (lines.length > maxLines * 2) lines.splice(0, lines.length - maxLines)
    }
    if (carry.trim()) lines.push(carry)
    if (lines.length > maxLines) lines.splice(0, lines.length - maxLines)
  } catch {}
  lastLines.set(p, lines)
  return lines
}

function parseRecord(line) {
  const obj = parseJson(line)
  if (!obj) return null
  const ts = typeof obj.timestamp === 'string' ? obj.timestamp : null
  const t = obj.type
  const p = obj.payload && typeof obj.payload === 'object' ? obj.payload : {}
  if (t === 'response_item' && p.type === 'message') {
    let text = ''
    if (Array.isArray(p.content)) {
      for (const c of p.content) {
        if (c && typeof c.text === 'string') text += c.text
      }
    }
    return { ts, kind: 'message', role: p.role === 'user' ? 'user' : p.role === 'assistant' ? 'assistant' : 'other', text: text.slice(0, 600) }
  }
  if (t === 'event_msg') {
    if (p.type === 'agent_message') {
      return { ts, kind: 'message', role: 'assistant', text: String(p.message || '').slice(0, 600) }
    }
    if (p.type === 'user_message') {
      return { ts, kind: 'message', role: 'user', text: String(p.message || '').slice(0, 600) }
    }
    if (p.type === 'token_count') {
      const info = p.info || {}
      // total_token_usage accumulates across every API call of the process;
      // last_token_usage is the current request's context usage.
      const usage = info.last_token_usage || info.total_token_usage || {}
      return {
        ts, kind: 'tokens',
        tokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : null,
        window: typeof info.model_context_window === 'number' ? info.model_context_window : null,
      }
    }
    if (p.type === 'function_call') {
      return { ts, kind: 'tool', name: String(p.name || '').slice(0, 80), text: String(p.arguments || '').slice(0, 300) }
    }
    if (p.type === 'function_call_output') {
      return { ts, kind: 'tool-out', text: String(p.output || '').slice(0, 300) }
    }
    if (p.type === 'task_complete') {
      return { ts, kind: 'task', text: String(p.last_agent_message || '').slice(0, 200) }
    }
  }
  return null
}

function dshContext(ctx, session) {
  try {
    if (!session) return null
    const meter = ctx.get('tokenMeter')
    if (!meter) return null
    const m = meter.measure(session)
    return {
      pressure: typeof m.totalTokens === 'number' ? m.totalTokens : null,
      surface: typeof m.surfaceTokens === 'number' ? m.surfaceTokens : null,
    }
  } catch { return null }
}

async function contextWindow(ctx) {
  try {
    const adm = ctx.get('agentDefaultModel')
    if (!adm) return null
    const sel = adm.currentSelection()
    if (!sel || !sel.provider || !sel.model) return null
    const key = sel.provider + '/' + sel.model
    const cached = windowCache.get(key)
    if (cached && Date.now() - cached.at < 300000) return cached.window
    const llm = ctx.get('llm')
    if (!llm) return null
    const info = await llm.resolveModelInfo(sel.provider, sel.model)
    const window = info && info.context && typeof info.context.contextWindow === 'number' ? info.context.contextWindow : null
    windowCache.set(key, { window, at: Date.now() })
    return window
  } catch { return null }
}

function resolveSession(ctx, sessionId) {
  try {
    if (sessionId) {
      const sessions = ctx.get('sessions')
      if (sessions && typeof sessions.get === 'function') {
        const s = sessions.get(String(sessionId))
        if (s) return s
      }
    }
    const agents = ctx.get('agents')
    if (agents && typeof agents.currentInitiator === 'function') {
      const agent = agents.currentInitiator()
      if (agent && agent.session) return agent.session
    }
    return undefined
  } catch { return undefined }
}

async function snapshot(ctx, sessionId) {
  const session = resolveSession(ctx, sessionId)
  const home = await deriveHome(ctx, session)
  if (!home) return { ok: false, error: 'cannot derive home from session or workspace' }
  const pair = await findPair(ctx, home)
  if (!pair) return { ok: false, error: 'no agentbridge pair state found under ' + home + STATE_DIR }
  let rollout = pair.rolloutPath
  if (!rollout) rollout = await findRollout(ctx, home, pair.threadId)
  const feed = []
  let codexTokens = null
  let codexWindow = null
  if (rollout) {
    const lines = await tailLines(ctx, rollout, 80)
    // Codex rollouts record each message twice: once as response_item and
    // once as event_msg (user_message / agent_message), and task_complete
    // repeats last_agent_message a third time. Dedupe by (kind, text) within
    // a small lookback window so the feed shows each message once.
    const seen = []
    for (const line of lines) {
      const r = parseRecord(line)
      if (!r) continue
      if (r.kind === 'tokens') {
        if (r.tokens !== null) codexTokens = r.tokens
        if (r.window !== null) codexWindow = r.window
        continue
      }
      const text = r.text || null
      let dup = false
      for (let i = Math.max(0, seen.length - 4); i < seen.length; i++) {
        if (seen[i].kind === r.kind && seen[i].text === text) { dup = true; break }
      }
      // task_complete repeats the turn's last agent message, but the task
      // text is truncated to 200 chars while the message is truncated to
      // 600 — an exact-equality check misses it. Compare as prefixes, and
      // search the recent window (tool/tool-out records may sit between
      // the message and the task).
      if (!dup && r.kind === 'task' && text && seen.length) {
        for (let i = Math.max(0, seen.length - 4); i < seen.length; i++) {
          const s = seen[i]
          if (s.kind === 'message' && s.text &&
              (s.text.startsWith(text) || text.startsWith(s.text))) { dup = true; break }
        }
      }
      if (dup) continue
      seen.push({ ts: r.ts, kind: r.kind, role: r.role || null, name: r.name || null, text })
      feed.push(seen[seen.length - 1])
    }
  }
  const dsh = dshContext(ctx, session)
  let window = null
  if (dsh) window = await contextWindow(ctx)
  return {
    ok: true,
    at: Date.now(),
    pair: {
      name: pair.name,
      threadId: pair.threadId,
      phase: pair.phase,
      turn: pair.turn,
      status: pair.status,
      updatedAt: pair.updatedAt,
    },
    codex: { tokens: codexTokens, window: codexWindow },
    dsh: dsh ? { pressure: dsh.pressure, surface: dsh.surface, window } : null,
    feed: feed.slice(-60),
  }
}

/** Service required before the snapshot route can be registered. */
export const inject = ["webServer"]

/** The agentbridge MCP adapter is only alive when the harness was launched
 * via `abg dsh`; a plain `dsh web` boot leaves this port dead. */
const ABG_MCP_URL = 'http://127.0.0.1:8765/mcp'

async function abgActive() {
  try {
    const r = await fetch(ABG_MCP_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
      signal: AbortSignal.timeout(800),
    })
    return true
  } catch {
    return false
  }
}

// Push wake-up: agentbridge posts here when codex sends a message while no
// send_message call is waiting. We locate the live root agent of this DSH
// session and followup() its inbox so the agent is actually woken up by the
// codex reply (real push), not by get_messages polling.
const notifyDedup = new Map()
async function pushNotify(ctx, payload) {
  const id = typeof payload?.id === 'string' ? payload.id : ''
  if (id) {
    const last = notifyDedup.get(id)
    if (last && Date.now() - last < 15000) return
    notifyDedup.set(id, Date.now())
  }
  const content = typeof payload?.content === 'string' && payload.content.trim() ? payload.content.trim() : ''
  if (!content) return
  const agents = ctx.get('agents')
  if (!agents) return
  const roots = typeof agents.roots === 'function' ? agents.roots() : []
  if (!roots.length) return
  const agent = roots[0]
  if (typeof agent.followup !== 'function') return
  try {
    // Must go through createUserMessage: DSH messages need a `source.kind`
    // tag; a bare {role,content} object crashes the loop with
    // "Cannot read properties of undefined (reading 'kind')".
    const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
    const message = createUserMessage({
      content: [{ type: 'text', text: `【Codex 对端消息】（agentbridge 推送，id=${id || '-'}）：\n${content.slice(0, 2000)}` }],
      source: { kind: 'plugin', plugin: 'ui-pair-panel' },
    })
    agent.followup(message)
  } catch (e) {
    // agent may be mid-turn; followup queues, that is fine
  }
}

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (!webServer) return
  webServer.register({
    kind: 'exact',
    path: '/agentbridge/notify',
    handler: async (req, res) => {
      let payload = null
      try {
        let body = ''
        for await (const chunk of req) body += chunk
        payload = body ? JSON.parse(body) : null
      } catch {}
      if (payload) await pushNotify(ctx, payload)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    },
  })
  webServer.register({
    kind: 'exact',
    path: '/pair-panel/snapshot',
    handler: async (req, res) => {
      const url = req.url || ''
      const q = url.indexOf('?') >= 0 ? url.slice(url.indexOf('?') + 1) : ''
      let sessionId = ''
      for (const part of q.split('&')) {
        if (part.startsWith('session=')) {
          try { sessionId = decodeURIComponent(part.slice(8)) } catch { sessionId = '' }
        }
      }
      let data
      try {
        const mode = await abgActive()
        if (!mode) {
          data = { ok: false, mode: 'plain', error: 'agentbridge MCP not reachable (plain dsh web boot)' }
        } else {
          data = await snapshot(ctx, sessionId)
          data.mode = 'abg'
        }
      } catch (e) {
        data = { ok: false, error: String((e && e.message) || e) }
      }
      const body = JSON.stringify(data)
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end(body)
    },
  })
}
