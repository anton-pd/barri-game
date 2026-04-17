import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { closeSession } from '@/lib/campaigns';
import {
  createSession,
  ensureSchema,
  getAllMessages,
  getSession,
  getSessionSummaryBySessionId,
  updateCampaignRecord,
  updateSession,
  upsertSessionFeedback,
} from '@/lib/queries';
import type { GameSession, SessionFeedback, WorldState } from '@/types';

type CompleteMode = 'complete-session' | 'finish-evening';

function canAccess(sessionUserId: string | null, payloadSub: string, role: string): boolean {
  if (role === 'admin') return true;
  if (sessionUserId === null) return true;
  return sessionUserId === payloadSub;
}

function buildNextSessionWorldState(worldState: WorldState, summary: string): WorldState {
  return {
    ...worldState,
    summary,
    passiveMessageCount: 0,
    totalMessageCount: 0,
    pendingRollResult: undefined,
    activeRandomEvent: undefined,
    locationRisk: {},
    sessionImages: {},
    variantHint: undefined,
  };
}

function buildCompletionStats(session: GameSession, completedAt: string, messageCount: number, keeperMessageCount: number) {
  const durationMs = Math.max(
    0,
    new Date(completedAt).getTime() - new Date(session.created_at).getTime()
  );

  return {
    startedAt: session.created_at,
    completedAt,
    messageCount,
    keeperMessageCount,
    playerMessageCount: Math.max(0, messageCount - keeperMessageCount),
    durationMinutes: Math.round(durationMs / 60000),
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyJwt(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!canAccess(session.user_id, payload.sub, payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Session already completed' }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = (body.mode ?? 'complete-session') as CompleteMode;
    const feedback = body.feedback as { rating?: number; comment?: string } | undefined;

    if (mode !== 'complete-session' && mode !== 'finish-evening') {
      return NextResponse.json({ error: 'Invalid completion mode' }, { status: 400 });
    }

    if (mode === 'finish-evening' && !session.campaign_id) {
      return NextResponse.json({ error: 'Only campaign sessions can finish an evening' }, { status: 400 });
    }

    if (feedback?.rating !== undefined && (!Number.isInteger(feedback.rating) || feedback.rating < 1 || feedback.rating > 5)) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }

    const messages = await getAllMessages(session.id);
    const keeperMessageCount = messages.filter((message) => message.role === 'assistant').length;
    const completedAt = new Date().toISOString();

    let summary = session.world_state.summary || 'Сесію завершено.';
    if (session.campaign_id) {
      const existingSummary = await getSessionSummaryBySessionId(session.id);
      if (existingSummary) {
        summary = existingSummary.summary;
      } else {
        const summaryData = await closeSession(
          session.id,
          session.campaign_id,
          session.session_number ?? 1,
          session.players,
          messages.map((message) => ({ role: message.role, content: message.content }))
        );
        summary = summaryData.summary;
      }
    }

    const finalizedWorldState: WorldState = {
      ...session.world_state,
      summary,
      pendingRollResult: undefined,
      activeRandomEvent: undefined,
    };

    let savedFeedback: SessionFeedback | null = null;
    if (mode === 'complete-session' && feedback?.rating !== undefined) {
      savedFeedback = await upsertSessionFeedback(
        session.id,
        feedback.rating,
        feedback.comment?.trim() || null,
        payload.sub
      );
    }

    let nextSession: GameSession | null = null;
    if (mode === 'finish-evening' && session.campaign_id) {
      const nextWorldState = buildNextSessionWorldState(finalizedWorldState, summary);
      await updateCampaignRecord(session.campaign_id, {
        worldState: nextWorldState,
        status: 'active',
      });
      nextSession = await createSession(
        session.scenario_id,
        session.name,
        session.players,
        session.user_id ?? payload.sub,
        nextWorldState.currentLocation,
        session.language ?? 'uk',
        undefined,
        undefined,
        {
          campaignId: session.campaign_id,
          sessionNumber: (session.session_number ?? 1) + 1,
          initialWorldState: nextWorldState,
        }
      );
    } else if (session.campaign_id) {
      await updateCampaignRecord(session.campaign_id, {
        worldState: finalizedWorldState,
        status: 'completed',
      });
    }

    const updatedSession = await updateSession(session.id, {
      status: 'completed',
      completed_at: completedAt,
      world_state: finalizedWorldState,
    });

    return NextResponse.json({
      session: updatedSession,
      nextSession,
      feedback: savedFeedback,
      summary,
      stats: buildCompletionStats(session, completedAt, messages.length, keeperMessageCount),
    });
  } catch (error) {
    console.error('Error completing session:', error);
    return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 });
  }
}
