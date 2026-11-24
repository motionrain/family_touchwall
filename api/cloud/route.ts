// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// 1. SUPABASE ADMIN-CLIENT, AUTH-, ELTERN-PIN- & RECOVERY-HELFER
// ============================================================================
function getCleanSupabaseUrl() {
  const rawUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/^["']|["']$/g, '');

  if (!rawUrl) {
    throw new Error('SUPABASE_URL fehlt in den Vercel-Umgebungsvariablen.');
  }

  let cleanUrl = rawUrl;
  try {
    cleanUrl = new URL(rawUrl).origin;
  } catch {
    throw new Error(`Ungültige SUPABASE_URL in Vercel: "${rawUrl}"`);
  }

  if (!cleanUrl.includes('supabase.co')) {
    throw new Error(`SUPABASE_URL zeigt nicht auf *.supabase.co, sondern auf: ${cleanUrl}`);
  }
  return cleanUrl;
}

function getPublicAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  )
    .trim()
    .replace(/^["']|["']$/g, '');
}

function getSupabaseAdmin() {
  const cleanUrl = getCleanSupabaseUrl();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '');

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt in den Vercel-Umgebungsvariablen.');
  }
  return createClient(cleanUrl, key, { auth: { persistSession: false } });
}

function hashAuthKey(val: string) {
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

// Prüft sowohl klassische Passwort-Hashes als auch signierte OAuth-Session-Tokens (tws_...)
function verifyAccountAuth(authKey: string, accountId: string, storedHash: string) {
  const cleanKey = String(authKey || '').trim();
  if (!cleanKey || !storedHash) return false;
  if (hashAuthKey(cleanKey) === storedHash) return true;

  if (!cleanKey.startsWith('tws_')) return false;
  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) return false;

  const parts = cleanKey.slice(4).split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  if (sig !== expectedSig) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (parsed.a !== accountId) return false;
    if (parsed.h && parsed.h !== String(storedHash).slice(0, 12)) return false;
    return true;
  } catch {
    return false;
  }
}

// Signiertes, zeitlich begrenztes Eltern-Admin-Token (twa_...)
function signAdminToken(accountId: string, adminPinHash: string, ttlMs = 15 * 60 * 1000) {
  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) throw new Error('Server-Secret für Admin-Token fehlt.');
  const expiresAt = Date.now() + ttlMs;
  const payloadB64 = Buffer.from(
    JSON.stringify({
      a: accountId,
      h: String(adminPinHash).slice(0, 12),
      exp: expiresAt
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return { token: `twa_${payloadB64}.${sig}`, expiresAt };
}

function verifyAdminToken(token: string, accountId: string, adminPinHash: string) {
  const clean = String(token || '').trim();
  if (!clean.startsWith('twa_') || !adminPinHash) return false;

  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) return false;

  const parts = clean.slice(4).split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (parsed.a !== accountId) return false;
    if (parsed.h !== String(adminPinHash).slice(0, 12)) return false;
    if (!parsed.exp || Date.now() > Number(parsed.exp)) return false;
    return true;
  } catch {
    return false;
  }
}

// Prüft, ob ein Mitglied als Eltern/Admin geschützt ist

