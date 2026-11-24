// @ts-nocheck
import { NextResponse } from 'next/server';
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

function verifyOAuthState(stateToken: string) {
  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const parts = String(stateToken || '').split('.');
  if (parts.length !== 2 || !secret) return null;
  const [dataB64, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(dataB64, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function issueSignedSessionToken(accountId: string, authHash: string) {
  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const payload = Buffer.from(
    JSON.stringify({
      a: accountId,
      h: String(authHash || '').slice(0, 12),
      iat: Date.now()
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `tws_${payload}.${sig}`;
}

async function exchangeCodeForTokens(provider: 'google' | 'microsoft', code: string, redirectUri: string) {
  if (provider === 'google') {
    const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
    const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim().replace(/^["']|["']$/g, '');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error('Google Token-Austausch fehlgeschlagen: ' + (tokenJson.error_description || tokenJson.error || tokenRes.status));
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` }
    });
    const userJson = await userRes.json();

    return {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || '',
      expiresAt: Date.now() + Number(tokenJson.expires_in || 3500) * 1000,
      scopes: tokenJson.scope || '',
      providerUserId: String(userJson.id || ''),
      providerEmail: String(userJson.email || '').trim().toLowerCase(),
      displayName: String(userJson.name || userJson.given_name || '').trim()
    };
  }

  // Microsoft / Outlook
  const msClientId = (process.env.MICROSOFT_OAUTH_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
  const msClientSecret = (process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '').trim().replace(/^["']|["']$/g, '');

  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: msClientId,
      client_secret: msClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'openid email profile offline_access User.Read Calendars.ReadWrite'
    })
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error('Outlook Token-Austausch fehlgeschlagen: ' + (tokenJson.error_description || tokenJson.error || tokenRes.status));
  }

  const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });
  const userJson = await userRes.json();

  return {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || '',
    expiresAt: Date.now() + Number(tokenJson.expires_in || 3500) * 1000,
    scopes: tokenJson.scope || '',
    providerUserId: String(userJson.id || ''),
    providerEmail: String(userJson.mail || userJson.userPrincipalName || '').trim().toLowerCase(),
    displayName: String(userJson.displayName || userJson.givenName || '').trim()
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const redirectUri = `${origin}/api/oauth/callback`;
  const code = url.searchParams.get('code') || '';
  const stateParam = url.searchParams.get('state') || '';
  const oauthErr = url.searchParams.get('error') || '';

  const state = verifyOAuthState(stateParam);
  const returnTo = state?.returnTo === '/pocket' ? '/pocket' : '/';

  if (oauthErr) {
    return NextResponse.redirect(`${origin}${returnTo}?oauth_error=${encodeURIComponent('Anmeldung abgebrochen: ' + oauthErr)}`);
  }
  if (!state || !code) {
    return NextResponse.redirect(`${origin}${returnTo}?oauth_error=${encodeURIComponent('Ungültige oder abgelaufene OAuth-Anfrage.')}`);
  }

  try {
    const supabase = getSupabaseAdmin();
    const tokenInfo = await exchangeCodeForTokens(state.provider, code, redirectUri);
    let targetAccountId = state.accountId;
    let accountRow: any = null;

    if (state.intent === 'link') {
      const { data } = await supabase
        .from('tw_accounts')
        .select('*')
        .eq('account_id', targetAccountId)
        .maybeSingle();

      if (!data) {
        return NextResponse.redirect(`${origin}${returnTo}?oauth_error=${encodeURIComponent('Konto zum Verknüpfen nicht gefunden.')}`);
      }
      accountRow = data;

      // Falls am Konto noch keine Recovery-E-Mail steht, direkt die OAuth-Mail übernehmen
      if (!accountRow.email && tokenInfo.providerEmail) {
        await supabase
          .from('tw_accounts')
          .update({ email: tokenInfo.providerEmail })
          .eq('account_id', targetAccountId);
      }
    } else {
      // LOGIN-MODUS: Bestehende OAuth-Verbindung oder passende Konten-E-Mail suchen
      const { data: connHit } = await supabase
        .from('tw_oauth_connections')
        .select('account_id')
        .eq('provider', state.provider)
        .or(
          tokenInfo.providerUserId
            ? `provider_user_id.eq.${tokenInfo.providerUserId},provider_email.ilike.${tokenInfo.providerEmail}`
            : `provider_email.ilike.${tokenInfo.providerEmail}`
        )
        .limit(1)
        .maybeSingle();

      if (connHit?.account_id) {
        targetAccountId = connHit.account_id;
      } else if (tokenInfo.providerEmail) {
        const { data: mailAcc } = await supabase
          .from('tw_accounts')
          .select('account_id')
          .ilike('email', tokenInfo.providerEmail)
          .maybeSingle();
        if (mailAcc?.account_id) targetAccountId = mailAcc.account_id;
      }

      if (targetAccountId) {
        const { data } = await supabase
          .from('tw_accounts')
          .select('*')
          .eq('account_id', targetAccountId)
          .maybeSingle();
        accountRow = data;
      }

      // Falls noch kein Konto existiert -> automatisch neues Familienkonto anlegen
      if (!accountRow) {
        const baseSlug = (tokenInfo.providerEmail.split('@')[0] || 'familie')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '')
          .slice(0, 18) || 'familie';
        let candidateId = baseSlug;
        const { data: taken } = await supabase
          .from('tw_accounts')
          .select('account_id')
          .eq('account_id', candidateId)
          .maybeSingle();
        if (taken) {
          candidateId = `${baseSlug}_${crypto.randomBytes(2).toString('hex')}`;
        }

        const randomPass = crypto.randomBytes(16).toString('hex');
        const familyTitle = tokenInfo.displayName ? `Familie ${tokenInfo.displayName.split(' ').slice(-1)[0]}` : `Familie ${candidateId}`;

        const { data: inserted, error: insErr } = await supabase
          .from('tw_accounts')
          .insert({
            account_id: candidateId,
            auth_hash: sha256(randomPass),
            email: tokenInfo.providerEmail,
            state: { isConfigured: true, familyName: familyTitle, currentTheme: 'metal' },
            calendars: {}
          })
          .select('*')
          .single();

        if (insErr) throw insErr;
        accountRow = inserted;
        targetAccountId = candidateId;
      }
    }

    // Bestehenden Refresh-Token erhalten, falls Provider bei Re-Consent keinen neuen mitgibt
    const targetMemberId = state.intent === 'link' ? (state.memberId || 'account') : 'account';
    const { data: existingConn } = await supabase
      .from('tw_oauth_connections')
      .select('refresh_token, calendar_id, calendar_name')
      .eq('account_id', targetAccountId)
      .eq('member_id', targetMemberId)
      .eq('provider', state.provider)
      .maybeSingle();

    const finalRefreshToken = tokenInfo.refreshToken || existingConn?.refresh_token || '';

    const { error: upsertErr } = await supabase.from('tw_oauth_connections').upsert(
      {
        account_id: targetAccountId,
        member_id: targetMemberId,
        provider: state.provider,
        provider_user_id: tokenInfo.providerUserId,
        provider_email: tokenInfo.providerEmail,
        access_token: tokenInfo.accessToken,
        refresh_token: finalRefreshToken,
        token_expires_at: tokenInfo.expiresAt,
        calendar_id: existingConn?.calendar_id || 'primary',
        calendar_name: existingConn?.calendar_name || (state.provider === 'google' ? 'Hauptkalender (Google)' : 'Hauptkalender (Outlook)'),
        scopes: tokenInfo.scopes,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'account_id,member_id,provider' }
    );
    if (upsertErr) throw upsertErr;

    const redirectUrl = `${origin}${returnTo}?oauth_ok=${encodeURIComponent(state.provider)}&oauth_intent=${encodeURIComponent(state.intent)}&oauth_member=${encodeURIComponent(targetMemberId)}`;
    const response = NextResponse.redirect(redirectUrl);

    // Bei Login-Intent sicheres 60-Sekunden-Handoff-Cookie setzen (kein Token in der URL!)
    if (state.intent === 'login' && accountRow) {
      const signedToken = issueSignedSessionToken(targetAccountId, accountRow.auth_hash);
      const handoff = Buffer.from(
        JSON.stringify({
          accountId: targetAccountId,
          authKey: signedToken,
          familyName: accountRow?.state?.familyName || `Familie ${targetAccountId}`,
          provider: state.provider,
          email: tokenInfo.providerEmail
        })
      ).toString('base64url');

      response.cookies.set('tw_oauth_handoff', handoff, {
        httpOnly: true,
        secure: origin.startsWith('https://'),
        sameSite: 'lax',
        path: '/',
        maxAge: 60
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.redirect(
      `${origin}${returnTo}?oauth_error=${encodeURIComponent(err?.message || 'OAuth-Verbindung fehlgeschlagen.')}`
    );
  }
}
