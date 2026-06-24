import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { verifyJwt, clearAuthCookie } from '@/lib/auth';
import { getUserByEmail, deleteUserAccount, ensureSchema, updateUserInterfaceLanguage } from '@/lib/queries';
import { normalizeInterfaceLanguage } from '@/lib/interfaceLanguage';

async function requireUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  return verifyJwt(token);
}

// PATCH /api/account — authenticated account preferences.
export async function PATCH(request: Request) {
  try {
    await ensureSchema();

    const payload = await requireUser();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const interfaceLanguage = normalizeInterfaceLanguage(
      (body as { interface_language?: unknown; interfaceLanguage?: unknown }).interface_language
        ?? (body as { interfaceLanguage?: unknown }).interfaceLanguage
    );

    await updateUserInterfaceLanguage(payload.sub, interfaceLanguage);

    return NextResponse.json({ ok: true, interface_language: interfaceLanguage });
  } catch (error) {
    console.error('Account update error:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

// DELETE /api/account — GDPR Art. 17 self-service erasure (ANT-159).
// Requires the account password as a confirmation step for this destructive,
// irreversible action.
export async function DELETE(request: Request) {
  try {
    await ensureSchema();

    const payload = await requireUser();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { password } = body as { password?: string };
    if (!password) {
      return NextResponse.json({ error: 'Password is required to confirm deletion' }, { status: 400 });
    }

    const user = await getUserByEmail(payload.email);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
    }

    await deleteUserAccount(user.id, user.email);

    const response = NextResponse.json({ ok: true });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