// ============================================================================
// PERSÖNLICHE MITGLIEDER-LOGINS (tw_member_logins), SESSION-TOKENS & GASTMODUS
// ============================================================================
function normalizeMemberLoginName(raw: string) {
  return String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

function normalizeFamilyLookupId(raw: string) {
  return String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function signAccountSessionToken(accountId: string, storedHash: string) {
  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) throw new Error('Server-Secret für Konto-Session-Token fehlt.');
  const payloadB64 = Buffer.from(
    JSON.stringify({ a: accountId, h: String(storedHash || '').slice(0, 12), iat: Date.now() })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `tws_${payloadB64}.${sig}`;
}

function getMemberRoleFromState(accountRow: any, memberId: string): 'admin' | 'child' {
  const cleanId = String(memberId || '').trim().toLowerCase();
  if (!cleanId || cleanId === 'all') return 'admin';
  const list = Array.isArray(accountRow?.state?.members) ? accountRow.state.members : [];
  const found = list.find((m: any) => String(m?.id || '').toLowerCase() === cleanId);
  if (!found) return 'child';
  if (found.accessRole === 'admin') return 'admin';
  if (found.accessRole === 'child') return 'child';
  const roleLower = String(found.role || '').toLowerCase();
  if (
    roleLower.includes('eltern') ||
    roleLower.includes('vater') ||
    roleLower.includes('mutter') ||
    roleLower.includes('papa') ||
    roleLower.includes('mama') ||
    roleLower.includes('admin')
  ) {
    return 'admin';
  }
  return 'child';
}

function findPrimaryAdminMemberId(accountRow: any): string {
  const list = Array.isArray(accountRow?.state?.members) ? accountRow.state.members : [];
  const nonAll = list.filter((m: any) => m && m.id && String(m.id).toLowerCase() !== 'all');
  const firstAdmin = nonAll.find((m: any) => getMemberRoleFromState(accountRow, m.id) === 'admin');
  return String(firstAdmin?.id || nonAll[0]?.id || 'hans');
}

function signMemberSessionToken(accountId: string, memberId: string, role: 'admin' | 'child', ttlMs = 30 * 24 * 60 * 60 * 1000) {
  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) throw new Error('Server-Secret für Mitglieder-Token fehlt.');
  const expiresAt = Date.now() + ttlMs;
  const payloadB64 = Buffer.from(
    JSON.stringify({ a: accountId, m: memberId, r: role, exp: expiresAt })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return { token: `twm_${payloadB64}.${sig}`, expiresAt };
}

function verifyMemberSessionToken(token: string, accountId: string) {
  const clean = String(token || '').trim();
  if (!clean.startsWith('twm_')) return null;
  const secret = (process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) return null;
  const parts = clean.slice(4).split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (parsed.a !== accountId) return null;
    if (!parsed.exp || Date.now() > Number(parsed.exp)) return null;
    return { memberId: String(parsed.m || ''), role: parsed.r === 'admin' ? 'admin' : 'child' };
  } catch {
    return null;
  }
}

async function resolveAccountByFamilyInput(supabase: any, rawFamilyInput: string) {
  const rawTrim = String(rawFamilyInput || '').trim();
  const cleanId = normalizeFamilyLookupId(rawTrim);
  if (!cleanId) return null;

  const { data: exactRow, error: exactErr } = await supabase
    .from('tw_accounts')
    .select('*')
    .eq('account_id', cleanId)
    .maybeSingle();

  if (exactErr) throw exactErr;
  if (exactRow) return exactRow;

  // Fallback: Suche nach Anzeigename (z.B. "Familie Richter" -> findet zugehörige Familien-ID)
  const { data: allRows, error: listErr } = await supabase
    .from('tw_accounts')
    .select('*')
    .limit(200);
  if (listErr || !Array.isArray(allRows)) return null;

  const targetLower = rawTrim.toLowerCase();
  const targetStripped = targetLower.replace(/^familie\s+/i, '').trim();

  return (
    allRows.find((r: any) => {
      const fName = String(r?.state?.familyName || '').trim().toLowerCase();
      const fStripped = fName.replace(/^familie\s+/i, '').trim();
      const accLower = String(r?.account_id || '').trim().toLowerCase();
      return (
        fName === targetLower ||
        (targetStripped && (fStripped === targetStripped || accLower === targetStripped || accLower === targetStripped + 's'))
      );
    }) || null
  );
}

async function loadMemberLoginsMap(supabase: any, accountId: string) {
  try {
    const { data, error } = await supabase
      .from('tw_member_logins')
      .select('member_id, username, password_hash')
      .eq('account_id', accountId);
    if (error || !Array.isArray(data)) return {};
    const map: Record<string, { username: string; hasPassword: boolean; passwordHash: string }> = {};
    data.forEach((row: any) => {
      if (row?.member_id) {
        map[String(row.member_id)] = {
          username: String(row.username || ''),
          hasPassword: Boolean(row.password_hash),
          passwordHash: String(row.password_hash || '')
        };
      }
    });
    return map;
  } catch {
    return {};
  }
}

function buildPublicMemberLoginsSummary(loginMap: Record<string, any>) {
  const out: Record<string, { username: string; hasPassword: boolean }> = {};
  Object.keys(loginMap || {}).forEach(mid => {
    out[mid] = {
      username: String(loginMap[mid]?.username || ''),
      hasPassword: Boolean(loginMap[mid]?.hasPassword)
    };
  });
  return out;
}

function sanitizeSkillBoardPayload(sb: any) {
  if (!sb || typeof sb !== 'object') return sb;
  const players = sb.playersData && typeof sb.playersData === 'object' ? sb.playersData : {};
  const cleanPlayers: Record<string, any> = {};
  Object.keys(players).forEach(pid => {
    const p = players[pid] || {};
    const { pin: _removedPin, ...rest } = p;
    cleanPlayers[pid] = rest;
  });
  const { activePlayerId: _removedActive, ...restSb } = sb;
  return { ...restSb, playersData: cleanPlayers };
}

function isMemberAdminProtected(accountRow: any, memberId: string) {
  const cleanId = String(memberId || '').trim().toLowerCase();
  if (!cleanId || cleanId === 'all') return true;
  const list = Array.isArray(accountRow?.state?.members) ? accountRow.state.members : [];
  const found = list.find((m: any) => String(m?.id || '').toLowerCase() === cleanId);
  if (!found) return false;
  if (found.accessRole === 'child') return false;
  if (found.accessRole === 'admin') return true;
  // Standard-Fallback für bestehende Profile vor der ersten Rollen-Zuweisung
  const roleLower = String(found.role || '').toLowerCase();
  return roleLower.includes('eltern') || roleLower.includes('papa') || roleLower.includes('mama') || roleLower.includes('admin');
}

// Schützt sicherheitsrelevante Felder in saveState / saveDriveAndSync, wenn kein Eltern-Token vorliegt
function sanitizeStateForNonAdmin(incomingState: any, existingState: any) {
  const inc = incomingState && typeof incomingState === 'object' ? incomingState : {};
  const prev = existingState && typeof existingState === 'object' ? existingState : {};

  const mergedSkillBoard = inc.skillBoardData
    ? {
        ...inc.skillBoardData,
        // Kinder dürfen XP sammeln, aber keine 30 Ränge oder XP-Grenzen umschreiben
        customRanks: prev?.skillBoardData?.customRanks || inc.skillBoardData.customRanks
      }
    : prev.skillBoardData;

  return {
    ...inc,
    members: Array.isArray(prev.members) && prev.members.length > 0 ? prev.members : inc.members,
    todoistConfig: prev.todoistConfig !== undefined ? prev.todoistConfig : inc.todoistConfig,
    calendars: prev.calendars !== undefined ? prev.calendars : inc.calendars,
    appsScriptUrl: prev.appsScriptUrl !== undefined ? prev.appsScriptUrl : inc.appsScriptUrl,
    currentTheme: prev.currentTheme !== undefined ? prev.currentTheme : inc.currentTheme,
    customLogoUrl: prev.customLogoUrl !== undefined ? prev.customLogoUrl : inc.customLogoUrl,
    skillBoardData: mergedSkillBoard
  };
}

async function broadcastSync(
  supabase: any,
  accountId: string,
  sourceClientId?: string,
  scope: 'state' | 'calendar' | 'all' = 'state'
) {
  if (!accountId) return;
  const topic = `tw-sync-${accountId}`;
  const payload = { ts: Date.now(), clientId: sourceClientId || '', scope };

  if (supabase && typeof supabase.channel === 'function') {
    const channel = supabase.channel(topic);
    try {
      if (typeof channel?.httpSend === 'function') {
        const res = await channel.httpSend('sync', payload);
        if (res?.success !== false) return;
      }
    } catch {
      // Weiter zum REST-Fallback
    } finally {
      await supabase.removeChannel(channel).catch(() => {});
    }
  }

  try {
    const cleanUrl = getCleanSupabaseUrl();
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/^["']|["']$/g, '');
    if (!cleanUrl || !key) return;

    const headers: Record<string, string> = {
      apikey: key,
      'Content-Type': 'application/json'
    };
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;

    await fetch(`${cleanUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages: [{ topic, event: 'sync', payload }] })
    });
  } catch {}
}

// ============================================================================
// 2. VORRAT & MÜLLEIMER (tw_pantry_items)
// ============================================================================
const KNOWN_PANTRY_KEYS = new Set([
  'id', 'name', 'barcode', 'quantity', 'location', 'category', 'glutenFree',
  'expiryDate', 'customEmoji', 'imageUrl', 'reason', 'reasonLabel',
  'addedAt', 'addedTimestamp', 'trashedAt', 'trashedTimestamp',
  'fromMobile', 'updatedAt'
]);

function normalizeGfValue(val: any) {
  if (val === true || val === 'yes') return 'yes';
  if (val === false || val === 'no') return 'no';
  return 'auto';
}

function mapPantryItemToRow(accountId: string, item: any, status: 'stock' | 'trash') {
  const extra: Record<string, any> = {};
  Object.keys(item || {}).forEach(k => {
    if (!KNOWN_PANTRY_KEYS.has(k) && item[k] !== undefined) extra[k] = item[k];
  });

  return {
    account_id: accountId,
    id: String(item.id),
    status,
    name: String(item.name || 'Produkt').trim(),
    barcode: String(item.barcode || '').trim(),
    quantity: String(item.quantity || '1x').trim() || '1x',
    location: String(item.location || 'fridge').trim() || 'fridge',
    category: String(item.category || 'produce').trim() || 'produce',
    gluten_free: normalizeGfValue(item.glutenFree),
    expiry_date: String(item.expiryDate || '').trim(),
    custom_emoji: String(item.customEmoji || '').trim(),
    image_url: String(item.imageUrl || '').trim(),
    reason: String(item.reason || '').trim(),
    reason_label: String(item.reasonLabel || '').trim(),
    added_at: String(item.addedAt || '').trim(),
    added_timestamp: Math.trunc(Number(item.addedTimestamp) || 0),
    trashed_at: String(item.trashedAt || '').trim(),
    trashed_timestamp: Math.trunc(Number(item.trashedTimestamp) || 0),
    from_mobile: Boolean(item.fromMobile),
    updated_at: Math.trunc(Number(item.updatedAt) || Date.now()),
    extra
  };
}

function mapRowToPantryItem(row: any) {
  return {
    ...(row.extra && typeof row.extra === 'object' ? row.extra : {}),
    id: row.id,
    name: row.name,
    barcode: row.barcode || '',
    quantity: row.quantity || '1x',
    location: row.location || 'fridge',
    category: row.category || 'produce',
    glutenFree: row.gluten_free || 'auto',
    expiryDate: row.expiry_date || '',
    customEmoji: row.custom_emoji || '',
    imageUrl: row.image_url || '',
    reason: row.reason || '',
    reasonLabel: row.reason_label || '',
    addedAt: row.added_at || '',
    addedTimestamp: Number(row.added_timestamp || 0),
    trashedAt: row.trashed_at || '',
    trashedTimestamp: Number(row.trashed_timestamp || 0),
    fromMobile: Boolean(row.from_mobile),
    updatedAt: Number(row.updated_at || 0)
  };
}

function stripPantryFromState(stateObj: any) {
  const copy = { ...(stateObj || {}) };
  delete copy.pantryItems;
  delete copy.pantryTrash;
  copy.pantryMigrated = true;
  return copy;
}

async function syncPantryTableForAccount(supabase: any, accountId: string, stockList: any[], trashList: any[]) {
  const rowMap = new Map<string, any>();

  (Array.isArray(stockList) ? stockList : []).forEach(it => {
    if (it && it.id) rowMap.set(String(it.id), mapPantryItemToRow(accountId, it, 'stock'));
  });

  (Array.isArray(trashList) ? trashList : []).forEach(it => {
    if (!it || !it.id) return;
    const idStr = String(it.id);
    const trashRow = mapPantryItemToRow(accountId, it, 'trash');
    const existing = rowMap.get(idStr);
    if (!existing || trashRow.trashed_timestamp >= existing.updated_at) rowMap.set(idStr, trashRow);
  });

  const { data: existingRows, error: selErr } = await supabase
    .from('tw_pantry_items')
    .select('id')
    .eq('account_id', accountId);
  if (selErr) throw selErr;

  const allRows = Array.from(rowMap.values());
  for (let i = 0; i < allRows.length; i += 200) {
    const { error: upErr } = await supabase
      .from('tw_pantry_items')
      .upsert(allRows.slice(i, i + 200), { onConflict: 'account_id,id' });
    if (upErr) throw upErr;
  }

  const idsToDelete = (existingRows || [])
    .map((r: any) => String(r.id))
    .filter((id: string) => !rowMap.has(id));

  for (let i = 0; i < idsToDelete.length; i += 200) {
    const { error: delErr } = await supabase
      .from('tw_pantry_items')
      .delete()
      .eq('account_id', accountId)
      .in('id', idsToDelete.slice(i, i + 200));
    if (delErr) throw delErr;
  }
}

async function loadPantryForAccount(supabase: any, accountId: string, accountRow: any) {
  const { data: rows, error } = await supabase
    .from('tw_pantry_items')
    .select('*')
    .eq('account_id', accountId);
  if (error) throw error;

  const list = Array.isArray(rows) ? rows : [];
  const legacyStock = Array.isArray(accountRow?.state?.pantryItems) ? accountRow.state.pantryItems : [];
  const legacyTrash = Array.isArray(accountRow?.state?.pantryTrash) ? accountRow.state.pantryTrash : [];

  if (list.length === 0 && !accountRow?.state?.pantryMigrated && (legacyStock.length > 0 || legacyTrash.length > 0)) {
    await syncPantryTableForAccount(supabase, accountId, legacyStock, legacyTrash);
    await supabase
      .from('tw_accounts')
      .update({ state: stripPantryFromState(accountRow.state), updated_at: new Date().toISOString() })
      .eq('account_id', accountId);
    return { pantryItems: legacyStock, pantryTrash: legacyTrash };
  }

  return {
    pantryItems: list
      .filter((r: any) => r.status !== 'trash')
      .map(mapRowToPantryItem)
      .sort((a: any, b: any) => String(a.expiryDate || '9999').localeCompare(String(b.expiryDate || '9999'))),
    pantryTrash: list
      .filter((r: any) => r.status === 'trash')
      .map(mapRowToPantryItem)
      .sort((a: any, b: any) => Number(b.trashedTimestamp || 0) - Number(a.trashedTimestamp || 0))
  };
}

// ============================================================================
// 3. OAUTH TOKEN-REFRESH (GOOGLE & MICROSOFT/OUTLOOK) + GOOGLE SERVICE ACCOUNT
// ============================================================================
let cachedGoogleSaToken = { token: '', expiresAt: 0 };

function hasGoogleServiceAccount() {
  return Boolean(
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim() &&
    (process.env.GOOGLE_PRIVATE_KEY || '').trim()
  );
}

async function getGoogleServiceAccountToken() {
  if (!hasGoogleServiceAccount()) return null;
  if (cachedGoogleSaToken.token && Date.now() < cachedGoogleSaToken.expiresAt - 60000) {
    return cachedGoogleSaToken.token;
  }

  const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim().replace(/^["']|["']$/g, '');
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })
  ).toString('base64url');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(header + '.' + claim);
  const jwt = header + '.' + claim + '.' + signer.sign(privateKey, 'base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error('Google SA Auth fehlgeschlagen: ' + (data.error_description || data.error || res.status));
  }

  cachedGoogleSaToken = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3500) * 1000 };
  return data.access_token;
}

async function getValidOAuthAccessToken(supabase: any, conn: any) {
  if (!conn) return null;
  if (conn.access_token && Number(conn.token_expires_at || 0) > Date.now() + 90000) {
    return conn.access_token;
  }
  if (!conn.refresh_token) return conn.access_token || null;

  if (conn.provider === 'google') {
    const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
    const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim().replace(/^["']|["']$/g, '');
    if (!clientId || !clientSecret) return conn.access_token || null;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token'
      })
    });
    const json = await res.json();
    if (!res.ok || !json.access_token) {
      throw new Error('Google OAuth Refresh fehlgeschlagen: ' + (json.error_description || json.error || res.status));
    }

    const nextExp = Date.now() + Number(json.expires_in || 3500) * 1000;
    await supabase
      .from('tw_oauth_connections')
      .update({
        access_token: json.access_token,
        token_expires_at: nextExp,
        updated_at: new Date().toISOString()
      })
      .eq('account_id', conn.account_id)
      .eq('member_id', conn.member_id)
      .eq('provider', 'google');

    return json.access_token;
  }

  if (conn.provider === 'microsoft') {
    const msId = (process.env.MICROSOFT_OAUTH_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
    const msSecret = (process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '').trim().replace(/^["']|["']$/g, '');
    if (!msId || !msSecret) return conn.access_token || null;

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: msId,
        client_secret: msSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
        scope: 'openid email profile offline_access User.Read Calendars.ReadWrite'
      })
    });
    const json = await res.json();
    if (!res.ok || !json.access_token) {
      throw new Error('Outlook OAuth Refresh fehlgeschlagen: ' + (json.error_description || json.error || res.status));
    }

    const nextExp = Date.now() + Number(json.expires_in || 3500) * 1000;
    await supabase
      .from('tw_oauth_connections')
      .update({
        access_token: json.access_token,
        refresh_token: json.refresh_token || conn.refresh_token,
        token_expires_at: nextExp,
        updated_at: new Date().toISOString()
      })
      .eq('account_id', conn.account_id)
      .eq('member_id', conn.member_id)
      .eq('provider', 'microsoft');

    return json.access_token;
  }

  return null;
}

// ============================================================================
// 4. ZEITZONEN- & PAYLOAD-KONVERTIERUNG (GOOGLE + OUTLOOK / EUROPE/BERLIN)
// ============================================================================
function addDaysToDateStr(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function formatBerlinDateAndTime(isoStr: string) {
  const d = new Date(isoStr);
  const datePart = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
  const timePart = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
  return { datePart, timePart };
}

function parseTouchwallTimeRange(rawTimeInput: string) {
  const rawTime = String(rawTimeInput || 'Ganztägig').trim();
  const rangeMatch = rawTime.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  const singleMatch = rawTime.match(/(\d{1,2}):(\d{2})/);

  if (!rawTime || rawTime.toLowerCase().includes('ganztägig') || (!rangeMatch && !singleMatch)) {
    return { allDay: true };
  }

  if (rangeMatch) {
    return {
      allDay: false,
      startH: rangeMatch[1].padStart(2, '0'),
      startM: rangeMatch[2],
      endH: rangeMatch[3].padStart(2, '0'),
      endM: rangeMatch[4]
    };
  }
  const startH = singleMatch[1].padStart(2, '0');
  const startM = singleMatch[2];
  const endH = String((Number(startH) + 1) % 24).padStart(2, '0');
  return { allDay: false, startH, startM, endH, endM: startM };
}

function buildGoogleEventPayload(ev: any) {
  const title = String(ev.title || 'Termin').trim();
  const dateStr = String(ev.date || '').slice(0, 10);
  const t = parseTouchwallTimeRange(ev.time);

  if (t.allDay) {
    return {
      summary: title,
      start: { date: dateStr },
      end: { date: addDaysToDateStr(dateStr, 1) }
    };
  }
  return {
    summary: title,
    start: { dateTime: `${dateStr}T${t.startH}:${t.startM}:00`, timeZone: 'Europe/Berlin' },
    end: { dateTime: `${dateStr}T${t.endH}:${t.endM}:00`, timeZone: 'Europe/Berlin' }
  };
}

function buildOutlookEventPayload(ev: any) {
  const title = String(ev.title || 'Termin').trim();
  const dateStr = String(ev.date || '').slice(0, 10);
  const t = parseTouchwallTimeRange(ev.time);

  if (t.allDay) {
    return {
      subject: title,
      isAllDay: true,
      start: { dateTime: `${dateStr}T00:00:00`, timeZone: 'Europe/Berlin' },
      end: { dateTime: `${addDaysToDateStr(dateStr, 1)}T00:00:00`, timeZone: 'Europe/Berlin' }
    };
  }
  return {
    subject: title,
    isAllDay: false,
    start: { dateTime: `${dateStr}T${t.startH}:${t.startM}:00`, timeZone: 'Europe/Berlin' },
    end: { dateTime: `${dateStr}T${t.endH}:${t.endM}:00`, timeZone: 'Europe/Berlin' }
  };
}

function mapGoogleEventToTouchwall(gEv: any, memberId: string, calendarId: string, idPrefix = 'gcal') {
  let dateStr = '';
  let timeStr = 'Ganztägig';

  if (gEv.start?.date) {
    dateStr = gEv.start.date.slice(0, 10);
  } else if (gEv.start?.dateTime) {
    const startFmt = formatBerlinDateAndTime(gEv.start.dateTime);
    dateStr = startFmt.datePart;
    timeStr = gEv.end?.dateTime
      ? `${startFmt.timePart} - ${formatBerlinDateAndTime(gEv.end.dateTime).timePart}`
      : startFmt.timePart;
  }

  return {
    id: `${idPrefix}__${memberId}__${gEv.id}`,
    googleEventId: gEv.id,
    calendarId,
    title: gEv.summary || '(Ohne Titel)',
    date: dateStr,
    time: timeStr,
    member: memberId,
    notifyTime: '30m',
    notifyChannel: 'wall_push',
    notifyUsers: [memberId],
    fromGoogle: true
  };
}

function mapOutlookEventToTouchwall(msEv: any, memberId: string) {
  const startRaw = String(msEv.start?.dateTime || '');
  const endRaw = String(msEv.end?.dateTime || '');
  const dateStr = startRaw.slice(0, 10);
  let timeStr = 'Ganztägig';

  if (!msEv.isAllDay && startRaw.length >= 16) {
    const st = startRaw.slice(11, 16);
    const en = endRaw.length >= 16 ? endRaw.slice(11, 16) : '';
    timeStr = en ? `${st} - ${en}` : st;
  }

  return {
    id: `msoauth__${memberId}__${msEv.id}`,
    outlookEventId: msEv.id,
    title: msEv.subject || '(Ohne Titel)',
    date: dateStr,
    time: timeStr,
    member: memberId,
    notifyTime: '30m',
    notifyChannel: 'wall_push',
    notifyUsers: [memberId],
    fromOutlook: true
  };
}

function parseExternalEventId(eventId: string) {
  const parts = String(eventId || '').split('__');
  if (parts.length >= 3 && ['gcal', 'goauth', 'msoauth'].includes(parts[0])) {
    return { kind: parts[0], memberId: parts[1], remoteId: parts.slice(2).join('__') };
  }
  return { kind: 'local', memberId: '', remoteId: String(eventId || '') };
}

// ============================================================================
// 5. KOMBINIERTER KALENDER-SYNC (SUPABASE + GOOGLE OAUTH + OUTLOOK + SA)
// ============================================================================
async function loadOAuthConnectionsForAccount(supabase: any, accountId: string) {
  const { data, error } = await supabase
    .from('tw_oauth_connections')
    .select('*')
    .eq('account_id', accountId);
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

async function loadCombinedCalendarData(supabase: any, accountId: string, calendarsMap: Record<string, string>) {
  const status: Record<string, { ok: boolean; msg: string }> = {};
  const allEvents: any[] = [];

  const [dbRes, oauthConns] = await Promise.all([
    supabase.from('tw_calendar_events').select('*').eq('account_id', accountId),
    loadOAuthConnectionsForAccount(supabase, accountId)
  ]);

  if (dbRes.error) throw dbRes.error;

  (dbRes.data || []).forEach((row: any) => {
    allEvents.push({
      id: row.id,
      title: row.title,
      date: row.event_date,
      time: row.event_time || 'Ganztägig',
      member: row.member || 'all',
      notifyTime: row.notify_time || '30m',
      notifyChannel: row.notify_channel || 'wall_push',
      notifyUsers: Array.isArray(row.notify_users) ? row.notify_users : [row.member || 'all'],
      fromGoogle: false
    });
  });

  const timeMin = new Date(Date.now() - 30 * 86400000).toISOString();
  const timeMax = new Date(Date.now() + 365 * 86400000).toISOString();

  const memberOAuthConns = oauthConns.filter((c: any) => c.member_id && c.member_id !== 'account');
  const membersWithGoogleOAuth = new Set<string>();

  await Promise.all(
    memberOAuthConns.map(async (conn: any) => {
      try {
        const token = await getValidOAuthAccessToken(supabase, conn);
        if (!token) return;

        if (conn.provider === 'google') {
          membersWithGoogleOAuth.add(conn.member_id);
          const calId = String(conn.calendar_id || 'primary').trim();
          const url =
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events` +
            `?singleEvents=true&orderBy=startTime&maxResults=500` +
            `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;

          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const json = await res.json();
          if (!res.ok) {
            status[conn.member_id] = { ok: false, msg: 'Google OAuth: ' + (json?.error?.message || `HTTP ${res.status}`) };
            return;
          }
          const items = Array.isArray(json.items) ? json.items : [];
          items.forEach((gEv: any) => {
            if (gEv.status !== 'cancelled') {
              allEvents.push(mapGoogleEventToTouchwall(gEv, conn.member_id, calId, 'goauth'));
            }
          });
          status[conn.member_id] = { ok: true, msg: `Google OAuth aktiv (${items.length} Termine) ✓` };
        } else if (conn.provider === 'microsoft') {
          const url =
            `https://graph.microsoft.com/v1.0/me/calendarView` +
            `?startDateTime=${encodeURIComponent(timeMin)}&endDateTime=${encodeURIComponent(timeMax)}&$top=250`;

          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              Prefer: 'outlook.timezone="Europe/Berlin"'
            }
          });
          const json = await res.json();
          if (!res.ok) {
            status[conn.member_id] = { ok: false, msg: 'Outlook OAuth: ' + (json?.error?.message || `HTTP ${res.status}`) };
            return;
          }
          const items = Array.isArray(json.value) ? json.value : [];
          items.forEach((msEv: any) => {
            if (!msEv.isCancelled) {
              allEvents.push(mapOutlookEventToTouchwall(msEv, conn.member_id));
            }
          });
          const prevMsg = status[conn.member_id]?.ok ? status[conn.member_id].msg + ' + ' : '';
          status[conn.member_id] = { ok: true, msg: `${prevMsg}Outlook OAuth aktiv (${items.length} Termine) ✓` };
        }
      } catch (err: any) {
        status[conn.member_id] = { ok: false, msg: err?.message || 'OAuth-Abruffehler' };
      }
    })
  );

  const calEntries = Object.entries(calendarsMap || {}).filter(
    ([memberId, cid]) =>
      String(cid || '').trim() !== '' &&
      !String(cid).trim().startsWith('http') &&
      !String(cid).trim().startsWith('webcal') &&
      !membersWithGoogleOAuth.has(memberId)
  );

  if (calEntries.length > 0 && hasGoogleServiceAccount()) {
    let saToken: string | null = null;
    try {
      saToken = await getGoogleServiceAccountToken();
    } catch (err: any) {
      calEntries.forEach(([memberId]) => {
        if (!status[memberId]) status[memberId] = { ok: false, msg: 'Google Auth Fehler: ' + err.message };
      });
    }

    if (saToken) {
      await Promise.all(
        calEntries.map(async ([memberId, rawCalId]) => {
          const calId = String(rawCalId).split(',')[0].trim();
          try {
            const url =
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events` +
              `?singleEvents=true&orderBy=startTime&maxResults=500` +
              `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;

            const res = await fetch(url, { headers: { Authorization: `Bearer ${saToken}` } });
            const json = await res.json();
            if (!res.ok) {
              if (!status[memberId]) {
                status[memberId] = {
                  ok: false,
                  msg: res.status === 404 ? 'Kalender nicht freigegeben' : (json?.error?.message || `HTTP ${res.status}`)
                };
              }
              return;
            }
            const items = Array.isArray(json.items) ? json.items : [];
            items.forEach((gEv: any) => {
              if (gEv.status !== 'cancelled') {
                allEvents.push(mapGoogleEventToTouchwall(gEv, memberId, calId, 'gcal'));
              }
            });
            status[memberId] = { ok: true, msg: `Google Kalender aktiv (${items.length} Termine) ✓` };
          } catch (err: any) {
            if (!status[memberId]) status[memberId] = { ok: false, msg: err.message || 'Abruffehler' };
          }
        })
      );
    }
  }

  return { events: allEvents, calendars: calendarsMap || {}, status };
}

