import sql from './db';
import type { GameSession, Message, WorldState, Player, User, Campaign, SessionSummary, SessionFeedback } from '@/types';
import crypto from 'crypto';

let schemaInitialized = false;

export async function ensureSchema() {
  if (!schemaInitialized) {
    await initializeSchema();
    schemaInitialized = true;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonOf(v: unknown): any {
  return JSON.parse(JSON.stringify(v));
}

export async function initializeSchema() {
  // Users table must be created first (game_sessions references it)
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email          VARCHAR(254) UNIQUE NOT NULL,
      password_hash  VARCHAR(72) NOT NULL,
      role           VARCHAR(20) NOT NULL DEFAULT 'user',
      email_verified BOOLEAN NOT NULL DEFAULT false,
      verify_token   VARCHAR(64),
      verify_expires TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(verify_token)
  `;
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token   VARCHAR(64)
  `;
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)
  `;

  // Waiting-list access control (ANT-108).
  // Migration is intentionally three-step so existing accounts are NOT locked out:
  // 1) add column nullable, 2) backfill pre-existing rows to 'approved', then
  // 3) set DEFAULT 'pending' + NOT NULL so only NEW signups land on the waiting list.
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS access_status VARCHAR(20)
  `;
  await sql`
    UPDATE users SET access_status = 'approved' WHERE access_status IS NULL
  `;
  await sql`
    ALTER TABLE users ALTER COLUMN access_status SET DEFAULT 'pending'
  `;
  await sql`
    ALTER TABLE users ALTER COLUMN access_status SET NOT NULL
  `;
  // Admins are always approved regardless of when they were created.
  await sql`
    UPDATE users SET access_status = 'approved' WHERE role = 'admin' AND access_status <> 'approved'
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_access_status ON users(access_status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scenario_id VARCHAR(100) NOT NULL,
      name VARCHAR(200) NOT NULL,
      act INTEGER DEFAULT 1,
      status VARCHAR(20) DEFAULT 'active',
      world_state JSONB DEFAULT '{}',
      players JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      player_idx INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)
  `;

  // Migrations for existing tables
  await sql`
    ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS scenario_id VARCHAR(100) NOT NULL DEFAULT ''
  `;
  await sql`
    ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS world_state JSONB DEFAULT '{}'
  `;
  await sql`
    ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS players JSONB DEFAULT '[]'
  `;
  await sql`
    ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON game_sessions(user_id)
  `;

  // CHANGED: Add campaign_id, session_number, turn_queue, keeper_style to game_sessions
  await sql`
    ALTER TABLE game_sessions
      ADD COLUMN IF NOT EXISTS campaign_id UUID,
      ADD COLUMN IF NOT EXISTS session_number INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS current_turn_idx INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS turn_queue JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS keeper_style VARCHAR(20) DEFAULT 'balanced'
  `;

  await sql`
    ALTER TABLE game_sessions
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE game_sessions
      ADD COLUMN IF NOT EXISTS completion_trigger VARCHAR(20)
  `;
  await sql`
    ALTER TABLE game_sessions
      ADD COLUMN IF NOT EXISTS ended_early BOOLEAN DEFAULT false
  `;

  // CHANGED: New tables for campaign layer (phase 5)
  await sql`
    CREATE TABLE IF NOT EXISTS campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      scenario_id VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      world_state JSONB NOT NULL DEFAULT '{}',
      npc_states JSONB NOT NULL DEFAULT '{}',
      session_count INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS session_summaries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
      session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
      session_number INTEGER NOT NULL,
      summary TEXT NOT NULL,
      key_events JSONB DEFAULT '[]',
      npc_changes JSONB DEFAULT '{}',
      character_snapshots JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS session_feedback (
      session_id UUID PRIMARY KEY REFERENCES game_sessions(id) ON DELETE CASCADE,
      rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // CHANGED: New tables for asset management (phase 7)
  await sql`
    CREATE TABLE IF NOT EXISTS scenario_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scenario_id VARCHAR(100) NOT NULL,
      type VARCHAR(20) NOT NULL,
      location_id VARCHAR(100),
      npc_id VARCHAR(100),
      tags TEXT[] DEFAULT '{}',
      url TEXT NOT NULL,
      prompt TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
      scenario_id VARCHAR(100) NOT NULL,
      type VARCHAR(20) NOT NULL,
      tags TEXT[] DEFAULT '{}',
      url TEXT NOT NULL,
      prompt TEXT,
      scene_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // CHANGED: New table for API cost tracking (phase 8)
  await sql`
    CREATE TABLE IF NOT EXISTS api_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
      campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      provider VARCHAR(30) NOT NULL,
      type VARCHAR(20) NOT NULL,
      model VARCHAR(100) NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      characters INTEGER,
      image_count INTEGER,
      cost_usd DECIMAL(10,8) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Indexes for performance
  await sql`CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_api_usage_session_id ON api_usage(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at)`;
  await sql`ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS source VARCHAR(40) NOT NULL DEFAULT 'session'`;
  await sql`ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS anonymous_session_id VARCHAR(100)`;
  await sql`ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS scenario_id VARCHAR(100)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_api_usage_source ON api_usage(source)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_api_usage_anonymous_session ON api_usage(anonymous_session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_api_usage_scenario_id ON api_usage(scenario_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scenario_assets_scenario_id ON scenario_assets(scenario_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_campaign_assets_campaign_id ON campaign_assets(campaign_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_session_feedback_submitted_by_user_id ON session_feedback(submitted_by_user_id)`;

  // Language field for session language selection (uk/en)
  await sql`
    ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'uk'
  `;

  // Model pricing table — editable via admin API, fallback to hardcoded defaults
  await sql`
    CREATE TABLE IF NOT EXISTS model_pricing (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider   VARCHAR(30)   NOT NULL,
      model      VARCHAR(100)  NOT NULL,
      metric     VARCHAR(20)   NOT NULL,
      value_usd  DECIMAL(12,8) NOT NULL,
      updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (provider, model, metric)
    )
  `;

  // Seed default prices (won't overwrite existing rows)
  await sql`
    INSERT INTO model_pricing (provider, model, metric, value_usd) VALUES
      ('anthropic', 'claude-sonnet-4-6',          'inputPer1M',  3.00),
      ('anthropic', 'claude-sonnet-4-6',          'outputPer1M', 15.00),
      ('anthropic', 'claude-haiku-4-5-20251001',  'inputPer1M',  0.80),
      ('anthropic', 'claude-haiku-4-5-20251001',  'outputPer1M', 4.00),
      ('gemini',    'gemini-2.5-flash',            'inputPer1M',  0.30),
      ('gemini',    'gemini-2.5-flash',            'outputPer1M', 2.50),
      ('gemini',    'gemini-2.5-flash-preview-tts','inputPer1M',  0.50),
      ('gemini',    'gemini-2.5-flash-preview-tts','outputPer1M', 2.00),
      ('gemini',    'gemini-2.5-flash-image',      'perImage',    0.04),
      ('gemini',    'gemini-2.5-flash-image',      'inputPer1M',  0.30),
      ('deepseek',  'deepseek-v4-flash',           'inputPer1M',  0.14),
      ('deepseek',  'deepseek-v4-flash',           'outputPer1M', 0.28),
      ('openrouter','deepseek/deepseek-v4-flash',  'inputPer1M',  0.10),
      ('openrouter','deepseek/deepseek-v4-flash',  'outputPer1M', 0.20),
      ('openai',    'tts-1',                       'perChar',     0.000015),
      ('openai',    'whisper-1',                   'perMinute',   0.006),
      ('openai',    'dall-e-2',                    'perImage',    0.02)
    ON CONFLICT (provider, model, metric) DO NOTHING
  `;

  // Migrate Gemini TTS from perChar to token-based pricing (inputPer1M + outputPer1M)
  await sql`
    DELETE FROM model_pricing
    WHERE provider = 'gemini' AND model = 'gemini-2.5-flash-preview-tts' AND metric = 'perChar'
  `;

  // Per-message debug snapshot (admin-only) — input prompt + raw LLM output.
  // Populated fire-and-forget after each assistant message; only new messages
  // since this table existed have debug data (old messages return 404).
  await sql`
    CREATE TABLE IF NOT EXISTS message_debug (
      message_id    UUID PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
      prompt_blocks JSONB NOT NULL,
      raw_output    TEXT  NOT NULL,
      provider      VARCHAR(50),
      model         VARCHAR(100),
      input_tokens  INTEGER,
      output_tokens INTEGER,
      finish_reason VARCHAR(50),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Global app settings table (key/value)
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key        VARCHAR(100) PRIMARY KEY,
      value      TEXT         NOT NULL,
      updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS waitlist_entries (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         VARCHAR(254) UNIQUE NOT NULL,
      source        VARCHAR(80) NOT NULL DEFAULT 'unknown',
      locale        VARCHAR(12),
      outcome       VARCHAR(40),
      message_count INTEGER,
      notes         TEXT,
      user_agent    TEXT,
      invite_token  VARCHAR(64),
      invite_expires TIMESTAMPTZ,
      invited_at    TIMESTAMPTZ,
      last_invite_sent_at TIMESTAMPTZ,
      access_opened_at TIMESTAMPTZ,
      invite_locale VARCHAR(12),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64)`;
  await sql`ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS invite_expires TIMESTAMPTZ`;
  await sql`ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ`;
  await sql`ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS last_invite_sent_at TIMESTAMPTZ`;
  await sql`ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS access_opened_at TIMESTAMPTZ`;
  await sql`ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS invite_locale VARCHAR(12)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_waitlist_entries_source ON waitlist_entries(source)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_waitlist_entries_created_at ON waitlist_entries(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_waitlist_entries_invite_token ON waitlist_entries(invite_token)`;

  await sql`
    INSERT INTO app_settings (key, value) VALUES
      ('ai_provider',             'deepseek-base'),
      ('tts_provider',            'gemini'),
      ('daily_limit_enabled',     'true'),
      ('daily_user_cost_limit_usd','0.50')
    ON CONFLICT (key) DO NOTHING
  `;
}

// ── App settings ──────────────────────────────────────────────────────────────

export async function getAllAppSettings(): Promise<Record<string, string>> {
  const rows = await sql<{ key: string; value: string }[]>`SELECT key, value FROM app_settings`;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

// ── Waitlist ─────────────────────────────────────────────────────────────────

export interface WaitlistEntryInput {
  email: string;
  source: string;
  locale?: string;
  outcome?: string;
  messageCount?: number;
  notes?: string;
  userAgent?: string | null;
}

export async function upsertWaitlistEntry(input: WaitlistEntryInput): Promise<void> {
  await sql`
    INSERT INTO waitlist_entries (
      email,
      source,
      locale,
      outcome,
      message_count,
      notes,
      user_agent
    ) VALUES (
      ${input.email},
      ${input.source},
      ${input.locale ?? null},
      ${input.outcome ?? null},
      ${input.messageCount ?? null},
      ${input.notes ?? null},
      ${input.userAgent ?? null}
    )
    ON CONFLICT (email) DO UPDATE SET
      source = EXCLUDED.source,
      locale = COALESCE(EXCLUDED.locale, waitlist_entries.locale),
      outcome = COALESCE(EXCLUDED.outcome, waitlist_entries.outcome),
      message_count = COALESCE(EXCLUDED.message_count, waitlist_entries.message_count),
      notes = COALESCE(EXCLUDED.notes, waitlist_entries.notes),
      user_agent = COALESCE(EXCLUDED.user_agent, waitlist_entries.user_agent),
      updated_at = NOW()
  `;
}

export type WaitlistLifecycleStatus =
  | 'waiting'
  | 'invited'
  | 'account_created'
  | 'active_user'
  | 'blocked';

export interface AdminWaitlistEntry {
  id: string;
  email: string;
  source: string;
  locale: string | null;
  outcome: string | null;
  message_count: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  invited_at: string | null;
  last_invite_sent_at: string | null;
  access_opened_at: string | null;
  invite_locale: string | null;
  user_id: string | null;
  user_role: string | null;
  email_verified: boolean | null;
  access_status: 'pending' | 'approved' | 'blocked' | null;
  session_count: number;
  lifecycle_status: WaitlistLifecycleStatus;
}

export interface AdminWaitlistMetrics {
  total: number;
  waiting: number;
  invited: number;
  accountCreated: number;
  activeUsers: number;
  invitedPercent: number;
  activePercent: number;
}

export interface AdminWaitlistResult {
  entries: AdminWaitlistEntry[];
  metrics: AdminWaitlistMetrics;
}

function waitlistLifecycle(row: {
  user_id?: string | null;
  email_verified?: boolean | null;
  access_status?: string | null;
  invited_at?: string | Date | null;
  access_opened_at?: string | Date | null;
}): WaitlistLifecycleStatus {
  if (row.access_status === 'blocked') return 'blocked';
  if (row.user_id && row.email_verified && row.access_status === 'approved') return 'active_user';
  if (row.user_id) return 'account_created';
  if (row.invited_at || row.access_opened_at) return 'invited';
  return 'waiting';
}

export async function getAdminWaitlist(): Promise<AdminWaitlistResult> {
  const rows = await sql`
    SELECT
      w.id,
      w.email,
      w.source,
      w.locale,
      w.outcome,
      w.message_count,
      w.notes,
      w.created_at,
      w.updated_at,
      w.invited_at,
      w.last_invite_sent_at,
      w.access_opened_at,
      w.invite_locale,
      u.id AS user_id,
      u.role AS user_role,
      u.email_verified,
      u.access_status,
      COUNT(DISTINCT gs.id)::int AS session_count
    FROM waitlist_entries w
    LEFT JOIN users u ON lower(u.email) = lower(w.email)
    LEFT JOIN game_sessions gs ON gs.user_id = u.id
    GROUP BY w.id, u.id
    ORDER BY
      CASE
        WHEN u.id IS NOT NULL AND u.email_verified = true AND u.access_status = 'approved' THEN 3
        WHEN u.id IS NOT NULL THEN 2
        WHEN w.invited_at IS NOT NULL OR w.access_opened_at IS NOT NULL THEN 1
        ELSE 0
      END ASC,
      w.created_at DESC
  `;

  const entries = rows.map((row) => ({
    ...(row as unknown as Omit<AdminWaitlistEntry, 'lifecycle_status'>),
    lifecycle_status: waitlistLifecycle(row),
  })) as AdminWaitlistEntry[];

  const total = entries.length;
  const invited = entries.filter((entry) => entry.invited_at || entry.access_opened_at || entry.user_id).length;
  const activeUsers = entries.filter((entry) => entry.lifecycle_status === 'active_user').length;
  const accountCreated = entries.filter((entry) =>
    entry.lifecycle_status === 'account_created' || entry.lifecycle_status === 'active_user'
  ).length;
  const waiting = entries.filter((entry) => entry.lifecycle_status === 'waiting').length;

  return {
    entries,
    metrics: {
      total,
      waiting,
      invited,
      accountCreated,
      activeUsers,
      invitedPercent: total ? Math.round((invited / total) * 100) : 0,
      activePercent: total ? Math.round((activeUsers / total) * 100) : 0,
    },
  };
}

export interface OpenWaitlistInviteResult {
  email: string;
  locale: string;
  inviteToken: string | null;
  existingUser: User | null;
}

export async function openWaitlistAccess(
  email: string,
  locale: string
): Promise<OpenWaitlistInviteResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedLocale = locale === 'uk' || locale === 'es' ? locale : 'en';
  const existingUser = await getUserByEmail(normalizedEmail);

  if (existingUser) {
    const approved = await updateUserAccessStatus(existingUser.id, 'approved');
    await sql`
      INSERT INTO waitlist_entries (
        email,
        source,
        locale,
        invited_at,
        last_invite_sent_at,
        access_opened_at,
        invite_locale
      ) VALUES (
        ${normalizedEmail},
        'admin',
        ${normalizedLocale},
        NOW(),
        NOW(),
        NOW(),
        ${normalizedLocale}
      )
      ON CONFLICT (email) DO UPDATE SET
        invited_at = COALESCE(waitlist_entries.invited_at, NOW()),
        last_invite_sent_at = NOW(),
        access_opened_at = COALESCE(waitlist_entries.access_opened_at, NOW()),
        invite_locale = EXCLUDED.invite_locale,
        updated_at = NOW()
    `;
    return { email: normalizedEmail, locale: normalizedLocale, inviteToken: null, existingUser: approved };
  }

  const inviteToken = crypto.randomBytes(32).toString('hex');
  await sql`
    INSERT INTO waitlist_entries (
      email,
      source,
      locale,
      invite_token,
      invite_expires,
      invited_at,
      last_invite_sent_at,
      access_opened_at,
      invite_locale
    ) VALUES (
      ${normalizedEmail},
      'admin',
      ${normalizedLocale},
      ${inviteToken},
      NOW() + INTERVAL '14 days',
      NOW(),
      NOW(),
      NOW(),
      ${normalizedLocale}
    )
    ON CONFLICT (email) DO UPDATE SET
      invite_token = EXCLUDED.invite_token,
      invite_expires = EXCLUDED.invite_expires,
      invited_at = COALESCE(waitlist_entries.invited_at, NOW()),
      last_invite_sent_at = NOW(),
      access_opened_at = COALESCE(waitlist_entries.access_opened_at, NOW()),
      invite_locale = EXCLUDED.invite_locale,
      updated_at = NOW()
  `;

  return { email: normalizedEmail, locale: normalizedLocale, inviteToken, existingUser: null };
}

export async function getWaitlistInviteByToken(token: string): Promise<{
  id: string;
  email: string;
  locale: string | null;
  invite_locale: string | null;
  invite_expires: string;
} | null> {
  const rows = await sql`
    SELECT id, email, locale, invite_locale, invite_expires
    FROM waitlist_entries
    WHERE invite_token = ${token}
      AND invite_expires > NOW()
  `;
  return (rows[0] as {
    id: string;
    email: string;
    locale: string | null;
    invite_locale: string | null;
    invite_expires: string;
  } | undefined) ?? null;
}

export async function createUserFromWaitlistInvite(
  token: string,
  passwordHash: string
): Promise<User | null> {
  return sql.begin(async (tx) => {
    const invites = await tx`
      SELECT id, email
      FROM waitlist_entries
      WHERE invite_token = ${token}
        AND invite_expires > NOW()
      FOR UPDATE
    `;
    const invite = invites[0] as { id: string; email: string } | undefined;
    if (!invite) return null;

    const existing = await tx`
      SELECT id FROM users WHERE lower(email) = lower(${invite.email})
    `;
    if (existing[0]) return null;

    const users = await tx`
      INSERT INTO users (
        email,
        password_hash,
        role,
        email_verified,
        access_status,
        verify_token,
        verify_expires
      ) VALUES (
        ${invite.email},
        ${passwordHash},
        'user',
        true,
        'approved',
        NULL,
        NULL
      )
      RETURNING id, email, role, email_verified, access_status, created_at, updated_at
    `;

    await tx`
      UPDATE waitlist_entries
      SET invite_token = NULL,
          invite_expires = NULL,
          access_opened_at = COALESCE(access_opened_at, NOW()),
          updated_at = NOW()
      WHERE id = ${invite.id}
    `;

    return users[0] as unknown as User;
  });
}

// ── Session queries ────────────────────────────────────────────────────────────

export async function getSessions(): Promise<(GameSession & { last_message?: string })[]> {
  const rows = await sql`
    SELECT
      gs.*,
      m.content as last_message
    FROM game_sessions gs
    LEFT JOIN LATERAL (
      SELECT content FROM messages
      WHERE session_id = gs.id
      ORDER BY created_at DESC
      LIMIT 1
    ) m ON true
    ORDER BY
      CASE gs.status
        WHEN 'active' THEN 0
        WHEN 'paused' THEN 1
        ELSE 2
      END,
      gs.updated_at DESC
  `;
  return rows as unknown as (GameSession & { last_message?: string })[];
}

export async function getSessionsByUserId(
  userId: string
): Promise<(GameSession & { last_message?: string; latest_summary?: string; message_count?: number })[]> {
  const rows = await sql`
    SELECT
      gs.*,
      m.content as last_message,
      ss.summary as latest_summary,
      COALESCE(mc.cnt, 0)::int as message_count
    FROM game_sessions gs
    LEFT JOIN LATERAL (
      SELECT content FROM messages
      WHERE session_id = gs.id
      ORDER BY created_at DESC
      LIMIT 1
    ) m ON true
    LEFT JOIN LATERAL (
      SELECT summary FROM session_summaries
      WHERE session_id = gs.id
      ORDER BY session_number DESC
      LIMIT 1
    ) ss ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as cnt FROM messages
      WHERE session_id = gs.id
    ) mc ON true
    WHERE gs.user_id = ${userId}
    ORDER BY
      CASE gs.status
        WHEN 'active' THEN 0
        WHEN 'paused' THEN 1
        ELSE 2
      END,
      gs.updated_at DESC
  `;
  return rows as unknown as (GameSession & { last_message?: string; latest_summary?: string; message_count?: number })[];
}

export async function createSession(
  scenarioId: string,
  name: string,
  players: Player[],
  userId: string,
  startingLocation?: string,
  language: 'uk' | 'en' = 'uk',
  variantId?: string,
  variantHint?: string,
  options?: {
    campaignId?: string;
    sessionNumber?: number;
    initialWorldState?: WorldState;
  },
): Promise<GameSession> {
  const initialWorldState: WorldState = {
    act: 1,
    currentLocation: startingLocation,
    visitedLocations: startingLocation ? [startingLocation] : [],
    discoveredClues: [],
    npcRelations: {},
    summary: '',
    openThreads: [],
    playerNotes: [],
    passiveMessageCount: 0,
    totalMessageCount: 0,
    locationRisk: {},
    ...(variantId ? { variantId } : {}),
    ...(variantHint ? { variantHint } : {}),
  };
  const worldState = options?.initialWorldState
    ? {
        ...options.initialWorldState,
        currentLocation: options.initialWorldState.currentLocation ?? startingLocation,
      }
    : initialWorldState;

  const rows = await sql`
    INSERT INTO game_sessions (
      scenario_id,
      name,
      players,
      world_state,
      user_id,
      language,
      campaign_id,
      session_number
    )
    VALUES (
      ${scenarioId},
      ${name},
      ${sql.json(jsonOf(players))},
      ${sql.json(jsonOf(worldState))},
      ${userId},
      ${language},
      ${options?.campaignId ?? null},
      ${options?.sessionNumber ?? 1}
    )
    RETURNING *
  `;
  return rows[0] as unknown as GameSession;
}

export async function getSession(id: string): Promise<GameSession | null> {
  const rows = await sql`
    SELECT * FROM game_sessions WHERE id = ${id}
  `;
  return (rows[0] as unknown as GameSession) || null;
}

export async function updateSession(
  id: string,
  updates: {
    world_state?: WorldState;
    act?: number;
    players?: Player[];
    status?: GameSession['status'];
    language?: string;
    completed_at?: string | null;
    completion_trigger?: GameSession['completion_trigger'];
    ended_early?: boolean | null;
  }
): Promise<GameSession> {
  // Build one UPDATE with all changed columns using postgres.js dynamic query builder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if (updates.world_state !== undefined) data.world_state = sql.json(jsonOf(updates.world_state));
  if (updates.players     !== undefined) data.players     = sql.json(jsonOf(updates.players));
  if (updates.act         !== undefined) data.act         = updates.act;
  if (updates.status      !== undefined) data.status      = updates.status;
  if (updates.language    !== undefined) data.language    = updates.language;
  if (updates.completed_at !== undefined) data.completed_at = updates.completed_at;
  if (updates.completion_trigger !== undefined) data.completion_trigger = updates.completion_trigger;
  if (updates.ended_early !== undefined) data.ended_early = updates.ended_early;

  if (Object.keys(data).length > 0) {
    data.updated_at = sql`NOW()`;
    await sql`UPDATE game_sessions SET ${sql(data)} WHERE id = ${id}`;
  }

  const rows = await sql`SELECT * FROM game_sessions WHERE id = ${id}`;
  return rows[0] as unknown as GameSession;
}

export async function deleteSession(id: string): Promise<void> {
  await sql`DELETE FROM game_sessions WHERE id = ${id}`;
}

// ── Message queries ────────────────────────────────────────────────────────────

export async function getMessages(sessionId: string, limit?: number): Promise<Message[]> {
  const rows = limit
    ? await sql`SELECT * FROM messages WHERE session_id = ${sessionId} ORDER BY created_at ASC LIMIT ${limit}`
    : await sql`SELECT * FROM messages WHERE session_id = ${sessionId} ORDER BY created_at ASC`;
  return rows as unknown as Message[];
}

export async function getLastNMessages(sessionId: string, n: number): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM (
      SELECT * FROM messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT ${n}
    ) sub
    ORDER BY created_at ASC
  `;
  return rows as unknown as Message[];
}

export async function countMessages(sessionId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int as count FROM messages WHERE session_id = ${sessionId}
  `;
  return rows[0].count as number;
}

export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  playerIdx?: number
): Promise<Message> {
  const rows = await sql`
    INSERT INTO messages (session_id, role, content, player_idx)
    VALUES (${sessionId}, ${role}, ${content}, ${playerIdx ?? null})
    RETURNING *
  `;
  return rows[0] as unknown as Message;
}

export async function getAllMessages(sessionId: string): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `;
  return rows as unknown as Message[];
}

// ── Message debug (admin) ──────────────────────────────────────────────────────

export interface MessageDebugInput {
  promptBlocks: unknown; // { ruleset, static, dynamic, history, geminiCacheMode? }
  rawOutput: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
}

export interface MessageDebugRow {
  message_id: string;
  prompt_blocks: unknown;
  raw_output: string;
  provider: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  finish_reason: string | null;
  created_at: string;
}

export async function saveMessageDebug(
  messageId: string,
  data: MessageDebugInput
): Promise<void> {
  await sql`
    INSERT INTO message_debug (
      message_id, prompt_blocks, raw_output, provider, model,
      input_tokens, output_tokens, finish_reason
    ) VALUES (
      ${messageId}, ${jsonOf(data.promptBlocks)}, ${data.rawOutput},
      ${data.provider ?? null}, ${data.model ?? null},
      ${data.inputTokens ?? null}, ${data.outputTokens ?? null},
      ${data.finishReason ?? null}
    )
    ON CONFLICT (message_id) DO UPDATE SET
      prompt_blocks = EXCLUDED.prompt_blocks,
      raw_output    = EXCLUDED.raw_output,
      provider      = EXCLUDED.provider,
      model         = EXCLUDED.model,
      input_tokens  = EXCLUDED.input_tokens,
      output_tokens = EXCLUDED.output_tokens,
      finish_reason = EXCLUDED.finish_reason
  `;
}

export async function getMessageDebug(messageId: string): Promise<MessageDebugRow | null> {
  const rows = await sql`SELECT * FROM message_debug WHERE message_id = ${messageId}`;
  return (rows[0] as unknown as MessageDebugRow) ?? null;
}

// ── Auth queries ───────────────────────────────────────────────────────────────

export async function createUser(
  email: string,
  passwordHash: string,
  verifyToken: string
): Promise<User> {
  const rows = await sql`
    INSERT INTO users (email, password_hash, verify_token, verify_expires)
    VALUES (
      ${email},
      ${passwordHash},
      ${verifyToken},
      NOW() + INTERVAL '24 hours'
    )
    RETURNING id, email, role, email_verified, created_at, updated_at
  `;
  return rows[0] as unknown as User;
}

export async function getUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const rows = await sql`
    SELECT id, email, role, email_verified, access_status, password_hash, verify_token, verify_expires, created_at, updated_at
    FROM users
    WHERE email = ${email}
  `;
  return (rows[0] as unknown as (User & { password_hash: string })) || null;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await sql`
    SELECT id, email, role, email_verified, access_status, created_at, updated_at
    FROM users
    WHERE id = ${id}
  `;
  return (rows[0] as unknown as User) || null;
}

// GDPR Art. 17 — right to erasure (ANT-159).
//
// NOTE the FK trap: game_sessions.user_id is ON DELETE SET NULL, so deleting the
// user row alone would ORPHAN the player's sessions and messages (the chat
// content — the most sensitive personal data) instead of erasing them. We must
// delete the sessions explicitly first; that cascades messages, session_summaries,
// session_feedback and message_debug.
//
// waitlist_entries has no FK to users (keyed by email), so it is deleted by email.
// Deleting the user row then cascades campaigns (→ campaign_assets, summaries) and
// sets api_usage.user_id NULL — anonymized cost rows are intentionally retained
// (legitimate interest; documented in the Privacy Policy / retention policy).
//
// All-or-nothing: a failure on any step rolls the whole erasure back.
export async function deleteUserAccount(userId: string, email: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM game_sessions WHERE user_id = ${userId}`;
    await tx`DELETE FROM waitlist_entries WHERE lower(email) = ${email.toLowerCase()}`;
    await tx`DELETE FROM users WHERE id = ${userId}`;
  });
}

export interface UserAccountExport {
  exportedAt: string;
  account: Pick<User, 'id' | 'email' | 'role' | 'email_verified' | 'access_status' | 'created_at' | 'updated_at'>;
  sessions: (GameSession & { messages: Message[] })[];
  campaigns: Campaign[];
  sessionSummaries: SessionSummary[];
  feedbackSubmitted: SessionFeedback[];
}

// GDPR Art. 20 — right to data portability (ANT-159). Returns everything tied to
// the user as structured JSON. Never includes password_hash or auth tokens.
export async function getUserAccountExport(userId: string): Promise<UserAccountExport | null> {
  const userRows = await sql`
    SELECT id, email, role, email_verified, access_status, created_at, updated_at
    FROM users WHERE id = ${userId}
  `;
  const account = userRows[0] as unknown as UserAccountExport['account'] | undefined;
  if (!account) return null;

  const sessionRows = (await sql`
    SELECT * FROM game_sessions WHERE user_id = ${userId} ORDER BY created_at ASC
  `) as unknown as GameSession[];
  const sessionIds = sessionRows.map((s) => s.id);

  const messageRows = sessionIds.length
    ? ((await sql`
        SELECT * FROM messages WHERE session_id IN ${sql(sessionIds)} ORDER BY created_at ASC
      `) as unknown as Message[])
    : [];
  const messagesBySession = new Map<string, Message[]>();
  for (const m of messageRows) {
    const list = messagesBySession.get(m.session_id) ?? [];
    list.push(m);
    messagesBySession.set(m.session_id, list);
  }

  const campaigns = (await sql`
    SELECT * FROM campaigns WHERE user_id = ${userId} ORDER BY created_at ASC
  `) as unknown as Campaign[];

  const sessionSummaries = sessionIds.length
    ? ((await sql`
        SELECT * FROM session_summaries WHERE session_id IN ${sql(sessionIds)}
      `) as unknown as SessionSummary[])
    : [];

  const feedbackSubmitted = (await sql`
    SELECT * FROM session_feedback WHERE submitted_by_user_id = ${userId}
  `) as unknown as SessionFeedback[];

  return {
    exportedAt: new Date().toISOString(),
    account,
    sessions: sessionRows.map((s) => ({ ...s, messages: messagesBySession.get(s.id) ?? [] })),
    campaigns,
    sessionSummaries,
    feedbackSubmitted,
  };
}

export async function verifyUserEmail(token: string): Promise<User | null> {
  const rows = await sql`
    UPDATE users
    SET email_verified = true, verify_token = NULL, verify_expires = NULL, updated_at = NOW()
    WHERE verify_token = ${token} AND verify_expires > NOW()
    RETURNING id, email, role, email_verified, created_at, updated_at
  `;
  return (rows[0] as unknown as User) || null;
}

export async function regenerateVerifyToken(
  email: string
): Promise<{ token: string; tooSoon: boolean }> {
  // Rate-limit: don't allow regeneration if the token was just issued (within 5 min)
  const rows = await sql`
    SELECT verify_expires FROM users
    WHERE email = ${email} AND email_verified = false
  `;
  if (!rows[0]) return { token: '', tooSoon: false };

  const expires = rows[0].verify_expires as Date | null;
  if (expires) {
    const issuedAt = new Date(expires.getTime() - 24 * 60 * 60 * 1000);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (issuedAt > fiveMinAgo) return { token: '', tooSoon: true };
  }

  const newToken = crypto.randomBytes(32).toString('hex');
  await sql`
    UPDATE users
    SET verify_token = ${newToken}, verify_expires = NOW() + INTERVAL '24 hours', updated_at = NOW()
    WHERE email = ${email} AND email_verified = false
  `;
  return { token: newToken, tooSoon: false };
}

// ── Admin queries ──────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<(User & { session_count: number; daily_cost: number })[]> {
  const rows = await sql`
    SELECT
      u.id, u.email, u.role, u.email_verified, u.access_status, u.created_at, u.updated_at,
      COUNT(DISTINCT gs.id)::int as session_count,
      COALESCE(SUM(au.cost_usd) FILTER (WHERE au.created_at >= CURRENT_DATE), 0)::float as daily_cost
    FROM users u
    LEFT JOIN game_sessions gs ON gs.user_id = u.id
    LEFT JOIN api_usage au ON au.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `;
  return rows as unknown as (User & { session_count: number; daily_cost: number })[];
}

export async function getAllSessionsWithOwner(): Promise<(GameSession & {
  owner_email?: string;
  last_message?: string;
  feedback_rating?: number | null;
  feedback_comment?: string | null;
})[]> {
  const rows = await sql`
    SELECT
      gs.*,
      u.email as owner_email,
      m.content as last_message,
      sf.rating AS feedback_rating,
      sf.comment AS feedback_comment
    FROM game_sessions gs
    LEFT JOIN users u ON gs.user_id = u.id
    LEFT JOIN session_feedback sf ON sf.session_id = gs.id
    LEFT JOIN LATERAL (
      SELECT content FROM messages
      WHERE session_id = gs.id
      ORDER BY created_at DESC
      LIMIT 1
    ) m ON true
    ORDER BY
      CASE gs.status
        WHEN 'active' THEN 0
        WHEN 'paused' THEN 1
        ELSE 2
      END,
      gs.updated_at DESC
  `;
  return rows as unknown as (GameSession & {
    owner_email?: string;
    last_message?: string;
    feedback_rating?: number | null;
    feedback_comment?: string | null;
  })[];
}

export async function updateUserRole(userId: string, role: 'user' | 'admin'): Promise<User> {
  const rows = await sql`
    UPDATE users
    SET role = ${role}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, email, role, email_verified, access_status, created_at, updated_at
  `;
  return rows[0] as unknown as User;
}

export async function updateUserAccessStatus(
  userId: string,
  accessStatus: 'pending' | 'approved' | 'blocked'
): Promise<User> {
  const rows = await sql`
    UPDATE users
    SET access_status = ${accessStatus}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, email, role, email_verified, access_status, created_at, updated_at
  `;
  return rows[0] as unknown as User;
}

// Sum of a user's API spend since local midnight (UTC date boundary, matching
// the api_usage indexes). Used by the per-user daily cost cap (ANT-108).
export async function getUserDailyCost(userId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(SUM(cost_usd), 0)::float AS total
    FROM api_usage
    WHERE user_id = ${userId} AND created_at >= CURRENT_DATE
  `;
  return (rows[0]?.total as number) ?? 0;
}

// ── Campaign queries ───────────────────────────────────────────────────────────

export async function createCampaignRecord(
  userId: string,
  scenarioId: string,
  name: string,
  worldState: WorldState
): Promise<Campaign> {
  const rows = await sql`
    INSERT INTO campaigns (user_id, scenario_id, name, world_state, npc_states)
    VALUES (
      ${userId},
      ${scenarioId},
      ${name},
      ${sql.json(jsonOf(worldState))},
      ${sql.json({})}
    )
    RETURNING *
  `;
  return rows[0] as unknown as Campaign;
}

export async function getCampaignRecord(
  campaignId: string,
  userId: string
): Promise<Campaign | null> {
  const rows = await sql`
    SELECT * FROM campaigns WHERE id = ${campaignId} AND user_id = ${userId}
  `;
  return (rows[0] as unknown as Campaign) || null;
}

export async function updateCampaignRecord(
  campaignId: string,
  updates: { worldState?: WorldState; status?: Campaign['status'] }
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (updates.worldState !== undefined) data.world_state = sql.json(jsonOf(updates.worldState));
  if (updates.status !== undefined) data.status = updates.status;
  if (Object.keys(data).length === 0) return;
  data.updated_at = sql`NOW()`;
  await sql`UPDATE campaigns SET ${sql(data)} WHERE id = ${campaignId}`;
}

export async function getRecentSessionSummaries(
  campaignId: string,
  limit = 3
): Promise<SessionSummary[]> {
  const rows = await sql`
    SELECT * FROM session_summaries
    WHERE campaign_id = ${campaignId}
    ORDER BY session_number DESC
    LIMIT ${limit}
  `;
  return rows as unknown as SessionSummary[];
}

export async function getSessionSummaryBySessionId(sessionId: string): Promise<SessionSummary | null> {
  const rows = await sql`
    SELECT * FROM session_summaries
    WHERE session_id = ${sessionId}
    LIMIT 1
  `;
  return (rows[0] as unknown as SessionSummary) || null;
}

export async function saveSessionSummary(
  campaignId: string,
  sessionId: string,
  sessionNumber: number,
  summary: string,
  keyEvents: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  npcChanges: Record<string, any>,
  characterSnapshots: Player[]
): Promise<void> {
  await sql`
    INSERT INTO session_summaries
      (campaign_id, session_id, session_number, summary, key_events, npc_changes, character_snapshots)
    VALUES (
      ${campaignId},
      ${sessionId},
      ${sessionNumber},
      ${summary},
      ${sql.json(keyEvents)},
      ${sql.json(npcChanges)},
      ${sql.json(jsonOf(characterSnapshots))}
    )
  `;
  await sql`
    UPDATE campaigns SET session_count = session_count + 1, updated_at = NOW()
    WHERE id = ${campaignId}
  `;
}

export async function upsertSessionFeedback(
  sessionId: string,
  rating: number,
  comment: string | null,
  submittedByUserId: string
): Promise<SessionFeedback> {
  const rows = await sql`
    INSERT INTO session_feedback (session_id, rating, comment, submitted_by_user_id)
    VALUES (${sessionId}, ${rating}, ${comment}, ${submittedByUserId})
    ON CONFLICT (session_id) DO UPDATE
    SET
      rating = EXCLUDED.rating,
      comment = EXCLUDED.comment,
      submitted_by_user_id = EXCLUDED.submitted_by_user_id,
      updated_at = NOW()
    RETURNING *
  `;
  return rows[0] as unknown as SessionFeedback;
}

export async function setPasswordResetToken(userId: string, resetToken: string): Promise<void> {
  await sql`
    UPDATE users
    SET reset_token = ${resetToken}, reset_expires = NOW() + INTERVAL '1 hour', updated_at = NOW()
    WHERE id = ${userId}
  `;
}

export async function getUserByResetToken(token: string): Promise<(User & { password_hash: string }) | null> {
  const rows = await sql`
    SELECT id, email, role, email_verified, password_hash
    FROM users
    WHERE reset_token = ${token} AND reset_expires > NOW()
  `;
  return (rows[0] as unknown as (User & { password_hash: string })) || null;
}

export async function updatePasswordAndClearResetToken(userId: string, newPasswordHash: string): Promise<void> {
  await sql`
    UPDATE users
    SET password_hash = ${newPasswordHash}, reset_token = NULL, reset_expires = NULL, updated_at = NOW()
    WHERE id = ${userId}
  `;
}
