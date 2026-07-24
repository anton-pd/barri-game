import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { closeSession } from '@/lib/campaigns';
import { buildNextSessionWorldState } from '@/lib/campaignState';
import {
  createSession,
  ensureSchema,
  getAllMessages,
  getSession,
  getSessionSummaryBySessionId,
  updateCampaignRecord,
  updateSession,
  upsertSessionFeedback,
  getUserById,
} from '@/lib/queries';
import type { GameSession, SessionFeedback, WorldState } from '@/types';
import { evaluateSessionAccess } from '@/lib/sessionAccess';

type CompleteMode = 'complete-session' | 'finish-evening';
type CompletionTrigger = 'keeper' | 'manual';

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

    const access = evaluateSessionAccess({ authenticatedUserId: payload.sub, currentUser: await getUserById(payload.sub), session });
    if (!access.ok) return NextResponse.json({ error: access.code === 'unauthorized' ? 'Unauthorized' : 'Forbidden' }, { status: access.status });

    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Session already completed' }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = (body.mode ?? 'complete-session') as CompleteMode;
    const feedback = body.feedback as { rating?: number; comment?: string } | undefined;
    const trigger = (body.trigger ?? 'manual') as CompletionTrigger;
    const endedEarly = Boolean(body.endedEarly);

    if (mode !== 'complete-session' && mode !== 'finish-evening') {
      return NextResponse.json({ error: 'Invalid completion mode' }, { status: 400 });
    }

    if (trigger !== 'keeper' && trigger !== 'manual') {
      return NextResponse.json({ error: 'Invalid completion trigger' }, { status: 400 });
    }

    if (mode === 'finish-evening' && !session.campaign_id) {
      return NextResponse.json({ error: 'Only campaign sessions can finish an evening' }, { status: 400 });
    }

    // There are currently no ownerless production sessions. An admin may still
    // inspect or close a legacy row, but must not silently transfer it to their
    // own account by creating the next campaign evening.
    if (mode === 'finish-evening' && !session.user_id) {
      return NextResponse.json({ error: 'Ownerless sessions cannot continue a campaign' }, { status: 409 });
    }

    if (feedback?.rating !== undefined && (!Number.isInteger(feedback.rating) || feedback.rating < 1 || feedback.rating > 5)) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }

    const messages = await getAllMessages(session.id);
    const keeperMessageCount = messages.filter((message) => message.role === 'assistant').length;
    const completedAt = new Date().toISOString();

    const sessionLang: 'uk' | 'en' = (session.language ?? 'uk') as 'uk' | 'en';
    let summary = session.world_state.summary
      || (sessionLang === 'en' ? 'Session completed.' : 'Сесію завершено.');
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
          messages.map((message) => ({ role: message.role, content: message.content })),
          sessionLang
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
    if (feedback?.rating !== undefined) {
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
        session.user_id!,
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
      completion_trigger: trigger,
      ended_early: endedEarly,
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
