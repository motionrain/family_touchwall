// @ts-nocheck
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabaseAdmin() {
  const rawUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  return createClient(new URL(rawUrl).origin, key, { auth: { persistSession: false } });
}

function sha256(val: string) {
  return crypto.createHash('sha256').update(String(val || '').trim()).digest('hex');
}

function verifySignedSessionToken(token: string, expectedAccountId: string, authHash: string) {
  if (!token || !token.startsWith('tws_')) return false;
  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const parts = token.slice(4).split('.');
  if (parts.length !== 2 || !secret) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  if (sig !== expectedSig) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return parsed.a === expectedAccountId && (!parsed.h || parsed.h === String(authHash).slice(0, 12));
  } catch {
    return false;
  }
}

// GET /api/oauth/session -> Liest & löscht das einmalige 60s-Login-Handoff-Cookie
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('tw_oauth_handoff')?.value || '';
  if (!raw) {
    return NextResponse.json({ ok: true, handoff: null });
  }

  let handoff = null;
  try {
    handoff = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {}

  const res = NextResponse.json({ ok: true, handoff });
  res.cookies.set('tw_oauth_handoff', '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

// POST /api/oauth/session -> Verbundene Google/Outlook-Konten auflisten, Kalender wählen oder trennen
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action || '').trim();
    const accountId = String(body.accountId || '').trim().toLowerCase();
    const authKey = String(body.authKey || '').trim();

    if (!accountId || !authKey) {
      return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: acc } = await supabase
      .from('tw_accounts')
      .select('account_id, auth_hash')
      .eq('account_id', accountId)
      .maybeSingle();

    if (!acc) return NextResponse.json({ ok: false, error: 'Konto nicht gefunden.' }, { status: 404 });
    const valid = sha256(authKey) === acc.auth_hash || verifySignedSessionToken(authKey, accountId, acc.auth_hash);
    if (!valid) return NextResponse.json({ ok: false, error: 'Zugriff verweigert.' }, { status: 401 });

    if (action === 'disconnect') {
      const provider = String(body.provider || '').toLowerCase();
      const memberId = String(body.memberId || 'account');
      await supabase
        .from('tw_oauth_connections')
        .delete()
        .eq('account_id', accountId)
        .eq('member_id', memberId)
        .eq('provider', provider);
      return NextResponse.json({ ok: true });
    }

    if (action === 'selectCalendar') {
      const provider = String(body.provider || '').toLowerCase();
      const memberId = String(body.memberId || 'account');
      const calendarId = String(body.calendarId || 'primary');
      const calendarName = String(body.calendarName || '');
      await supabase
        .from('tw_oauth_connections')
        .update({ calendar_id: calendarId, calendar_name: calendarName, updated_at: new Date().toISOString() })
        .eq('account_id', accountId)
        .eq('member_id', memberId)
        .eq('provider', provider);
      return NextResponse.json({ ok: true });
    }

    if (action === 'listConnections') {
      const { data: conns } = await supabase
        .from('tw_oauth_connections')
        .select('member_id, provider, provider_email, calendar_id, calendar_name, updated_at')
        .eq('account_id', accountId);
      return NextResponse.json({ ok: true, connections: conns || [] });
    }

    return NextResponse.json({ ok: false, error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Fehler' }, { status: 500 });
  }
}
