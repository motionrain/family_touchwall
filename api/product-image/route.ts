// @ts-nocheck
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BUCKET = 'product-images';
const MAX_BYTES = 450 * 1024; // 450 KB Sicherheitslimit

function sanitizeSlug(value: string, fallback: string) {
  const clean = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);
  return clean || fallback;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: 'SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt in den Umgebungsvariablen.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { accountId, barcode, imageBase64 } = body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ ok: false, error: 'Kein Bild übermittelt.' }, { status: 400 });
    }

    const match = imageBase64.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
    if (!match) {
      return NextResponse.json({ ok: false, error: 'Ungültiges Bildformat (erlaubt: JPEG, PNG, WebP).' }, { status: 400 });
    }

    const rawMime = match[1].toLowerCase();
    const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    const ext = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
    const buffer = Buffer.from(match[2], 'base64');

    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Bild ist zu groß (max. 450 KB nach Komprimierung).' },
        { status: 413 }
      );
    }

    const folder = sanitizeSlug(accountId, 'shared');
    const cleanBarcode = String(barcode || '').replace(/[^0-9a-zA-Z]/g, '').slice(0, 32);
    const fileName = cleanBarcode
      ? `ean-${cleanBarcode}.${ext}`
      : `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const objectPath = `${folder}/${fileName}`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${objectPath}`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': mimeType,
        'x-upsert': 'true',
        'cache-control': 'max-age=31536000'
      },
      body: buffer
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return NextResponse.json(
        { ok: false, error: 'Supabase Storage Upload fehlgeschlagen: ' + errText },
        { status: 502 }
      );
    }

    // Cache-Buster (?v=...), damit ein neu fotografiertes Produkt sofort auf der Touchwall aktualisiert wird
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}?v=${Date.now()}`;

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      path: objectPath,
      bytes: buffer.byteLength
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Unbekannter Upload-Fehler' },
      { status: 500 }
    );
  }
}
