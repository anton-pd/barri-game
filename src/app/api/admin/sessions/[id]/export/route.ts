import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { ensureSchema, getSession, getAllMessages } from '@/lib/queries';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    await ensureSchema();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyJwt(token) : null;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const session = await getSession(id);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const messages = await getAllMessages(id);

    const lines: string[] = [];
    lines.push(`# Session ${session.id}`);
    lines.push('');
    lines.push(`- **Scenario**: ${session.scenario_id}`);
    lines.push(`- **Name**: ${session.name}`);
    lines.push(`- **Status**: ${session.status}`);
    lines.push(`- **Language**: ${session.language ?? 'uk'}`);
    lines.push(`- **Keeper style**: ${session.keeper_style ?? 'balanced'}`);
    lines.push(`- **Created**: ${session.created_at}`);
    lines.push(`- **Updated**: ${session.updated_at}`);
    if (session.campaign_id) lines.push(`- **Campaign**: ${session.campaign_id}`);
    lines.push(`- **Messages**: ${messages.length}`);
    lines.push('');
    lines.push('## Players');
    for (const [i, p] of session.players.entries()) {
      lines.push(`- \`[${i}]\` **${p.name}** — ${p.role ?? '—'}`);
    }
    lines.push('');
    lines.push('## Transcript');
    lines.push('');

    for (const m of messages) {
      const who = m.role === 'assistant'
        ? 'Keeper'
        : m.player_idx !== null && m.player_idx !== undefined && session.players[m.player_idx]
          ? `${session.players[m.player_idx].name} [${m.player_idx}]`
          : m.role;
      lines.push(`### ${who} — ${m.created_at}`);
      lines.push('');
      lines.push('```');
      lines.push(m.content);
      lines.push('```');
      lines.push('');
    }

    const markdown = lines.join('\n');
    const filename = `barri-session-${session.id}.md`;
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('Export session error:', e);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}
