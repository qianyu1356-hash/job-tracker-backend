import { createServer } from 'node:http'
import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const PORT = Number(process.env.PORT || 3001)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

const STATUS_VALUES = ['submitted', 'screening', 'assessment', 'interviewing', 'rejected', 'offered']
const JOB_TYPE_VALUES = ['daily_intern', 'summer_intern', 'winter_intern', 'autumn_recruit', 'spring_recruit']
const ASSESSMENT_STATUS_VALUES = ['pending', 'done', 'expired']
const INTERVIEW_STATUS_VALUES = ['upcoming', 'done', 'abandoned']
const INTERVIEW_FORMAT_VALUES = ['online_feishu', 'online_dingtalk', 'online_tencent', 'online_zoom', 'offline']
const MESSAGE_TYPE_VALUES = ['assessment', 'interview', 'status_change', 'apply']

function nowIso() {
  return new Date().toISOString()
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex')
}

function verifyPassword(password, salt, passwordHash) {
  const left = Buffer.from(hashPassword(password, salt), 'hex')
  const right = Buffer.from(String(passwordHash || ''), 'hex')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function getSeedDb() {
  const now = Date.now()
  return {
    settings: {
      goal: 'This month goal: get 2 offers',
      jobSeekingStatus: 'intern_seeking',
      profile: {
        name: 'Student',
        phone: '',
        school: '',
        major: '',
        graduationYear: '2026',
        email: '',
      },
    },
    resumes: [
      {
        id: 'r1',
        name: 'General_Resume_v1.pdf',
        tags: ['frontend'],
        description: 'General purpose resume',
        fileUrl: '',
        fileSize: 245000,
        isDefault: true,
        createdAt: nowIso(),
      },
    ],
    materialCategories: [
      { key: 'degree', label: '学历证明', isPreset: true, createdAt: nowIso() },
      { key: 'transcript', label: '成绩单', isPreset: true, createdAt: nowIso() },
      { key: 'internship', label: '实习证明', isPreset: true, createdAt: nowIso() },
      { key: 'award', label: '获奖证书', isPreset: true, createdAt: nowIso() },
      { key: 'portfolio', label: '作品集', isPreset: true, createdAt: nowIso() },
    ],
    materials: [
      {
        id: 'mat_1',
        name: '瀛︾睄璇佹槑.pdf',
        category: 'degree',
        size: 245000,
        type: 'pdf',
        note: '',
        fileUrl: '',
        createdAt: nowIso(),
      },
      {
        id: 'mat_2',
        name: '成绩单.jpg',
        category: 'transcript',
        size: 512000,
        type: 'image',
        note: '',
        fileUrl: '',
        createdAt: nowIso(),
      },
    ],
    applications: [
      {
        id: 'app_1',
        company: 'ByteDance',
        position: 'Frontend Intern',
        city: 'Beijing',
        jobType: 'daily_intern',
        applyDate: '2026-04-15',
        channel: 'BOSS',
        link: 'https://jobs.bytedance.com',
        resumeId: 'r1',
        jd: 'Build frontend systems and internal tools.',
        note: 'Priority company',
        status: 'assessment',
        createdAt: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'app_2',
        company: 'Tencent',
        position: 'Product Intern',
        city: 'Shenzhen',
        jobType: 'summer_intern',
        applyDate: '2026-04-14',
        channel: 'Official website',
        link: '',
        resumeId: 'r1',
        jd: '',
        note: '',
        status: 'interviewing',
        createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'app_3',
        company: 'NetEase',
        position: 'Game Planner Intern',
        city: 'Guangzhou',
        jobType: 'daily_intern',
        applyDate: '2026-04-11',
        channel: 'Referral',
        link: '',
        resumeId: 'r1',
        jd: '',
        note: '',
        status: 'offered',
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    assessments: [
      {
        id: 'as_1',
        applicationId: 'app_1',
        name: 'Online Test',
        platform: 'Beisen',
        link: '',
        deadline: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        note: '',
        createdAt: nowIso(),
      },
    ],
    interviews: [
      {
        id: 'in_1',
        applicationId: 'app_2',
        round: 'Round 1',
        datetime: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        format: 'online_feishu',
        location: 'Feishu Meeting',
        interviewer: 'Manager A',
        status: 'upcoming',
        review: {},
        note: '',
        createdAt: nowIso(),
      },
    ],
    messages: [
      {
        id: 'msg_1',
        type: 'assessment',
        title: 'Assessment Reminder 路 ByteDance',
        description: 'Online Test deadline is approaching',
        isRead: false,
        targetUrl: '/assessments',
        createdAt: nowIso(),
      },
    ],
    todos: [
      {
        id: 'todo_1',
        content: 'Prepare for ByteDance interview',
        done: false,
        createdAt: nowIso(),
      },
    ],
  }
}

function getEmptyUserData(name = '') {
  return {
    settings: {
      goal: '',
      jobSeekingStatus: 'intern_seeking',
      profile: {
        name,
        phone: '',
        school: '',
        major: '',
        graduationYear: '2026',
        email: '',
      },
    },
    resumes: [],
    materialCategories: [
      { key: 'degree', label: '学历证明', isPreset: true, createdAt: nowIso() },
      { key: 'transcript', label: '成绩单', isPreset: true, createdAt: nowIso() },
      { key: 'internship', label: '实习证明', isPreset: true, createdAt: nowIso() },
      { key: 'award', label: '获奖证书', isPreset: true, createdAt: nowIso() },
      { key: 'portfolio', label: '作品集', isPreset: true, createdAt: nowIso() },
    ],
    materials: [],
    applications: [],
    assessments: [],
    interviews: [],
    messages: [],
    todos: [],
  }
}

async function ensureDbFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await stat(DB_FILE)
  } catch {
    await writeFile(DB_FILE, JSON.stringify(getSeedDb(), null, 2), 'utf8')
  }
}

async function readDb() {
  const raw = await readFile(DB_FILE, 'utf8')
  const sanitized = raw.replace(/^\uFEFF/, '')
  const db = JSON.parse(sanitized)
  return normalizeDb(db)
}

async function writeDb(db) {
  const tmp = `${DB_FILE}.tmp`
  await writeFile(tmp, JSON.stringify(db, null, 2), 'utf8')
  await rename(tmp, DB_FILE)
}

function normalizeDb(db) {
  const normalizeUserDb = (value) => {
    const normalized = {
      settings: value.settings || {
        goal: '',
        jobSeekingStatus: 'intern_seeking',
        profile: { name: '', phone: '', school: '', major: '', graduationYear: '2026', email: '' },
      },
      resumes: Array.isArray(value.resumes) ? value.resumes : [],
      materialCategories: Array.isArray(value.materialCategories) ? value.materialCategories : [],
      materials: Array.isArray(value.materials) ? value.materials : [],
      applications: Array.isArray(value.applications) ? value.applications : [],
      assessments: Array.isArray(value.assessments) ? value.assessments : [],
      interviews: Array.isArray(value.interviews) ? value.interviews : [],
      messages: Array.isArray(value.messages) ? value.messages : [],
      todos: Array.isArray(value.todos) ? value.todos : [],
    }

    const now = Date.now()
    normalized.assessments = normalized.assessments.map((item) => {
      if (item.status === 'pending' && new Date(item.deadline).getTime() < now) {
        return { ...item, status: 'expired' }
      }
      return item
    })
    normalized.interviews = normalized.interviews.map((item) => {
      if (item.status === 'upcoming' && new Date(item.datetime).getTime() < now) {
        return { ...item, status: 'done' }
      }
      return item
    })

    if (normalized.materialCategories.length === 0) {
      normalized.materialCategories = [
        { key: 'degree', label: '学历证明', isPreset: true, createdAt: nowIso() },
        { key: 'transcript', label: '成绩单', isPreset: true, createdAt: nowIso() },
        { key: 'internship', label: '实习证明', isPreset: true, createdAt: nowIso() },
        { key: 'award', label: '获奖证书', isPreset: true, createdAt: nowIso() },
        { key: 'portfolio', label: '作品集', isPreset: true, createdAt: nowIso() },
      ]
    }

    for (const app of normalized.applications) {
      reconcileApplicationStatus(normalized, app.id)
    }
    return normalized
  }

  if (db && db.users && db.sessions && db.userDataByUserId) {
    const normalizedRoot = {
      users: Array.isArray(db.users)
        ? db.users
            .filter((u) => u && u.id && u.username && u.passwordHash && u.salt)
            .map((u) => ({
              id: String(u.id),
              username: String(u.username).toLowerCase(),
              name: String(u.name || ''),
              passwordHash: String(u.passwordHash),
              salt: String(u.salt),
              createdAt: u.createdAt || nowIso(),
            }))
        : [],
      sessions: Array.isArray(db.sessions)
        ? db.sessions
            .filter((s) => s && s.token && s.userId)
            .map((s) => ({
              token: String(s.token),
              userId: String(s.userId),
              createdAt: s.createdAt || nowIso(),
              lastSeenAt: s.lastSeenAt || nowIso(),
            }))
        : [],
      userDataByUserId: {},
    }

    for (const [userId, userData] of Object.entries(db.userDataByUserId || {})) {
      normalizedRoot.userDataByUserId[userId] = normalizeUserDb(userData || {})
    }
    return normalizedRoot
  }

  const legacyData = normalizeUserDb(db || {})
  const salt = randomUUID().replace(/-/g, '')
  const legacyUser = {
    id: 'u_legacy_admin',
    username: 'admin',
    name: String(legacyData.settings?.profile?.name || '管理员'),
    salt,
    passwordHash: scryptSync('admin123456', salt, 64).toString('hex'),
    createdAt: nowIso(),
  }

  return {
    users: [legacyUser],
    sessions: [],
    userDataByUserId: {
      [legacyUser.id]: legacyData,
    },
  }
}

function getUserDb(rootDb, userId) {
  if (!rootDb.userDataByUserId[userId]) {
    rootDb.userDataByUserId[userId] = getEmptyUserData()
  }
  return rootDb.userDataByUserId[userId]
}

function sanitizeUser(user) {
  return { id: user.id, username: user.username, name: user.name || '' }
}

function getBearerToken(req) {
  const auth = String(req.headers.authorization || '')
  const [scheme, token] = auth.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return ''
  return token.trim()
}

function requireAuth(req, rootDb) {
  const token = getBearerToken(req)
  if (!token) return null
  const session = rootDb.sessions.find((s) => s.token === token)
  if (!session) return null
  const user = rootDb.users.find((u) => u.id === session.userId)
  if (!user) return null
  return { user, token }
}

function unauthorized(res) {
  sendJson(res, 401, { error: 'Unauthorized' })
}

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS })
  res.end(JSON.stringify(payload))
}