async function createEventForMember(
  supabase: any,
  accountId: string,
  ev: any,
  oauthConns: any[],
  currentCalendars: Record<string, string>
) {
  const memberId = String(ev.member || 'all');
  const gOAuth = oauthConns.find(c => c.member_id === memberId && c.provider === 'google');
  const msOAuth = oauthConns.find(c => c.member_id === memberId && c.provider === 'microsoft');

  if (gOAuth) {
    const token = await getValidOAuthAccessToken(supabase, gOAuth);
    const calId = String(gOAuth.calendar_id || 'primary').trim();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGoogleEventPayload(ev))
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error('Google OAuth Termin-Fehler: ' + (err?.error?.message || res.status));
    }
    return;
  }

  if (msOAuth) {
    const token = await getValidOAuthAccessToken(supabase, msOAuth);
    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildOutlookEventPayload(ev))
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error('Outlook OAuth Termin-Fehler: ' + (err?.error?.message || res.status));
    }
    return;
  }

  const targetCalId = String(currentCalendars[memberId] || '').split(',')[0].trim();
  if (targetCalId && !targetCalId.startsWith('http') && !targetCalId.startsWith('webcal') && hasGoogleServiceAccount()) {
    const saToken = await getGoogleServiceAccountToken();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalId)}/events`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${saToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGoogleEventPayload(ev))
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error('Google Termin konnte nicht erstellt werden: ' + (err?.error?.message || res.status));
    }
    return;
  }

  const { error } = await supabase.from('tw_calendar_events').upsert({
    id: String(ev.id || Date.now()),
    account_id: accountId,
    member: memberId,
    title: ev.title || 'Termin',
    event_date: ev.date,
    event_time: ev.time || 'Ganztägig',
    notify_time: ev.notifyTime || '30m',
    notify_channel: ev.notifyChannel || 'wall_push',
    notify_users: Array.isArray(ev.notifyUsers) ? ev.notifyUsers : [memberId],
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

async function deleteExternalOrLocalEvent(
  supabase: any,
  accountId: string,
  eventId: string,
  memberId: string,
  oauthConns: any[],
  currentCalendars: Record<string, string>
) {
  const parsed = parseExternalEventId(eventId);
  const ownerMember = parsed.memberId || memberId;

  if (parsed.kind === 'goauth') {
    const conn = oauthConns.find(c => c.member_id === ownerMember && c.provider === 'google');
    if (conn) {
      const token = await getValidOAuthAccessToken(supabase, conn);
      const calId = String(conn.calendar_id || 'primary').trim();
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(parsed.remoteId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
    }
    return;
  }

  if (parsed.kind === 'msoauth') {
    const conn = oauthConns.find(c => c.member_id === ownerMember && c.provider === 'microsoft');
    if (conn) {
      const token = await getValidOAuthAccessToken(supabase, conn);
      await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(parsed.remoteId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    }
    return;
  }

  if (parsed.kind === 'gcal') {
    const calId = String(currentCalendars[ownerMember] || '').split(',')[0].trim();
    if (calId && hasGoogleServiceAccount()) {
      const saToken = await getGoogleServiceAccountToken();
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(parsed.remoteId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${saToken}` } }
      );
    }
    return;
  }

  await supabase.from('tw_calendar_events').delete().eq('account_id', accountId).eq('id', eventId);
}

