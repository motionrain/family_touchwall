// @ts-nocheck
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const TODOIST_V1_BASE = 'https://api.todoist.com/api/v1';

export async function POST(req) {
  try {
    const payload = await req.json();

    // =========================================================
    // A) SERVER-BRÜCKE FÜR GOOGLE APPS SCRIPT (CODE.GS) -> KEIN CORS MEHR!
    // Unterstützt den sowohl 'googleGet'/'googlePost' als auch 'gasProxy'
    // =========================================================
    const isGoogleGet =
      (payload.action === 'googleGet' && payload.url) ||
      (payload.action === 'gasProxy' && payload.gasUrl && (payload.gasMethod || 'GET') === 'GET');

    const isGooglePost =
      (payload.action === 'googlePost' && payload.url) ||
      (payload.action === 'gasProxy' && payload.gasUrl && payload.gasMethod === 'POST');

    if (isGoogleGet) {
      const rawUrl = String(payload.url || payload.gasUrl).trim();
      const sep = rawUrl.includes('?') ? '&' : '?';
      const targetUrl = `${rawUrl}${sep}action=json&_t=${Date.now()}`;
      const gRes = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      });
      const text = await gRes.text();
      try {
        const json = JSON.parse(text);
        return NextResponse.json(json);
      } catch (parseErr) {
        return NextResponse.json(
          { error: 'Code.gs hat HTML statt JSON geliefert. Bitte in Apps Script prüfen, ob Bereitstellung auf "Jeder" steht.' },
          { status: 502 }
        );
      }
    }

    if (isGooglePost) {
      const rawUrl = String(payload.url || payload.gasUrl).trim();
      const postPayload = payload.bodyData || payload.gasBody || {};
      const gRes = await fetch(rawUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(postPayload),
        cache: 'no-store'
      });
      const text = await gRes.text();
      try {
        const json = JSON.parse(text);
        return NextResponse.json(json);
      } catch (parseErr) {
        return NextResponse.json({ ok: true, raw: text.slice(0, 200) });
      }
    }

    // =========================================================
    // B) SERVER-BRÜCKE FÜR TODOIST API v1
    // =========================================================
    const rawToken = String(payload.token || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!rawToken) {
      return NextResponse.json({ error: 'Kein gültiges Todoist API-Token übergeben.' }, { status: 400 });
    }

    if (payload.action === 'addReminder' && payload.itemId) {
      const uuid = 'tw-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
      const cmd = [{
        type: 'reminder_add',
        temp_id: 'rem-' + Date.now(),
        uuid: uuid,
        args: {
          item_id: String(payload.itemId),
          type: 'relative',
          minute_offset: Number(payload.minuteOffset || 15)
        }
      }];
      const formBody = new URLSearchParams({ commands: JSON.stringify(cmd) });
      const syncRes = await fetch(`${TODOIST_V1_BASE}/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${rawToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody.toString(),
        cache: 'no-store'
      });
      const syncData = await syncRes.json().catch(() => ({}));
      return NextResponse.json({ ok: true, syncData });
    }

    if (payload.action === 'syncCollaborators') {
      const formBody = new URLSearchParams({
        sync_token: '*',
        resource_types: JSON.stringify(['collaborators', 'user'])
      });
      const syncColRes = await fetch(`${TODOIST_V1_BASE}/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${rawToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody.toString(),
        cache: 'no-store'
      });
      const syncColData = await syncColRes.json().catch(() => ({}));
      const combined = [];
      if (syncColData?.user?.id) {
        combined.push({
          id: String(syncColData.user.id),
          name: syncColData.user.full_name || 'Hauptkonto',
          email: syncColData.user.email || ''
        });
      }
      if (Array.isArray(syncColData?.collaborators)) {
        syncColData.collaborators.forEach(c => {
          combined.push({
            id: String(c.id),
            name: c.full_name || c.name || c.email || 'Team-Mitglied',
            email: c.email || ''
          });
        });
      }
      return NextResponse.json(combined);
    }

    const path = payload.path || '/projects';
    const method = payload.method || 'GET';
    const url = `${TODOIST_V1_BASE}${path}`;

    let cleanBody = payload.body ? { ...payload.body } : null;
    if (cleanBody && cleanBody.due_datetime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(cleanBody.due_datetime)) {
      cleanBody.due_datetime = new Date(cleanBody.due_datetime).toISOString();
    }

    const fetchOptions = {
      method,
      headers: {
        Authorization: `Bearer ${rawToken}`,
        ...(cleanBody ? { 'Content-Type': 'application/json' } : {})
      },
      cache: 'no-store'
    };

    if (cleanBody && method !== 'GET') {
      fetchOptions.body = JSON.stringify(cleanBody);
    }

    const res = await fetch(url, fetchOptions);
    if (res.status === 204) {
      return NextResponse.json({ ok: true });
    }

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: `Todoist-v1 (${res.status}): ${text}` }, { status: res.status });
    }

    const data = text ? JSON.parse(text) : {};
    const unwrapped = (method === 'GET' && data && !Array.isArray(data) && Array.isArray(data.results))
      ? data.results
      : data;

    return NextResponse.json(unwrapped);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Server-Fehler in der API-Brücke' },
      { status: 500 }
    );
  }
}