function sendNoContent(res) {
  res.writeHead(204, CORS_HEADERS)
  res.end()
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'))
      }
    })
    req.on('end', () => {
      if (!body) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON payload'))
      }
    })
    req.on('error', reject)
  })
}

function badRequest(res, message) {
  sendJson(res, 400, { error: message })
}

function notFound(res, message = 'Not found') {
  sendJson(res, 404, { error: message })
}

function ensureEnum(value, allowed, fieldName) {
  if (value === undefined) return null
  if (!allowed.includes(value)) return `${fieldName} is invalid`
  return null
}

function appendMessage(db, { type, title, description, targetUrl }) {
  db.messages.unshift({
    id: randomUUID(),
    type,
    title,
    description,
    isRead: false,
    targetUrl,
    createdAt: nowIso(),
  })
  if (db.messages.length > 200) db.messages = db.messages.slice(0, 200)
}

function detectMaterialType(name) {
  const lower = String(name || '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) return 'image'
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'word'
  return 'other'
}

function getMaterialCategoryWithCount(db) {
  const countMap = {}
  for (const item of db.materials) {
    countMap[item.category] = (countMap[item.category] || 0) + 1
  }
  return db.materialCategories.map((c) => ({
    ...c,
    count: countMap[c.key] || 0,
  }))
}

function hydrateApplications(db) {
  const assessmentsByApp = new Map()
  const interviewsByApp = new Map()

  for (const item of db.assessments) {
    if (!assessmentsByApp.has(item.applicationId)) assessmentsByApp.set(item.applicationId, [])
    assessmentsByApp.get(item.applicationId).push(item)
  }
  for (const item of db.interviews) {
    if (!interviewsByApp.has(item.applicationId)) interviewsByApp.set(item.applicationId, [])
    interviewsByApp.get(item.applicationId).push(item)
  }

  return db.applications.map((app) => ({
    ...app,
    assessments: (assessmentsByApp.get(app.id) || []).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)),
    interviews: (interviewsByApp.get(app.id) || []).sort((a, b) => new Date(a.datetime) - new Date(b.datetime)),
  }))
}