async function updateExternalOrLocalEvent(
  supabase: any,
  accountId: string,
  ev: any,
  oldMember: string,
  oauthConns: any[],
  currentCalendars: Record<string, string>
) {
  const parsed = parseExternalEventId(ev.id);
  const sameMember = String(oldMember || ev.member) === String(ev.member);

  if (sameMember && parsed.kind === 'goauth') {
    const conn = oauthConns.find(c => c.member_id === ev.member && c.provider === 'google');
    if (conn) {
      const token = await getValidOAuthAccessToken(supabase, conn);
      const calId = String(conn.calendar_id || 'primary').trim();
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(parsed.remoteId)}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildGoogleEventPayload(ev))
        }
      );
      return;
    }
  }

  if (sameMember && parsed.kind === 'msoauth') {
    const conn = oauthConns.find(c => c.member_id === ev.member && c.provider === 'microsoft');
    if (conn) {
      const token = await getValidOAuthAccessToken(supabase, conn);
      await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(parsed.remoteId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildOutlookEventPayload(ev))
      });
      return;
    }
  }

  if (sameMember && parsed.kind === 'gcal') {
    const calId = String(currentCalendars[ev.member] || '').split(',')[0].trim();
    if (calId && hasGoogleServiceAccount()) {
      const saToken = await getGoogleServiceAccountToken();
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(parsed.remoteId)}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${saToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildGoogleEventPayload(ev))
        }
      );
      return;
    }
  }

  if (!sameMember || parsed.kind !== 'local') {
    await deleteExternalOrLocalEvent(supabase, accountId, String(ev.id), oldMember, oauthConns, currentCalendars);
    await createEventForMember(supabase, accountId, { ...ev, id: String(Date.now()) }, oauthConns, currentCalendars);
    return;
  }

  const { error } = await supabase.from('tw_calendar_events').upsert({
    id: String(ev.id),
    account_id: accountId,
    member: ev.member || 'all',
    title: ev.title || 'Termin',
    event_date: ev.date,
    event_time: ev.time || 'Ganztägig',
    notify_time: ev.notifyTime || '30m',
    notify_channel: ev.notifyChannel || 'wall_push',
    notify_users: Array.isArray(ev.notifyUsers) ? ev.notifyUsers : [ev.member || 'all'],
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

// ============================================================================
// 6. STATUSCHECK + REALTIME-KONFIG (GET /api/cloud)
// ============================================================================
export async function GET() {
  try {
    const cleanUrl = getCleanSupabaseUrl();
    const anonKey = getPublicAnonKey();

    return NextResponse.json({
      ok: true,
      status: 'Touchwall Cloud API bereit (Turbo Live-Sync + Eltern-PIN)',
      supabaseHost: new URL(cleanUrl).host,
      supabaseKeyConfigured: Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()),
      realtimeConfigured: Boolean(cleanUrl && anonKey),
      googleConfigured: hasGoogleServiceAccount(),
      oauthProvidersReady: {
        google: Boolean((process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim() && (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim()),
        microsoft: Boolean((process.env.MICROSOFT_OAUTH_CLIENT_ID || '').trim() && (process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '').trim())
      },
      realtime: anonKey ? { url: cleanUrl, anonKey } : null
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Konfigurationsfehler' }, { status: 500 });
  }
}

// ============================================================================
// 7. HAUPT-ENDPOINT (POST /api/cloud)
// ============================================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action || '').trim();
    const rawFamilyInput = String(body.familyName || body.accountId || req.headers.get('x-account-id') || '').trim();
    let accountId = normalizeFamilyLookupId(body.accountId || req.headers.get('x-account-id') || rawFamilyInput);
    const authKey = String(body.authKey || req.headers.get('x-auth-key') || '').trim();
    const adminToken = String(body.adminToken || req.headers.get('x-admin-token') || '').trim();
    const memberToken = String(body.memberToken || req.headers.get('x-member-token') || '').trim();

    if (!accountId && !rawFamilyInput) {
      return NextResponse.json({ ok: false, error: 'Bitte Familien-Name / Familien-ID eingeben.' }, { status: 400 });
    }
    if (!authKey && !memberToken && action !== 'loginMember') {
      return NextResponse.json({ ok: false, error: 'authKey fehlt.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // ------------------------------------------------------------------------
    // REGISTER ACCOUNT
    // ------------------------------------------------------------------------
    if (action === 'registerAccount') {
      const { data: existing, error: exErr } = await supabase
        .from('tw_accounts')
        .select('account_id')
        .eq('account_id', accountId)
        .maybeSingle();

      if (exErr) throw exErr;
      if (existing) {
        return NextResponse.json({ ok: false, error: 'Dieser Benutzername ist bereits vergeben.' }, { status: 409 });
      }

      const payload = body.payload || {};
      const calendars = payload.calendars || {};
      const cleanEmail = String(body.email || payload.email || '').trim().toLowerCase();
      const recoveryCode = generateReadableRecoveryCode();
      const recoveryHash = hashAuthKey(normalizeRecoveryCode(recoveryCode));
      const initStock = Array.isArray(payload.pantryItems) ? payload.pantryItems : [];
      const initTrash = Array.isArray(payload.pantryTrash) ? payload.pantryTrash : [];

      const { error } = await supabase.from('tw_accounts').insert({
        account_id: accountId,
        auth_hash: hashAuthKey(authKey),
        email: cleanEmail,
        recovery_hash: recoveryHash,
        state: stripPantryFromState(payload),
        calendars
      });

      if (error) throw error;

      if (initStock.length > 0 || initTrash.length > 0) {
        await syncPantryTableForAccount(supabase, accountId, initStock, initTrash);
      }

      return NextResponse.json({ ok: true, state: payload, recoveryCode });
    }

    // ------------------------------------------------------------------------
    // KONTO LADEN & AUTH PRÜFEN (FAMILIEN-ID + PERSÖNLICHE MITGLIEDER-LOGINS)
    // ------------------------------------------------------------------------
    const accountRow = await resolveAccountByFamilyInput(supabase, rawFamilyInput || accountId);
    if (!accountRow) {
      return NextResponse.json(
        { ok: false, error: 'Familien-Konto nicht gefunden. Bitte Familien-Name / ID prüfen.' },
        { status: 404 }
      );
    }
    accountId = String(accountRow.account_id);

    const memberLoginsMap = await loadMemberLoginsMap(supabase, accountId);
    const hasMemberLogins = Object.keys(memberLoginsMap).length > 0;
    const verifiedMemberSession = verifyMemberSessionToken(memberToken, accountId);
    const isMainAccountAuth = Boolean(authKey && verifyAccountAuth(authKey, accountId, accountRow.auth_hash));
    const storedAdminPinHash = String(accountRow.admin_pin_hash || '').trim();
    const hasAdminPin = Boolean(storedAdminPinHash);
    const adminPinSecretHash = storedAdminPinHash || accountRow.auth_hash;

    // ------------------------------------------------------------------------
    // ACTION: loginMember (Familien-ID + Benutzername + Passwort/PIN)
    // ------------------------------------------------------------------------
    if (action === 'loginMember') {
      const targetMemberId = String(body.memberId || '').trim().toLowerCase();
      const candidateUser = normalizeMemberLoginName(body.username || '');
      const candidateSecret = String(body.password || body.pin || authKey || '').trim();

      if (!candidateUser && !targetMemberId) {
        return NextResponse.json({ ok: false, error: 'Bitte Benutzername eingeben.' }, { status: 400 });
      }
      if (!candidateSecret) {
        return NextResponse.json({ ok: false, error: 'Bitte Passwort oder PIN eingeben.' }, { status: 400 });
      }

      let matchedMemberId = '';
      let matchedUsername = candidateUser;

      // 1) Prüfe persönliche Zugangsdaten in tw_member_logins
      if (targetMemberId) {
        const entry = memberLoginsMap[targetMemberId];
        if (entry?.hasPassword && hashAuthKey(candidateSecret) === entry.passwordHash) {
          if (!candidateUser || !entry.username || normalizeMemberLoginName(entry.username) === candidateUser) {
            matchedMemberId = targetMemberId;
            matchedUsername = entry.username || targetMemberId;
          }
        }
        // Fallback für Hauptbenutzer (Ersteller) falls noch kein Eintrag in tw_member_logins existiert
        if (!matchedMemberId && targetMemberId === findPrimaryAdminMemberId(accountRow) && !entry?.hasPassword) {
          if (hashAuthKey(candidateSecret) === accountRow.auth_hash) {
            matchedMemberId = targetMemberId;
            matchedUsername = accountId;
          }
        }
        if (!matchedMemberId && !entry?.hasPassword && targetMemberId !== findPrimaryAdminMemberId(accountRow)) {
          return NextResponse.json(
            { ok: false, error: 'Für diese Person wurde unter Konten noch kein Passwort/PIN zugewiesen.' },
            { status: 401 }
          );
        }
      } else {
        for (const mid of Object.keys(memberLoginsMap)) {
          const entry = memberLoginsMap[mid];
          if (
            entry?.hasPassword &&
            normalizeMemberLoginName(entry.username) === candidateUser &&
            hashAuthKey(candidateSecret) === entry.passwordHash
          ) {
            matchedMemberId = mid;
            matchedUsername = entry.username;
            break;
          }
        }

        // Fallback: Ersteller meldet sich mit Familien-ID / Haupt-Passwort an
        if (!matchedMemberId && hashAuthKey(candidateSecret) === accountRow.auth_hash) {
          const primaryAdminId = findPrimaryAdminMemberId(accountRow);
          const primaryMember = (Array.isArray(accountRow?.state?.members) ? accountRow.state.members : []).find(
            (m: any) => String(m?.id || '').toLowerCase() === primaryAdminId.toLowerCase()
          );
          const primaryNameNorm = normalizeMemberLoginName(primaryMember?.name || '');
          if (
            candidateUser === accountId ||
            candidateUser === primaryAdminId.toLowerCase() ||
            (primaryNameNorm && candidateUser === primaryNameNorm)
          ) {
            matchedMemberId = primaryAdminId;
            matchedUsername = candidateUser;
          }
        }
      }

      if (!matchedMemberId) {
        return NextResponse.json(
          { ok: false, error: 'Benutzername oder Passwort / PIN ist falsch.' },
          { status: 401 }
        );
      }

      const role = getMemberRoleFromState(accountRow, matchedMemberId);
      const issuedMember = signMemberSessionToken(accountId, matchedMemberId, role);
      const accountSessionToken = signAccountSessionToken(accountId, accountRow.auth_hash);
      const autoAdminToken =
        role === 'admin'
          ? signAdminToken(accountId, adminPinSecretHash, 60 * 60 * 1000)
          : null;

      const skipCalendars = Boolean(body.skipCalendars);
      const memCalMap: Record<string, string> = {
        ...(accountRow.calendars || {}),
        ...(accountRow.state?.calendars || {})
      };
      if (Array.isArray(accountRow.state?.members)) {
        accountRow.state.members.forEach((m: any) => {
          if (m?.id && m?.calendarId) memCalMap[m.id] = String(m.calendarId).trim();
        });
      }

      const [calendarData, pantryData] = await Promise.all([
        skipCalendars ? Promise.resolve(null) : loadCombinedCalendarData(supabase, accountId, memCalMap),
        loadPantryForAccount(supabase, accountId, accountRow)
      ]);

      return NextResponse.json({
        ok: true,
        accountId,
        authKey: accountSessionToken,
        memberId: matchedMemberId,
        memberUsername: matchedUsername,
        memberRole: role,
        memberToken: issuedMember.token,
        memberExpiresAt: issuedMember.expiresAt,
        adminPinConfigured: hasAdminPin || hasMemberLogins,
        hasAdminPin,
        hasMemberLogins,
        adminUnlocked: role === 'admin',
        adminToken: autoAdminToken?.token || '',
        adminExpiresAt: autoAdminToken?.expiresAt || 0,
        memberLogins: buildPublicMemberLoginsSummary(memberLoginsMap),
        state: {
          ...(accountRow.state || {}),
          skillBoardData: sanitizeSkillBoardPayload(accountRow.state?.skillBoardData),
          pantryItems: pantryData.pantryItems,
          pantryTrash: pantryData.pantryTrash
        },
        ...(calendarData ? { calendarData } : {})
      });
    }

    const isAuthenticatedRequest = isMainAccountAuth || Boolean(verifiedMemberSession);
    if (!isAuthenticatedRequest) {
      return NextResponse.json({ ok: false, error: 'Passwort / PIN ist falsch oder Sitzung abgelaufen.' }, { status: 401 });
    }

    const isGuestMode = Boolean(body.guestMode);
    const activeMemberId = verifiedMemberSession?.memberId || '';
    const activeMemberRole = verifiedMemberSession?.role || (isMainAccountAuth && !authKey.startsWith('tws_') ? 'admin' : 'child');
    const adminProtectedMode = hasAdminPin || hasMemberLogins;
    const hasValidExplicitAdminToken = Boolean(adminToken && verifyAdminToken(adminToken, accountId, adminPinSecretHash));
    const isAdminMemberSession = Boolean(verifiedMemberSession && verifiedMemberSession.role === 'admin');
    const isChildMemberSession = Boolean(verifiedMemberSession && verifiedMemberSession.role === 'child');

    const isAdminAuthorized =
      !isGuestMode &&
      !isChildMemberSession &&
      (hasValidExplicitAdminToken || isAdminMemberSession || (!adminProtectedMode && isMainAccountAuth));

    // ------------------------------------------------------------------------
    // ACTION: getMemberLogins & setMemberCredentials
    // ------------------------------------------------------------------------
    if (action === 'getMemberLogins') {
      return NextResponse.json({
        ok: true,
        memberLogins: buildPublicMemberLoginsSummary(memberLoginsMap)
      });
    }

    if (action === 'setMemberCredentials') {
      if (!isAdminAuthorized) {
        return NextResponse.json(
          { ok: false, error: 'Nur Eltern / Hauptbenutzer können Login-Daten zuweisen.' },
          { status: 403 }
        );
      }
      const targetMemberId = String(body.memberId || '').trim().toLowerCase();
      const nextUsername = normalizeMemberLoginName(body.username || '');
      const nextPassword = String(body.password || '').trim();
      const clearCreds = Boolean(body.clearCredentials);

      if (!targetMemberId || targetMemberId === 'all') {
        return NextResponse.json({ ok: false, error: 'Ungültige memberId.' }, { status: 400 });
      }

      if (clearCreds) {
        const { error: delErr } = await supabase
          .from('tw_member_logins')
          .delete()
          .eq('account_id', accountId)
          .eq('member_id', targetMemberId);
        if (delErr) throw delErr;
        const refreshed = await loadMemberLoginsMap(supabase, accountId);
        return NextResponse.json({
          ok: true,
          memberLogins: buildPublicMemberLoginsSummary(refreshed)
        });
      }

      if (!nextUsername || nextUsername.length < 2) {
        return NextResponse.json(
          { ok: false, error: 'Bitte einen Benutzernamen (min. 2 Zeichen) angeben.' },
          { status: 400 }
        );
      }

      // Doppelten Benutzernamen innerhalb derselben Familie verhindern
      const duplicateOwner = Object.keys(memberLoginsMap).find(
        mid => mid !== targetMemberId && normalizeMemberLoginName(memberLoginsMap[mid]?.username || '') === nextUsername
      );
      if (duplicateOwner) {
        return NextResponse.json(
          { ok: false, error: `Der Benutzername „${nextUsername}“ ist bereits an ein anderes Familienmitglied vergeben.` },
          { status: 409 }
        );
      }

      const existingEntry = memberLoginsMap[targetMemberId];
      if (!nextPassword && !existingEntry?.hasPassword) {
        return NextResponse.json(
          { ok: false, error: 'Bitte ein Passwort oder einen PIN (min. 4 Zeichen) festlegen.' },
          { status: 400 }
        );
      }
      if (nextPassword && nextPassword.length < 4) {
        return NextResponse.json(
          { ok: false, error: 'Passwort / PIN muss mindestens 4 Zeichen lang sein.' },
          { status: 400 }
        );
      }

      const nextHash = nextPassword ? hashAuthKey(nextPassword) : existingEntry.passwordHash;
      const { error: upErr } = await supabase
        .from('tw_member_logins')
        .upsert(
          {
            account_id: accountId,
            member_id: targetMemberId,
            username: nextUsername,
            password_hash: nextHash,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'account_id,member_id' }
        );

      if (upErr) {
        if (String(upErr.code || '') === '42P01' || String(upErr.message || '').includes('tw_member_logins')) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Tabelle "tw_member_logins" fehlt in Supabase. Bitte supabase_member_logins.sql im Supabase SQL Editor ausführen.'
            },
            { status: 500 }
          );
        }
        throw upErr;
      }

      const refreshed = await loadMemberLoginsMap(supabase, accountId);
      return NextResponse.json({
        ok: true,
        memberLogins: buildPublicMemberLoginsSummary(refreshed)
      });
    }

    // ------------------------------------------------------------------------
    // ELTERN-PIN STATUS, VERIFIZIERUNG & VERWALTUNG
    // ------------------------------------------------------------------------
    if (action === 'getAdminStatus') {
      return NextResponse.json({
        ok: true,
        hasAdminPin,
        hasMemberLogins,
        adminPinConfigured: adminProtectedMode,
        adminUnlocked: isAdminAuthorized
      });
    }

    if (action === 'verifyAdminPin') {
      if (!adminProtectedMode) {
        return NextResponse.json({ ok: true, hasAdminPin: false, adminPinConfigured: false, adminUnlocked: true });
      }
      const candidatePin = String(body.adminPin || '').trim();
      const candHash = candidatePin ? hashAuthKey(candidatePin) : '';
      const matchesExplicitPin = Boolean(hasAdminPin && candHash === storedAdminPinHash);
      const matchesAnyAdminMember = Boolean(
        candHash &&
        Object.keys(memberLoginsMap).some(
          mid =>
            getMemberRoleFromState(accountRow, mid) === 'admin' &&
            memberLoginsMap[mid]?.passwordHash === candHash
        )
      );
      const matchesMainPw = Boolean(!hasAdminPin && candHash && candHash === accountRow.auth_hash);

      if (!matchesExplicitPin && !matchesAnyAdminMember && !matchesMainPw) {
        return NextResponse.json({ ok: false, error: 'Eltern-PIN / Admin-Passwort ist falsch.' }, { status: 403 });
      }
      const issued = signAdminToken(accountId, adminPinSecretHash, 60 * 60 * 1000);
      return NextResponse.json({
        ok: true,
        hasAdminPin,
        adminPinConfigured: adminProtectedMode,
        adminUnlocked: true,
        adminToken: issued.token,
        expiresAt: issued.expiresAt
      });
    }

    if (action === 'setAdminPin') {
      const currentAdminPin = String(body.currentAdminPin || '').trim();
      const accountPassword = String(body.accountPassword || '').trim();
      const newAdminPin = String(body.newAdminPin || '').trim();
      const removePin = Boolean(body.removePin);

      // Falls bereits ein Eltern-PIN aktiv ist: Freigabe über gültiges Admin-Token, bisherigen PIN ODER Haupt-Passwort
      if (hasAdminPin) {
        const okByToken = verifyAdminToken(adminToken, accountId, storedAdminPinHash);
        const okByOldPin = Boolean(currentAdminPin && hashAuthKey(currentAdminPin) === storedAdminPinHash);
        const okByMainPw = Boolean(accountPassword && hashAuthKey(accountPassword) === accountRow.auth_hash);
        if (!okByToken && !okByOldPin && !okByMainPw) {
          return NextResponse.json(
            { ok: false, error: 'Bitte aktuellen Eltern-PIN oder Konto-Passwort zur Bestätigung eingeben.' },
            { status: 403 }
          );
        }
      }

      if (!removePin && newAdminPin.length < 4) {
        return NextResponse.json(
          { ok: false, error: 'Der Eltern-PIN muss mindestens 4 Ziffern/Zeichen haben.' },
          { status: 400 }
        );
      }

      const nextHash = removePin ? '' : hashAuthKey(newAdminPin);
      const { error: upErr } = await supabase
        .from('tw_accounts')
        .update({ admin_pin_hash: nextHash, updated_at: new Date().toISOString() })
        .eq('account_id', accountId);

      if (upErr) {
        if (String(upErr.code || '') === '42703' || String(upErr.message || '').includes('admin_pin_hash')) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Spalte "admin_pin_hash" fehlt in Supabase. Bitte in Supabase ausführen: ALTER TABLE tw_accounts ADD COLUMN IF NOT EXISTS admin_pin_hash text DEFAULT \'\';'
            },
            { status: 500 }
          );
        }
        throw upErr;
      }

      const issued = nextHash ? signAdminToken(accountId, nextHash) : null;
      return NextResponse.json({
        ok: true,
        hasAdminPin: Boolean(nextHash),
        adminUnlocked: true,
        adminToken: issued?.token || '',
        expiresAt: issued?.expiresAt || 0
      });
    }

    const currentCalendars: Record<string, string> = {
      ...(accountRow.calendars || {}),
      ...(accountRow.state?.calendars || {})
    };
    if (Array.isArray(accountRow.state?.members)) {
      accountRow.state.members.forEach((m: any) => {
        if (m?.id && m?.calendarId) currentCalendars[m.id] = String(m.calendarId).trim();
      });
    }

    // ------------------------------------------------------------------------
    // LOGIN & LOAD BUNDLE
    // ------------------------------------------------------------------------
    if (action === 'loginAccount' || action === 'loadBundle') {
      const skipCalendars = Boolean(body.skipCalendars);
      const [calendarData, pantryData] = await Promise.all([
        skipCalendars ? Promise.resolve(null) : loadCombinedCalendarData(supabase, accountId, currentCalendars),
        loadPantryForAccount(supabase, accountId, accountRow)
      ]);

      return NextResponse.json({
        ok: true,
        adminPinConfigured: adminProtectedMode,
        hasAdminPin,
        hasMemberLogins,
        activeMemberId,
        memberRole: activeMemberRole,
        memberLogins: buildPublicMemberLoginsSummary(memberLoginsMap),
        state: {
          ...(accountRow.state || {}),
          skillBoardData: sanitizeSkillBoardPayload(accountRow.state?.skillBoardData),
          pantryItems: pantryData.pantryItems,
          pantryTrash: pantryData.pantryTrash
        },
        ...(calendarData ? { calendarData } : {})
      });
    }

    // ------------------------------------------------------------------------
    // SAVE STATE & SAVE DRIVE AND SYNC (MIT SERVERSEITIGEM FELD-SCHUTZ)
    // ------------------------------------------------------------------------
    if (action === 'saveState' || action === 'saveDriveAndSync') {
      const incomingState = body.payload || accountRow.state || {};
      const nextState = isAdminAuthorized
        ? incomingState
        : sanitizeStateForNonAdmin(incomingState, accountRow.state || {});

      const nextCalendars = isAdminAuthorized
        ? { ...currentCalendars, ...(body.calendars || {}) }
        : { ...currentCalendars };

      if (isAdminAuthorized && Array.isArray(nextState.members)) {
        nextState.members.forEach((m: any) => {
          if (m?.id) nextCalendars[m.id] = String(m.calendarId || '').trim();
        });
      }

      if (Array.isArray(nextState.pantryItems) || Array.isArray(nextState.pantryTrash)) {
        await syncPantryTableForAccount(
          supabase,
          accountId,
          Array.isArray(nextState.pantryItems) ? nextState.pantryItems : [],
          Array.isArray(nextState.pantryTrash) ? nextState.pantryTrash : []
        );
      }

      const cleanState = stripPantryFromState({
        ...nextState,
        skillBoardData: sanitizeSkillBoardPayload(nextState.skillBoardData),
        calendars: nextCalendars
      });
      const { error } = await supabase
        .from('tw_accounts')
        .update({ state: cleanState, calendars: nextCalendars, updated_at: new Date().toISOString() })
        .eq('account_id', accountId);
      if (error) throw error;

      await broadcastSync(supabase, accountId, body.clientId, action === 'saveDriveAndSync' ? 'all' : 'state');

      if (action === 'saveDriveAndSync') {
        const calendarData = await loadCombinedCalendarData(supabase, accountId, nextCalendars);
        return NextResponse.json({ ok: true, adminProtected: !isAdminAuthorized, result: calendarData });
      }
      return NextResponse.json({ ok: true, adminProtected: !isAdminAuthorized });
    }

    // ------------------------------------------------------------------------
    // CREATE / UPDATE / DELETE / MOVE EVENT (MIT ELTERN-TERMIN-SCHUTZ)
    // ------------------------------------------------------------------------
    if (action === 'createEvent') {
      const ev = body.event || {};
      const targetMem = String(ev.member || 'all');
      if (!isAdminAuthorized && (isGuestMode || isMemberAdminProtected(accountRow, targetMem))) {
        return NextResponse.json(
          { ok: false, error: isGuestMode ? 'Im Gastmodus können keine Termine angelegt werden. Bitte oben rechts anmelden.' : 'Termine für Eltern oder die Familie sind geschützt. Bitte mit einem Eltern-Konto anmelden.' },
          { status: 403 }
        );
      }
      const oauthConns = await loadOAuthConnectionsForAccount(supabase, accountId);
      await createEventForMember(supabase, accountId, ev, oauthConns, currentCalendars);
      const calendarData = await loadCombinedCalendarData(supabase, accountId, currentCalendars);
      await broadcastSync(supabase, accountId, body.clientId, 'calendar');
      return NextResponse.json({ ok: true, result: calendarData });
    }

    if (action === 'updateEvent') {
      const ev = body.event || {};
      const oldMem = String(body.oldMember || ev.member || '');
      if (!isAdminAuthorized) {
        return NextResponse.json(
          { ok: false, error: 'Eltern-Termine sind geschützt. Bitte zuerst mit dem Eltern-PIN entsperren.' },
          { status: 403 }
        );
      }
      const oauthConns = await loadOAuthConnectionsForAccount(supabase, accountId);
      await updateExternalOrLocalEvent(supabase, accountId, ev, oldMem, oauthConns, currentCalendars);
      const calendarData = await loadCombinedCalendarData(supabase, accountId, currentCalendars);
      await broadcastSync(supabase, accountId, body.clientId, 'calendar');
      return NextResponse.json({ ok: true, result: calendarData });
    }

    if (action === 'deleteEvent') {
      const evId = String(body.eventId || '');
      const parsed = parseExternalEventId(evId);
      const ownerMem = parsed.memberId || String(body.member || '');
      if (!isAdminAuthorized) {
        return NextResponse.json(
          { ok: false, error: 'Eltern-Termine können nur mit dem Eltern-PIN gelöscht werden.' },
          { status: 403 }
        );
      }
      const oauthConns = await loadOAuthConnectionsForAccount(supabase, accountId);
      await deleteExternalOrLocalEvent(supabase, accountId, evId, ownerMem, oauthConns, currentCalendars);
      const calendarData = await loadCombinedCalendarData(supabase, accountId, currentCalendars);
      await broadcastSync(supabase, accountId, body.clientId, 'calendar');
      return NextResponse.json({ ok: true, result: calendarData });
    }

    if (action === 'moveEvent') {
      const snap = body.eventSnapshot || {};
      const oldMember = String(body.oldMember || snap.member || '');
      if (!isAdminAuthorized) {
        return NextResponse.json(
          { ok: false, error: 'Eltern-Termine können nur mit dem Eltern-PIN verschoben werden.' },
          { status: 403 }
        );
      }
      const targetMember = String(body.targetMember || oldMember);
      const movedEv = {
        ...snap,
        id: String(body.eventId || snap.id || ''),
        member: targetMember,
        date: String(body.newDate || snap.date || '')
      };
      const oauthConns = await loadOAuthConnectionsForAccount(supabase, accountId);
      await updateExternalOrLocalEvent(supabase, accountId, movedEv, oldMember, oauthConns, currentCalendars);
      const calendarData = await loadCombinedCalendarData(supabase, accountId, currentCalendars);
      await broadcastSync(supabase, accountId, body.clientId, 'calendar');
      return NextResponse.json({ ok: true, result: calendarData });
    }

    // ------------------------------------------------------------------------
    // RUN DIAGNOSTICS
    // ------------------------------------------------------------------------
    if (action === 'runDiagnostics') {
      const [calendarData, pantryData, catalogRes, oauthConns] = await Promise.all([
        loadCombinedCalendarData(supabase, accountId, currentCalendars),
        loadPantryForAccount(supabase, accountId, accountRow),
        supabase.from('tw_product_catalog').select('barcode', { count: 'exact', head: true }),
        loadOAuthConnectionsForAccount(supabase, accountId)
      ]);

      return NextResponse.json({
        ok: true,
        result: {
          supabaseConnected: true,
          adminPinActive: hasAdminPin,
          realtimeBroadcastReady: Boolean(getPublicAnonKey()),
          oauthConnectionsActive: oauthConns.length,
          pantryStockInTable: pantryData.pantryItems.length,
          pantryTrashInTable: pantryData.pantryTrash.length,
          productCatalogEntries: catalogRes?.count || 0,
          googleServiceAccountConfigured: hasGoogleServiceAccount(),
          calendarsStatus: calendarData.status,
          totalEventsLoaded: calendarData.events.length
        }
      });
    }

    return NextResponse.json({ ok: false, error: 'Unbekannte Aktion: ' + action }, { status: 400 });
  } catch (err: any) {
    const details = [err?.message, err?.details, err?.hint, err?.code ? `(${err.code})` : '']
      .filter(Boolean)
      .join(' – ');
    return NextResponse.json(
      { ok: false, error: details || 'Interner Serverfehler in /api/cloud' },
      { status: 500 }
    );
  }
}
