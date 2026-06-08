import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    await request.json().catch(() => ({}));
    return NextResponse.json(
      {
        error: 'registration_closed',
        message: 'Direct registration is closed. Join the waiting list for access.',
      },
      { status: 403 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration unavailable' }, { status: 500 });
  }
}