function reconcileApplicationStatus(db, applicationId) {
  const app = db.applications.find((item) => item.id === applicationId)
  if (!app) return
  if (app.status === 'offered' || app.status === 'rejected') return

  const hasUpcomingInterview = db.interviews.some(
    (item) => item.applicationId === applicationId && item.status === 'upcoming',
  )
  if (hasUpcomingInterview) {
    app.status = 'interviewing'
    return
  }

  const hasPendingAssessment = db.assessments.some(
    (item) => item.applicationId === applicationId && item.status === 'pending',
  )
  if (hasPendingAssessment) {
    app.status = 'assessment'
    return
  }

  if (app.status === 'interviewing' || app.status === 'assessment') {
    app.status = 'screening'
  }
}

function getDashboardSummary(db) {
  const today = new Date()
  const yyyyMmDd = today.toISOString().slice(0, 10)
  const hydrated = hydrateApplications(db)

  const stats = {
    total: db.applications.length,
    assessment: db.applications.filter((a) => a.status === 'assessment').length,
    interviewing: db.applications.filter((a) => a.status === 'interviewing').length,
    offered: db.applications.filter((a) => a.status === 'offered').length,
  }

  const todayTasks = []
  for (const app of hydrated) {
    for (const a of app.assessments) {
      if (a.status === 'pending' && a.deadline.slice(0, 10) === yyyyMmDd) {
        todayTasks.push({ type: 'assessment', applicationId: app.id, app, data: a, datetime: a.deadline })
      }
    }
    for (const i of app.interviews) {
      if (i.status === 'upcoming' && i.datetime.slice(0, 10) === yyyyMmDd) {
        todayTasks.push({ type: 'interview', applicationId: app.id, app, data: i, datetime: i.datetime })
      }
    }
  }
  todayTasks.sort((a, b) => new Date(a.datetime) - new Date(b.datetime))

  const recentMessages = [...db.messages]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4)

  const trend = {}
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const key = date.toISOString().slice(0, 10)
    trend[key] = 0
  }
  for (const app of db.applications) {
    if (trend[app.applyDate] !== undefined) trend[app.applyDate] += 1
  }
  const trend30 = Object.entries(trend).map(([date, count]) => ({ date, count }))
  const trend7 = trend30.slice(-7)

  const jobTypeDistributionMap = {}
  for (const app of db.applications) {
    jobTypeDistributionMap[app.jobType] = (jobTypeDistributionMap[app.jobType] || 0) + 1
  }
  const jobTypeDistribution = Object.entries(jobTypeDistributionMap).map(([jobType, count]) => ({ jobType, count }))

  return { stats, todayTasks: todayTasks.slice(0, 5), recentMessages, trend7, trend30, jobTypeDistribution }
}

