// @ts-nocheck
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

//
//
// ============================================================================
// PART 01: KONFIGURATION & SUPABASE-HELFER
// ============================================================================
//
//

const PRODUCTS_TABLE = 'products';

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, serviceKey };
}

function normalizeBarcode(raw: string) {
  return String(raw || '').trim().slice(0, 64);
}

function mapDbRowToProduct(row: any) {
  if (!row) return null;
  return {
    barcode: row.barcode || '',
    name: row.name || '',
    quantity: row.quantity || '1x',
    location: row.location || 'fridge',
    category: row.category || 'produce',
    glutenFree: row.gluten_free ?? row.glutenFree ?? 'auto',
    imageUrl: row.image_url ?? row.imageUrl ?? '',
    updatedAt: row.updated_at || null
  };
}

async function fetchProductRowByCode(url: string, serviceKey: string, code: string) {
  const endpoint =
    `${url}/rest/v1/${PRODUCTS_TABLE}?barcode=eq.${encodeURIComponent(code)}&select=*&limit=1`;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json'
    },
    cache: 'no-store'
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

//
//
// ============================================================================
// PART 02: GET – PRODUKT PER BARCODE (INKL. GEWICHTS-EAN PRÄFIX) ABRUFEN
// ============================================================================
//
//

export async function GET(req: Request) {
  try {
    const { url, serviceKey } = getSupabaseConfig();
    if (!url || !serviceKey) {
      return NextResponse.json(
        { ok: false, found: false, error: 'SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const barcode = normalizeBarcode(searchParams.get('barcode') || '');

    if (!barcode || barcode.length < 4) {
      return NextResponse.json({ ok: true, found: false, product: null });
    }

    // 1. Exakter Barcode-Treffer
    let row = await fetchProductRowByCode(url, serviceKey, barcode);

    // 2. Fallback für 13-stellige Gewichts-/Frischetheken-Barcodes (beginnen mit 2) über 7-stelligen Präfix
    if (!row) {
      const digits = barcode.replace(/\D/g, '');
      if (digits.length === 13 && /^2[0-9]/.test(digits)) {
        row = await fetchProductRowByCode(url, serviceKey, digits.slice(0, 7));
      }
    }

    if (!row || !row.name) {
      return NextResponse.json({ ok: true, found: false, product: null });
    }

    return NextResponse.json({
      ok: true,
      found: true,
      product: mapDbRowToProduct(row)
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, found: false, error: err?.message || 'Fehler beim Laden des Produkts.' },
      { status: 500 }
    );
  }
}

//
//
// ============================================================================
// PART 03: POST – PRODUKT INKL. BILD-URL IN SUPABASE SPEICHERN (UPSERT)
// ============================================================================
//
//

export async function POST(req: Request) {
  try {
    const { url, serviceKey } = getSupabaseConfig();
    if (!url || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: 'SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const barcode = normalizeBarcode(body?.barcode || '');
    const name = String(body?.name || '').trim().slice(0, 160);

    if (!barcode || barcode.length < 4 || !name) {
      return NextResponse.json(
        { ok: false, error: 'Ungültige Produktdaten (barcode und name erforderlich).' },
        { status: 400 }
      );
    }

    const quantity = String(body?.quantity || '1x').trim().slice(0, 48);
    const location = String(body?.location || 'fridge').trim().slice(0, 32);
    const category = String(body?.category || 'produce').trim().slice(0, 32);
    const glutenFree = String(body?.glutenFree || 'auto').trim().slice(0, 16);
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim().slice(0, 1024) : '';
    const updatedAt = new Date().toISOString();

    const rowsToUpsert: any[] = [
      {
        barcode,
        name,
        quantity,
        location,
        category,
        gluten_free: glutenFree,
        image_url: imageUrl,
        updated_at: updatedAt
      }
    ];

    // Bei 13-stelligen Gewichts-/PLU-Barcodes (2xxxxxx...) zusätzlich den 7-stelligen Stammcode merken
    const digits = barcode.replace(/\D/g, '');
    if (digits.length === 13 && /^2[0-9]/.test(digits)) {
      const prefix7 = digits.slice(0, 7);
      if (prefix7 !== barcode) {
        rowsToUpsert.push({
          barcode: prefix7,
          name,
          quantity,
          location,
          category,
          gluten_free: glutenFree,
          image_url: imageUrl,
          updated_at: updatedAt
        });
      }
    }

    const upsertRes = await fetch(
      `${url}/rest/v1/${PRODUCTS_TABLE}?on_conflict=barcode`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(rowsToUpsert)
      }
    );

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      return NextResponse.json(
        { ok: false, error: 'Supabase-Speicherfehler: ' + errText },
        { status: 502 }
      );
    }

    const savedRows = await upsertRes.json();
    const savedPrimary = Array.isArray(savedRows) ? savedRows[0] : rowsToUpsert[0];

    return NextResponse.json({
      ok: true,
      product: mapDbRowToProduct(savedPrimary)
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Unbekannter Fehler beim Speichern.' },
      { status: 500 }
    );
  }
}
