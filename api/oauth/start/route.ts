// @ts-nocheck
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function signOAuthState(payloadObj: Record<string, any>) {
  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) throw new Error('OAUTH_STATE_SECRET oder SUPABASE_SERVICE_ROLE_KEY fehlt.');
  const dataB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  return `${dataB64}.${sig}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = String(url.searchParams.get('provider') || '').toLowerCase(); // 'google' | 'microsoft'
  const intent = url.searchParams.get('intent') === 'link' ? 'link' : 'login';
  const accountId = String(url.searchParams.get('accountId') || '').trim().toLowerCase();
  const memberId = String(url.searchParams.get('memberId') || 'account').trim();
  const returnTo = url.searchParams.get('returnTo') === '/pocket' ? '/pocket' : '/';

  const origin = url.origin;
  const redirectUri = `${origin}/api/oauth/callback`;

  if (provider !== 'google' && provider !== 'microsoft') {
    return NextResponse.redirect(`${origin}${returnTo}?oauth_error=${encodeURIComponent('Unbekannter Anbieter.')}`);
  }

  if (intent === 'link' && (!accountId || accountId === 'local')) {
    return NextResponse.redirect(`${origin}${returnTo}?oauth_error=${encodeURIComponent('Bitte zuerst in dein Cloud-Konto einloggen.')}`);
  }

  const stateToken = signOAuthState({
    provider,
    intent,
    accountId,
    memberId,
    returnTo,
    exp: Date.now() + 10 * 60 * 1000
  });

  if (provider === 'google') {
    const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
    if (!clientId) {
      return NextResponse.redirect(
        `${origin}${returnTo}?oauth_error=${encodeURIComponent('GOOGLE_OAUTH_CLIENT_ID fehlt noch in Vercel.')}`
      );
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/calendar');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('state', stateToken);

    return NextResponse.redirect(authUrl.toString());
  }

  // Microsoft / Outlook (persönliche Outlook.com/Hotmail/Live + Microsoft 365 Konten)
  const msClientId = (process.env.MICROSOFT_OAUTH_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
  if (!msClientId) {
    return NextResponse.redirect(
      `${origin}${returnTo}?oauth_error=${encodeURIComponent('MICROSOFT_OAUTH_CLIENT_ID fehlt noch in Vercel.')}`
    );
  }

  const msAuthUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  msAuthUrl.searchParams.set('client_id', msClientId);
  msAuthUrl.searchParams.set('redirect_uri', redirectUri);
  msAuthUrl.searchParams.set('response_type', 'code');
  msAuthUrl.searchParams.set('response_mode', 'query');
  msAuthUrl.searchParams.set('scope', 'openid email profile offline_access User.Read Calendars.ReadWrite');
  msAuthUrl.searchParams.set('prompt', 'select_account');
  msAuthUrl.searchParams.set('state', stateToken);

  return NextResponse.redirect(msAuthUrl.toString());
}