function matchPath(pathname, pattern) {
  const pathParts = pathname.split('/').filter(Boolean)
  const patternParts = pattern.split('/').filter(Boolean)
  if (pathParts.length !== patternParts.length) return null
  const params = {}
  for (let i = 0; i < patternParts.length; i += 1) {
    const p = patternParts[i]
    const v = pathParts[i]
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(v)
    } else if (p !== v) {
      return null
    }
  }
  return params
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      sendNoContent(res)
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const { pathname, searchParams } = url

    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { status: 'ok', service: 'job-tracker-backend', time: nowIso() })
      return
    }

    if (pathname === '/api/meta/enums' && req.method === 'GET') {
      sendJson(res, 200, {
        status: STATUS_VALUES,
        jobType: JOB_TYPE_VALUES,
        assessmentStatus: ASSESSMENT_STATUS_VALUES,
        interviewStatus: INTERVIEW_STATUS_VALUES,
        interviewFormat: INTERVIEW_FORMAT_VALUES,
        messageType: MESSAGE_TYPE_VALUES,
      })
      return
    }

    const rootDb = await readDb()

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await parseBody(req)
      const username = String(body.username || '').trim().toLowerCase()
      const password = String(body.password || '')
      const name = String(body.name || '').trim()
      if (!username || !password) {
        badRequest(res, 'username and password are required')
        return
      }
      if (username.length < 3 || username.length > 32) {
        badRequest(res, 'username length should be 3-32')
        return
      }
      if (password.length < 6) {
        badRequest(res, 'password length should be >= 6')
        return
      }
      if (rootDb.users.some((u) => u.username === username)) {
        badRequest(res, 'username already exists')
        return
      }

      const userId = randomUUID()
      const salt = randomUUID().replace(/-/g, '')
      const user = {
        id: userId,
        username,
        name,
        salt,
        passwordHash: hashPassword(password, salt),
        createdAt: nowIso(),
      }
      rootDb.users.push(user)
      rootDb.userDataByUserId[userId] = getEmptyUserData(name || username)

      const token = randomUUID()
      rootDb.sessions.push({
        token,
        userId: user.id,
        createdAt: nowIso(),
        lastSeenAt: nowIso(),
      })
      await writeDb(rootDb)
      sendJson(res, 201, { token, user: sanitizeUser(user) })
      return
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseBody(req)
      const username = String(body.username || '').trim().toLowerCase()
      const password = String(body.password || '')
      if (!username || !password) {
        badRequest(res, 'username and password are required')
        return
      }
      const user = rootDb.users.find((u) => u.username === username)
      if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
        sendJson(res, 401, { error: 'Invalid username or password' })
        return
      }

      const token = randomUUID()
      rootDb.sessions.push({
        token,
        userId: user.id,
        createdAt: nowIso(),
        lastSeenAt: nowIso(),
      })
      await writeDb(rootDb)
      sendJson(res, 200, { token, user: sanitizeUser(user) })
      return
    }

    const auth = requireAuth(req, rootDb)
    if (!auth) {
      unauthorized(res)
      return
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const session = rootDb.sessions.find((s) => s.token === auth.token)
      if (session) {
        session.lastSeenAt = nowIso()
        await writeDb(rootDb)
      }
      sendJson(res, 200, { user: sanitizeUser(auth.user) })
      return
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      rootDb.sessions = rootDb.sessions.filter((s) => s.token !== auth.token)
      await writeDb(rootDb)
      sendJson(res, 200, { ok: true })
      return
    }

    const db = getUserDb(rootDb, auth.user.id)

    if (pathname === '/api/dashboard/summary' && req.method === 'GET') {
      sendJson(res, 200, getDashboardSummary(db))
      return
    }

    if (pathname === '/api/applications' && req.method === 'GET') {
      const status = searchParams.get('status') || ''
      const search = (searchParams.get('search') || '').toLowerCase().trim()
      const city = (searchParams.get('city') || '').toLowerCase().trim()
      const jobType = searchParams.get('jobType') || ''
      const hydrated = hydrateApplications(db)
      const list = hydrated
        .filter((app) => {
          if (status && app.status !== status) return false
          if (jobType && app.jobType !== jobType) return false
          if (city && (app.city || '').toLowerCase() !== city) return false
          if (search && !`${app.company} ${app.position}`.toLowerCase().includes(search)) return false
          return true
        })
        .sort((a, b) => new Date(b.applyDate) - new Date(a.applyDate))
      sendJson(res, 200, { items: list, total: list.length })
      return
    }

    if (pathname === '/api/applications' && req.method === 'POST') {
      const body = await parseBody(req)
      if (!body.company || !body.position || !body.jobType || !body.applyDate) {
        badRequest(res, 'company, position, jobType, applyDate are required')
        return
      }
      const enumError = ensureEnum(body.jobType, JOB_TYPE_VALUES, 'jobType') || ensureEnum(body.status || 'submitted', STATUS_VALUES, 'status')
      if (enumError) {
        badRequest(res, enumError)
        return
      }

      const item = {
        id: randomUUID(),
        company: String(body.company).trim(),
        position: String(body.position).trim(),
        city: body.city ? String(body.city).trim() : '',
        jobType: body.jobType,
        applyDate: String(body.applyDate),
        channel: body.channel ? String(body.channel).trim() : '',
        link: body.link ? String(body.link).trim() : '',
        resumeId: body.resumeId || '',
        jd: body.jd ? String(body.jd) : '',
        note: body.note ? String(body.note) : '',
        status: body.status || 'submitted',
        createdAt: nowIso(),
      }
      db.applications.push(item)
      appendMessage(db, {
        type: 'apply',
        title: `Application Added 路 ${item.company}`,
        description: `${item.company} - ${item.position}`,
        targetUrl: '/applications',
      })
      await writeDb(rootDb)
      sendJson(res, 201, item)
      return
    }

    const appById = matchPath(pathname, '/api/applications/:id')
    if (appById && req.method === 'GET') {
      const hydrated = hydrateApplications(db)
      const item = hydrated.find((a) => a.id === appById.id)
      if (!item) {
        notFound(res, 'Application not found')
        return
      }
      sendJson(res, 200, item)
      return
    }

    if (appById && req.method === 'PATCH') {
      const body = await parseBody(req)
      const idx = db.applications.findIndex((a) => a.id === appById.id)
      if (idx < 0) {
        notFound(res, 'Application not found')
        return
      }
      if (body.status !== undefined) {
        const err = ensureEnum(body.status, STATUS_VALUES, 'status')
        if (err) {
          badRequest(res, err)
          return
        }
      }
      if (body.jobType !== undefined) {
        const err = ensureEnum(body.jobType, JOB_TYPE_VALUES, 'jobType')
        if (err) {
          badRequest(res, err)
          return
        }
      }

      const before = db.applications[idx]
      db.applications[idx] = { ...before, ...body }
      const after = db.applications[idx]
      if (body.status && body.status !== before.status) {
        appendMessage(db, {
          type: 'status_change',
          title: `Status Updated 路 ${after.company}`,
          description: `${after.position}: ${before.status} -> ${after.status}`,
          targetUrl: '/applications',
        })
      }
      await writeDb(rootDb)
      sendJson(res, 200, after)
      return
    }

    const appStatus = matchPath(pathname, '/api/applications/:id/status')
    if (appStatus && req.method === 'PATCH') {
      const body = await parseBody(req)
      const err = ensureEnum(body.status, STATUS_VALUES, 'status')
      if (err) {
        badRequest(res, err)
        return
      }
      const idx = db.applications.findIndex((a) => a.id === appStatus.id)
      if (idx < 0) {
        notFound(res, 'Application not found')
        return
      }
      const oldStatus = db.applications[idx].status
      db.applications[idx].status = body.status
      if (oldStatus !== body.status) {
        appendMessage(db, {
          type: 'status_change',
          title: `Status Updated 路 ${db.applications[idx].company}`,
          description: `${db.applications[idx].position}: ${oldStatus} -> ${body.status}`,
          targetUrl: '/applications',
        })
      }
      await writeDb(rootDb)
      sendJson(res, 200, db.applications[idx])
      return
    }

    if (appById && req.method === 'DELETE') {
      const app = db.applications.find((a) => a.id === appById.id)
      if (!app) {
        notFound(res, 'Application not found')
        return
      }
      db.applications = db.applications.filter((a) => a.id !== appById.id)
      db.assessments = db.assessments.filter((a) => a.applicationId !== appById.id)
      db.interviews = db.interviews.filter((i) => i.applicationId !== appById.id)
      await writeDb(rootDb)
      sendNoContent(res)
      return
    }

    if (pathname === '/api/assessments' && req.method === 'GET') {
      const status = searchParams.get('status') || ''
      const search = (searchParams.get('search') || '').toLowerCase().trim()
      const deadline = searchParams.get('deadline') || ''
      const applicationId = searchParams.get('applicationId') || ''
      const now = new Date()

      const byApp = new Map(db.applications.map((a) => [a.id, a]))
      const items = db.assessments
        .filter((item) => {
          if (status && item.status !== status) return false
          if (applicationId && item.applicationId !== applicationId) return false
          if (search) {
            const app = byApp.get(item.applicationId)
            const text = `${item.name} ${item.platform || ''} ${app?.company || ''} ${app?.position || ''}`.toLowerCase()
            if (!text.includes(search)) return false
          }
          if (deadline) {
            const due = new Date(item.deadline)
            const dueDay = item.deadline.slice(0, 10)
            const today = now.toISOString().slice(0, 10)
            const diffDays = Math.floor((new Date(dueDay).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
            if (deadline === 'today' && dueDay !== today) return false
            if (deadline === '3days' && diffDays > 3) return false
            if (deadline === 'week' && diffDays > 7) return false
          }
          return true
        })
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
        .map((assessment) => ({ assessment, application: byApp.get(assessment.applicationId) || null }))
      sendJson(res, 200, { items, total: items.length })
      return
    }

    if (pathname === '/api/assessments' && req.method === 'POST') {
      const body = await parseBody(req)
      if (!body.applicationId || !body.name || !body.deadline) {
        badRequest(res, 'applicationId, name, deadline are required')
        return
      }
      const app = db.applications.find((a) => a.id === body.applicationId)
      if (!app) {
        badRequest(res, 'applicationId does not exist')
        return
      }

      const status = body.status || 'pending'
      const enumError = ensureEnum(status, ASSESSMENT_STATUS_VALUES, 'status')
      if (enumError) {
        badRequest(res, enumError)
        return
      }

      const item = {
        id: randomUUID(),
        applicationId: body.applicationId,
        name: String(body.name).trim(),
        platform: body.platform ? String(body.platform).trim() : '',
        link: body.link ? String(body.link).trim() : '',
        deadline: String(body.deadline),
        status,
        note: body.note ? String(body.note) : '',
        createdAt: nowIso(),
      }
      db.assessments.push(item)

      if (['submitted', 'screening'].includes(app.status)) app.status = 'assessment'
      appendMessage(db, {
        type: 'assessment',
        title: `Assessment Added 路 ${app.company}`,
        description: `${item.name} deadline: ${item.deadline}`,
        targetUrl: '/assessments',
      })
      await writeDb(rootDb)
      sendJson(res, 201, item)
      return
    }

    const assessmentById = matchPath(pathname, '/api/assessments/:id')
    if (assessmentById && req.method === 'PATCH') {
      const body = await parseBody(req)
      if (body.status !== undefined) {
        const err = ensureEnum(body.status, ASSESSMENT_STATUS_VALUES, 'status')
        if (err) {
          badRequest(res, err)
          return
        }
      }
      const idx = db.assessments.findIndex((a) => a.id === assessmentById.id)
      if (idx < 0) {
        notFound(res, 'Assessment not found')
        return
      }
      db.assessments[idx] = { ...db.assessments[idx], ...body }
      reconcileApplicationStatus(db, db.assessments[idx].applicationId)
      await writeDb(rootDb)
      sendJson(res, 200, db.assessments[idx])
      return
    }

    const assessmentDone = matchPath(pathname, '/api/assessments/:id/done')
    if (assessmentDone && req.method === 'PATCH') {
      const idx = db.assessments.findIndex((a) => a.id === assessmentDone.id)
      if (idx < 0) {
        notFound(res, 'Assessment not found')
        return
      }
      db.assessments[idx].status = 'done'
      reconcileApplicationStatus(db, db.assessments[idx].applicationId)
      await writeDb(rootDb)
      sendJson(res, 200, db.assessments[idx])
      return
    }

    if (assessmentById && req.method === 'DELETE') {
      const idx = db.assessments.findIndex((a) => a.id === assessmentById.id)
      if (idx < 0) {
        notFound(res, 'Assessment not found')
        return
      }
      const deleted = db.assessments[idx]
      db.assessments.splice(idx, 1)
      reconcileApplicationStatus(db, deleted.applicationId)
      await writeDb(rootDb)
      sendNoContent(res)
      return
    }

    if (pathname === '/api/interviews' && req.method === 'GET') {
      const status = searchParams.get('status') || ''
      const search = (searchParams.get('search') || '').toLowerCase().trim()
      const round = (searchParams.get('round') || '').toLowerCase().trim()
      const applicationId = searchParams.get('applicationId') || ''
      const byApp = new Map(db.applications.map((a) => [a.id, a]))

      const items = db.interviews
        .filter((item) => {
          if (status && item.status !== status) return false
          if (applicationId && item.applicationId !== applicationId) return false
          if (round && (item.round || '').toLowerCase() !== round) return false
          if (search) {
            const app = byApp.get(item.applicationId)
            const text = `${item.round} ${item.interviewer || ''} ${app?.company || ''} ${app?.position || ''}`.toLowerCase()
            if (!text.includes(search)) return false
          }
          return true
        })
        .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
        .map((interview) => ({ interview, application: byApp.get(interview.applicationId) || null }))
      sendJson(res, 200, { items, total: items.length })
      return
    }

    if (pathname === '/api/interviews' && req.method === 'POST') {
      const body = await parseBody(req)
      if (!body.applicationId || !body.round || !body.datetime) {
        badRequest(res, 'applicationId, round, datetime are required')
        return
      }
      const app = db.applications.find((a) => a.id === body.applicationId)
      if (!app) {
        badRequest(res, 'applicationId does not exist')
        return
      }
      const status = body.status || 'upcoming'
      const err = ensureEnum(status, INTERVIEW_STATUS_VALUES, 'status') || ensureEnum(body.format, INTERVIEW_FORMAT_VALUES, 'format')
      if (err) {
        badRequest(res, err)
        return
      }

      const item = {
        id: randomUUID(),
        applicationId: body.applicationId,
        round: String(body.round).trim(),
        datetime: String(body.datetime),
        format: body.format || '',
        location: body.location ? String(body.location).trim() : '',
        interviewer: body.interviewer ? String(body.interviewer).trim() : '',
        status,
        review: body.review || {},
        note: body.note ? String(body.note) : '',
        createdAt: nowIso(),
      }
      db.interviews.push(item)
      if (!['offered', 'rejected'].includes(app.status)) app.status = 'interviewing'
      appendMessage(db, {
        type: 'interview',
        title: `Interview Added 路 ${app.company}`,
        description: `${item.round} at ${item.datetime}`,
        targetUrl: '/interviews',
      })
      await writeDb(rootDb)
      sendJson(res, 201, item)
      return
    }

    const interviewById = matchPath(pathname, '/api/interviews/:id')
    if (interviewById && req.method === 'PATCH') {
      const body = await parseBody(req)
      if (body.status !== undefined) {
        const err = ensureEnum(body.status, INTERVIEW_STATUS_VALUES, 'status')
        if (err) {
          badRequest(res, err)
          return
        }
      }
      if (body.format !== undefined) {
        const err = ensureEnum(body.format, INTERVIEW_FORMAT_VALUES, 'format')
        if (err) {
          badRequest(res, err)
          return
        }
      }
      const idx = db.interviews.findIndex((i) => i.id === interviewById.id)
      if (idx < 0) {
        notFound(res, 'Interview not found')
        return
      }
      db.interviews[idx] = { ...db.interviews[idx], ...body }
      reconcileApplicationStatus(db, db.interviews[idx].applicationId)
      await writeDb(rootDb)
      sendJson(res, 200, db.interviews[idx])
      return
    }

    if (interviewById && req.method === 'DELETE') {
      const idx = db.interviews.findIndex((i) => i.id === interviewById.id)
      if (idx < 0) {
        notFound(res, 'Interview not found')
        return
      }
      const deleted = db.interviews[idx]
      db.interviews.splice(idx, 1)
      reconcileApplicationStatus(db, deleted.applicationId)
      await writeDb(rootDb)
      sendNoContent(res)
      return
    }

    if (pathname === '/api/messages' && req.method === 'GET') {
      const type = searchParams.get('type') || ''
      const unread = searchParams.get('unread')
      let items = [...db.messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      if (type) items = items.filter((m) => m.type === type)
      if (unread === '1') items = items.filter((m) => !m.isRead)
      sendJson(res, 200, { items, total: items.length })
      return
    }

    const messageRead = matchPath(pathname, '/api/messages/:id/read')
    if (messageRead && req.method === 'PATCH') {
      const idx = db.messages.findIndex((m) => m.id === messageRead.id)
      if (idx < 0) {
        notFound(res, 'Message not found')
        return
      }
      db.messages[idx].isRead = true
      await writeDb(rootDb)
      sendJson(res, 200, db.messages[idx])
      return
    }

    if (pathname === '/api/messages/read-all' && req.method === 'PATCH') {
      db.messages = db.messages.map((m) => ({ ...m, isRead: true }))
      await writeDb(rootDb)
      sendJson(res, 200, { ok: true })
      return
    }

    const messageById = matchPath(pathname, '/api/messages/:id')
    if (messageById && req.method === 'DELETE') {
      const idx = db.messages.findIndex((m) => m.id === messageById.id)
      if (idx < 0) {
        notFound(res, 'Message not found')
        return
      }
      db.messages.splice(idx, 1)
      await writeDb(rootDb)
      sendNoContent(res)
      return
    }

    if (pathname === '/api/messages' && req.method === 'DELETE') {
      db.messages = []
      await writeDb(rootDb)
      sendNoContent(res)
      return
    }

    if (pathname === '/api/material-categories' && req.method === 'GET') {
      const items = getMaterialCategoryWithCount(db)
      sendJson(res, 200, { items, total: items.length })
      return
    }

    if (pathname === '/api/material-categories' && req.method === 'POST') {
      const body = await parseBody(req)
      const label = String(body.label || '').trim()
      if (!label) {
        badRequest(res, 'label is required')
        return
      }
      const normalizedKey = String(body.key || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || randomUUID().slice(0, 8)
      if (db.materialCategories.some((c) => c.key === normalizedKey)) {
        badRequest(res, 'category key already exists')
        return
      }
      const item = {
        key: normalizedKey,
        label,
        isPreset: false,
        createdAt: nowIso(),
      }
      db.materialCategories.push(item)
      await writeDb(rootDb)
      sendJson(res, 201, item)
      return
    }

    const materialCategoryByKey = matchPath(pathname, '/api/material-categories/:key')
    if (materialCategoryByKey && req.method === 'DELETE') {
      const idx = db.materialCategories.findIndex((c) => c.key === materialCategoryByKey.key)
      if (idx < 0) {
        notFound(res, 'Category not found')
        return
      }
      const target = db.materialCategories[idx]
      if (target.isPreset) {
        badRequest(res, 'preset category cannot be deleted')
        return
      }
      const used = db.materials.some((m) => m.category === target.key)
      if (used) {
        badRequest(res, 'category is in use by materials')
        return
      }
      db.materialCategories.splice(idx, 1)
      await writeDb(rootDb)
      sendNoContent(res)
      return
    }

    if (pathname === '/api/materials' && req.method === 'GET') {
      const search = (searchParams.get('search') || '').toLowerCase().trim()
      const category = (searchParams.get('category') || '').trim()
      const items = [...db.materials]
        .filter((m) => {
          if (category && m.category !== category) return false
          if (search && !String(m.name || '').toLowerCase().includes(search)) return false
          return true
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      sendJson(res, 200, { items, total: items.length })
      return
    }

    if (pathname === '/api/materials' && req.method === 'POST') {
      const body = await parseBody(req)
      const name = String(body.name || '').trim()
      const category = String(body.category || '').trim()
      if (!name || !category) {
        badRequest(res, 'name and category are required')
        return
      }
      if (!db.materialCategories.some((c) => c.key === category)) {
        badRequest(res, 'category does not exist')
        return
      }
      const item = {
        id: randomUUID(),
        name,
        category,
        size: Number(body.size || 0),
        type: body.type || detectMaterialType(name),
        note: body.note ? String(body.note) : '',
        fileUrl: body.fileUrl ? String(body.fileUrl) : '',
        createdAt: nowIso(),
      }
      db.materials.unshift(item)
      await writeDb(rootDb)
      sendJson(res, 201, item)
      return
    }

    const materialById = matchPath(pathname, '/api/materials/:id')
    if (materialById && req.method === 'PATCH') {
      const body = await parseBody(req)
      const idx = db.materials.findIndex((m) => m.id === materialById.id)
      if (idx < 0) {
        notFound(res, 'Material not found')
        return
      }
      if (body.category && !db.materialCategories.some((c) => c.key === body.category)) {
        badRequest(res, 'category does not exist')
        return
      }
      db.materials[idx] = { ...db.materials[idx], ...body }
      await writeDb(rootDb)
      sendJson(res, 200, db.materials[idx])
      return
    }

    if (materialById && req.method === 'DELETE') {
      const idx = db.materials.findIndex((m) => m.id === materialById.id)
      if (idx < 0) {
        notFound(res, 'Material not found')
        return
      }
      db.materials.splice(idx, 1)
      await writeDb(rootDb)
      sendNoContent(res)
      return
    }

    if (pathname === '/api/resumes' && req.method === 'GET') {
      sendJson(res, 200, { items: db.resumes, total: db.resumes.length })
      return
    }

    if (pathname === '/api/resumes' && req.method === 'POST') {
      const body = await parseBody(req)
      if (!body.name || !String(body.name).trim()) {
        badRequest(res, 'name is required')
        return
      }
      const item = {
        id: randomUUID(),
        name: String(body.name).trim(),
        tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t)).slice(0, 10) : [],
        description: body.description ? String(body.description) : '',
        fileUrl: body.fileUrl ? String(body.fileUrl) : '',
        fileSize: Number(body.fileSize || 0),
        isDefault: !!body.isDefault,
        createdAt: nowIso(),
      }

      if (item.isDefault || db.resumes.length === 0) {
        db.resumes = db.resumes.map((r) => ({ ...r, isDefault: false }))
        item.isDefault = true
      }
      db.resumes.unshift(item)
      await writeDb(rootDb)
      sendJson(res, 201, item)
      return
    }

    const resumeById = matchPath(pathname, '/api/resumes/:id')
    if (resumeById && req.method === 'PATCH') {
      const body = await parseBody(req)
      const idx = db.resumes.findIndex((r) => r.id === resumeById.id)
      if (idx < 0) {
        notFound(res, 'Resume not found')
        return
      }
      const before = db.resumes[idx]
      db.resumes[idx] = {
        ...before,
        ...body,
        tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t)).slice(0, 10) : before.tags,
      }
      await writeDb(rootDb)
      sendJson(res, 200, db.resumes[idx])
      return
    }

    if (resumeById && req.method === 'DELETE') {
      const idx = db.resumes.findIndex((r) => r.id === resumeById.id)
      if (idx < 0) {
        notFound(res, 'Resume not found')
        return
      }
      const deleting = db.resumes[idx]
      db.resumes.splice(idx, 1)
      if (deleting.isDefault && db.resumes.length > 0) {
        db.resumes[0].isDefault = true
      }
      await writeDb(rootDb)
      sendNoContent(res)
      return
    }

    const resumeDefault = matchPath(pathname, '/api/resumes/:id/default')
    if (resumeDefault && req.method === 'PATCH') {
      const idx = db.resumes.findIndex((r) => r.id === resumeDefault.id)
      if (idx < 0) {
        notFound(res, 'Resume not found')
        return
      }
      db.resumes = db.resumes.map((r) => ({ ...r, isDefault: r.id === resumeDefault.id }))
      await writeDb(rootDb)
      sendJson(res, 200, db.resumes[idx])
      return
    }

    if (pathname === '/api/home/goal' && req.method === 'GET') {
      sendJson(res, 200, { goal: db.settings.goal || '' })
      return
    }

    if (pathname === '/api/home/goal' && req.method === 'PATCH') {
      const body = await parseBody(req)
      db.settings.goal = body.goal ? String(body.goal) : ''
      await writeDb(rootDb)
      sendJson(res, 200, { goal: db.settings.goal })
      return
    }

    if (pathname === '/api/todos' && req.method === 'GET') {
      const items = [...db.todos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      sendJson(res, 200, { items, total: items.length })
      return
    }

    if (pathname === '/api/todos' && req.method === 'POST') {
      const body = await parseBody(req)
      if (!body.content || !String(body.content).trim()) {
        badRequest(res, 'content is required')
        return
      }
      const item = {
        id: randomUUID(),
        content: String(body.content).trim(),
        done: false,
        createdAt: nowIso(),
      }
      db.todos.unshift(item)
      await writeDb(rootDb)
      sendJson(res, 201, item)
      return
    }

    const todoById = matchPath(pathname, '/api/todos/:id')
    if (todoById && req.method === 'PATCH') {
      const body = await parseBody(req)
      const idx = db.todos.findIndex((t) => t.id === todoById.id)
      if (idx < 0) {
        notFound(res, 'Todo not found')
        return
      }
      db.todos[idx] = { ...db.todos[idx], ...body }
      await writeDb(rootDb)
      sendJson(res, 200, db.todos[idx])
      return
    }

    if (todoById && req.method === 'DELETE') {
      const idx = db.todos.findIndex((t) => t.id === todoById.id)
      if (idx < 0) {
        notFound(res, 'Todo not found')
        return
      }
      db.todos.splice(idx, 1)
      await writeDb(rootDb)
      sendNoContent(res)
      return
    }

    if (pathname === '/api/settings/profile' && req.method === 'GET') {
      sendJson(res, 200, db.settings.profile || {})
      return
    }

    if (pathname === '/api/settings/profile' && req.method === 'PATCH') {
      const body = await parseBody(req)
      db.settings.profile = { ...db.settings.profile, ...body }
      await writeDb(rootDb)
      sendJson(res, 200, db.settings.profile)
      return
    }

    if (pathname === '/api/settings/job-status' && req.method === 'GET') {
      sendJson(res, 200, { jobSeekingStatus: db.settings.jobSeekingStatus || 'intern_seeking' })
      return
    }

    if (pathname === '/api/settings/job-status' && req.method === 'PATCH') {
      const body = await parseBody(req)
      db.settings.jobSeekingStatus = body.jobSeekingStatus || 'intern_seeking'
      await writeDb(rootDb)
      sendJson(res, 200, { jobSeekingStatus: db.settings.jobSeekingStatus })
      return
    }

    notFound(res)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    sendJson(res, 500, { error: message })
  }
})

await ensureDbFile()
server.listen(PORT, () => {
  console.log(`job-tracker-backend listening on http://localhost:${PORT}`)
})

