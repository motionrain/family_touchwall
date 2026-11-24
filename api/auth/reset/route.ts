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

  if (!rawUrl || !key) {
    throw new Error('SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.');
  }
  return createClient(new URL(rawUrl).origin, key, { auth: { persistSession: false } });
}

function sha256(val: string) {
  return crypto.createHash('sha256').update(String(val || '').trim()).digest('hex');
}

function normalizeRecoveryCode(raw: string) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function generateReadableRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `TW-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

function verifySignedSessionToken(token: string, expectedAccountId: string, authHash: string) {
  if (!token || !token.startsWith('tws_')) return false;
  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) return false;
  const parts = token.slice(4).split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  if (sig !== expectedSig) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (parsed.a !== expectedAccountId) return false;
    if (parsed.h && authHash && parsed.h !== String(authHash).slice(0, 12)) return false;
    return true;
  } catch {
    return false;
  }
}

async function findAccountByIdentifier(supabase: any, rawIdentifier: string) {
  const clean = String(rawIdentifier || '').trim().toLowerCase();
  if (!clean) return null;

  // 1. Direkte Suche über account_id
  const byId = await supabase
    .from('tw_accounts')
    .select('*')
    .eq('account_id', clean)
    .maybeSingle();
  if (byId.data) return byId.data;

  // 2. Suche über hinterlegte E-Mail-Adresse
  if (clean.includes('@')) {
    const byMail = await supabase
      .from('tw_accounts')
      .select('*')
      .ilike('email', clean)
      .maybeSingle();
    if (byMail.data) return byMail.data;

    // 3. Fallback: Suche über verknüpfte Google/Outlook OAuth-E-Mail
    const byOauth = await supabase
      .from('tw_oauth_connections')
      .select('account_id')
      .ilike('provider_email', clean)
      .limit(1)
      .maybeSingle();
    if (byOauth.data?.account_id) {
      const acc = await supabase
        .from('tw_accounts')
        .select('*')
        .eq('account_id', byOauth.data.account_id)
        .maybeSingle();
      if (acc.data) return acc.data;
    }
  }

  return null;
}

async function sendResetEmailViaResend(toEmail: string, accountId: string, resetCode: string) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!apiKey || !toEmail) return { sent: false, reason: 'no_api_key' };

  const fromAddr = (process.env.RESET_EMAIL_FROM || 'Touchwall <onboarding@resend.dev>').trim();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromAddr,
      to: [toEmail],
      subject: `🔑 Dein Touchwall Reset-Code: ${resetCode}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;background:#0f172a;color:#f8fafc;border-radius:16px;">
          <h2 style="margin-top:0;color:#38bdf8;">🔑 Passwort zurücksetzen</h2>
          <p>Für dein Touchwall-Konto <strong>${accountId}</strong> wurde ein Passwort-Reset angefordert.</p>
          <div style="font-size:32px;font-weight:900;letter-spacing:6px;text-align:center;padding:18px;margin:20px 0;background:#1e293b;border:2px solid #38bdf8;border-radius:12px;color:#ffffff;">
            ${resetCode}
          </div>
          <p style="font-size:13px;color:#94a3b8;">Der Code ist 15 Minuten gültig. Falls du den Reset nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
        </div>
      `
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { sent: false, reason: errText || `HTTP ${res.status}` };
  }
  return { sent: true };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action || '').trim();
    const supabase = getSupabaseAdmin();

    // ------------------------------------------------------------------------
    // 1. RESET ANFORDERN (Sendet 6-stelligen Code per Mail oder prüft Recovery)
    // ------------------------------------------------------------------------
    if (action === 'requestReset') {
      const identifier = String(body.identifier || '').trim();
      if (!identifier) {
        return NextResponse.json({ ok: false, error: 'Bitte Benutzername oder E-Mail-Adresse eingeben.' }, { status: 400 });
      }

      const account = await findAccountByIdentifier(supabase, identifier);
      if (!account) {
        return NextResponse.json({ ok: false, error: 'Kein Konto mit diesem Benutzernamen oder dieser E-Mail gefunden.' }, { status: 404 });
      }

      const sixDigitCode = String(crypto.randomInt(100000, 999999));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: upErr } = await supabase
        .from('tw_accounts')
        .update({
          reset_code_hash: sha256(sixDigitCode),
          reset_expires_at: expiresAt
        })
        .eq('account_id', account.account_id);

      if (upErr) throw upErr;

      // Ziel-E-Mail ermitteln (hinterlegte E-Mail oder verknüpfte OAuth-Mail)
      let targetEmail = String(account.email || '').trim().toLowerCase();
      if (!targetEmail) {
        const { data: oauthMail } = await supabase
          .from('tw_oauth_connections')
          .select('provider_email')
          .eq('account_id', account.account_id)
          .neq('provider_email', '')
          .limit(1)
          .maybeSingle();
        if (oauthMail?.provider_email) targetEmail = String(oauthMail.provider_email).trim().toLowerCase();
      }

      const mailRes = targetEmail
        ? await sendResetEmailViaResend(targetEmail, account.account_id, sixDigitCode)
        : { sent: false, reason: 'no_email' };

      const maskedEmail = targetEmail
        ? targetEmail.replace(/(^.).*(@.*$)/, '$1***$2')
        : '';

      return NextResponse.json({
        ok: true,
        accountId: account.account_id,
        emailSent: Boolean(mailRes.sent),
        maskedEmail,
        hasRecoveryCode: Boolean(account.recovery_hash),
        message: mailRes.sent
          ? `6-stelliger Reset-Code wurde an ${maskedEmail} gesendet (15 Min. gültig).`
          : account.recovery_hash
          ? 'Gib jetzt deinen gespeicherten Notfall-Recovery-Code (TW-...) ein, um ein neues Passwort zu setzen.'
          : 'Für dieses Konto ist noch kein Mail-Versand (RESEND_API_KEY) oder Recovery-Code hinterlegt. Falls Google/Outlook verknüpft ist, kannst du dich damit direkt einloggen.'
      });
    }

    // ------------------------------------------------------------------------
    // 2. RESET BESTÄTIGEN (6-stelliger Mail-Code ODER Notfall-Recovery-Code)
    // ------------------------------------------------------------------------
    if (action === 'confirmReset') {
      const identifier = String(body.identifier || '').trim();
      const rawCode = String(body.code || '').trim();
      const newPassword = String(body.newPassword || '').trim();

      if (!identifier || !rawCode || newPassword.length < 4) {
        return NextResponse.json(
          { ok: false, error: 'Bitte Konto, Reset-/Recovery-Code und ein neues Passwort (mind. 4 Zeichen) angeben.' },
          { status: 400 }
        );
      }

      const account = await findAccountByIdentifier(supabase, identifier);
      if (!account) {
        return NextResponse.json({ ok: false, error: 'Konto nicht gefunden.' }, { status: 404 });
      }

      // Prüfung A: 6-stelliger E-Mail-Reset-Code (zeitlich begrenzt)
      const nowMs = Date.now();
      const expMs = account.reset_expires_at ? new Date(account.reset_expires_at).getTime() : 0;
      const matchesEmailCode =
        Boolean(account.reset_code_hash) &&
        expMs > nowMs &&
        sha256(rawCode.replace(/\s+/g, '')) === account.reset_code_hash;

      // Prüfung B: Persönlicher Notfall-Recovery-Code (TW-XXXX-XXXX-XXXX)
      const normRec = normalizeRecoveryCode(rawCode);
      const matchesRecoveryCode =
        Boolean(account.recovery_hash) &&
        normRec.length >= 10 &&
        sha256(normRec) === account.recovery_hash;

      if (!matchesEmailCode && !matchesRecoveryCode) {
        return NextResponse.json(
          { ok: false, error: 'Der eingegebene Reset- oder Recovery-Code ist ungültig oder abgelaufen.' },
          { status: 401 }
        );
      }

      const { error: upErr } = await supabase
        .from('tw_accounts')
        .update({
          auth_hash: sha256(newPassword),
          reset_code_hash: '',
          reset_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('account_id', account.account_id);

      if (upErr) throw upErr;

      return NextResponse.json({
        ok: true,
        accountId: account.account_id,
        message: 'Passwort wurde erfolgreich geändert! Du kannst dich jetzt neu anmelden.'
      });
    }

    // ------------------------------------------------------------------------
    // 3. E-MAIL, PASSWORT & NOTFALL-RECOVERY-CODE VERWALTEN (EINGELOGGT)
    // ------------------------------------------------------------------------
    if (action === 'updateSecurity' || action === 'getSecurityStatus') {
      const accountId = String(body.accountId || '').trim().toLowerCase();
      const authKey = String(body.authKey || '').trim();
      if (!accountId || !authKey) {
        return NextResponse.json({ ok: false, error: 'Anmeldung erforderlich.' }, { status: 401 });
      }

      const { data: account, error: accErr } = await supabase
        .from('tw_accounts')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      if (accErr) throw accErr;
      if (!account) return NextResponse.json({ ok: false, error: 'Konto nicht gefunden.' }, { status: 404 });

      const authValid =
        sha256(authKey) === account.auth_hash ||
        verifySignedSessionToken(authKey, accountId, account.auth_hash);

      if (!authValid) {
        return NextResponse.json({ ok: false, error: 'Authentifizierung fehlgeschlagen.' }, { status: 401 });
      }

      if (action === 'getSecurityStatus') {
        const { data: conns } = await supabase
          .from('tw_oauth_connections')
          .select('member_id, provider, provider_email, calendar_id, calendar_name, updated_at')
          .eq('account_id', accountId);

        return NextResponse.json({
          ok: true,
          email: account.email || '',
          hasRecoveryCode: Boolean(account.recovery_hash),
          oauthConnections: conns || [],
          oauthProvidersReady: {
            google: Boolean((process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim() && (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim()),
            microsoft: Boolean((process.env.MICROSOFT_OAUTH_CLIENT_ID || '').trim() && (process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '').trim())
          }
        });
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      let generatedRecoveryCode: string | null = null;

      if (typeof body.email === 'string') {
        updates.email = body.email.trim().toLowerCase();
      }
      if (body.generateRecoveryCode) {
        generatedRecoveryCode = generateReadableRecoveryCode();
        updates.recovery_hash = sha256(normalizeRecoveryCode(generatedRecoveryCode));
      }
      if (typeof body.newPassword === 'string' && body.newPassword.trim().length >= 4) {
        updates.auth_hash = sha256(body.newPassword.trim());
      }

      const { error: saveErr } = await supabase
        .from('tw_accounts')
        .update(updates)
        .eq('account_id', accountId);

      if (saveErr) throw saveErr;

      return NextResponse.json({
        ok: true,
        email: updates.email !== undefined ? updates.email : (account.email || ''),
        hasRecoveryCode: Boolean(updates.recovery_hash || account.recovery_hash),
        recoveryCode: generatedRecoveryCode
      });
    }

    return NextResponse.json({ ok: false, error: 'Unbekannte Aktion: ' + action }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Reset-Serverfehler' }, { status: 500 });
  }
}
