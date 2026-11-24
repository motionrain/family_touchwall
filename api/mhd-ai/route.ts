// @ts-nocheck
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 20;

function addDaysToIso(isoDate: string, deltaDays: number): string {
  const dt = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return isoDate;
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function buildValidIso(y: number, m: number, d: number): string | null {
  if (y < 2025 || y > 2039 || m < 1 || m > 12) return null;
  const maxDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d < 1 || d > maxDay) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function normalizeExpiryDate(rawVal: string, todayStr: string): string | null {
  const s = String(rawVal || '').trim();
  if (!s) return null;

  // 1. Direktes ISO-Format YYYY-MM-DD
  const iso = s.match(/^(20[2-3]\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  if (iso) {
    return buildValidIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // Uhrzeiten (z.B. 21:14, 14:32) und Temperaturen (-18 °C) entfernen
  const cleaned = s
    .toUpperCase()
    .replace(/\b([01]?\d|2[0-3])\s*:\s*[0-5]\d(?:\s*:\s*[0-5]\d)?\b/g, ' ')
    .replace(/-\s*\d+\s*°?\s*C\b/g, ' ');

  // 2. ISO irgendwo im Text
  const isoAny = cleaned.match(/(?:^|[^\d])(20[2-3]\d)\s*[-./]\s*(0?[1-9]|1[0-2])\s*[-./]\s*(0?[1-9]|[12]\d|3[01])(?:$|[^\d])/);
  if (isoAny) {
    const res = buildValidIso(Number(isoAny[1]), Number(isoAny[2]), Number(isoAny[3]));
    if (res) return res;
  }

  // 3. Deutsch/EU: DD.MM.YYYY oder DD.MM.YY (z.B. 29.01.2028 oder 05.10.28)
  const dmy = cleaned.match(/(?:^|[^\d])(0?[1-9]|[12]\d|3[01])\s*[.,/\-\s·•_]{1,3}\s*(0?[1-9]|1[0-2])\s*[.,/\-\s·•_]{1,3}\s*(20[2-3]\d|2[5-9]|3[0-9])(?:$|[^\d])/);
  if (dmy) {
    const yStr = dmy[3];
    const yNum = yStr.length === 2 ? Number('20' + yStr) : Number(yStr);
    const res = buildValidIso(yNum, Number(dmy[2]), Number(dmy[1]));
    if (res) return res;
  }

  // 4. Tag.Monat OHNE Jahr (Brotclips wie "02.12. C2" oder "05.01.")
  const dmNoYear = cleaned.match(/(?:^|[^\d])(0[1-9]|[12]\d|3[01])\s*[./]\s*(0[1-9]|1[0-2])(?:\s*\.)?(?!\s*(?:19|20)\d{2}\b)(?=$|[^0-9,€])/);
  if (dmNoYear) {
    const dNum = Number(dmNoYear[1]);
    const mNum = Number(dmNoYear[2]);
    const curYear = Number(todayStr.slice(0, 4)) || new Date().getFullYear();
    const sevenDaysAgo = addDaysToIso(todayStr, -7);
    let yNum = curYear;
    const candCur = buildValidIso(yNum, mNum, dNum);
    if (candCur && candCur < sevenDaysAgo) {
      yNum = curYear + 1;
    }
    const res = buildValidIso(yNum, mNum, dNum);
    if (res) return res;
  }

  // 5. Nur Monat/Jahr: MM.YYYY oder MM/YY
  const my = cleaned.match(/(?:^|[^\d])(0?[1-9]|1[0-2])\s*[./\-]\s*(20[2-3]\d|2[5-9]|3[0-9])(?:$|[^\d])/);
  if (my) {
    const mNum = Number(my[1]);
    const yStr = my[2];
    const yNum = yStr.length === 2 ? Number('20' + yStr) : Number(yStr);
    const lastDay = new Date(Date.UTC(yNum, mNum, 0)).getUTCDate();
    const res = buildValidIso(yNum, mNum, lastDay);
    if (res) return res;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        fallbackToLocal: true,
        error: 'GEMINI_API_KEY fehlt in Vercel (lokales OCR aktiv).'
      });
    }

    const body = await req.json();
    const rawBase64 = String(body.imageBase64 || '');
    const mode = body.mode === 'label' ? 'label' : 'mhd';
    const todayStr = String(body.todayStr || new Date().toISOString().slice(0, 10)).slice(0, 10);

    const mimeMatch = rawBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mimeType = mimeMatch?.[1] || 'image/jpeg';
    const cleanBase64 = rawBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();

    if (!cleanBase64 || cleanBase64.length < 200) {
      return NextResponse.json({ ok: false, error: 'Kein gültiges Kamerabild übermittelt.' }, { status: 400 });
    }

    const prompt =
      mode === 'label'
        ? [
            `Du bist ein präziser Lebensmittel-Etiketten-Scanner für Deutschland/Europa. Heute ist ${todayStr}.`,
            'Lies aus diesem Bild einer Lebensmittelverpackung:',
            '1. productName: Kurzer, klarer Produktname auf Deutsch (ohne Gewicht/Marketing-Floskeln).',
            '2. brand: Kurzer Markenname (falls sichtbar, sonst null).',
            '3. quantity: Menge/Gewicht falls sichtbar (z.B. "500g", "1L", "4x"), sonst null.',
            '4. expiryDate: Das Mindesthaltbarkeitsdatum (MHD / "zu verbrauchen bis") im Format YYYY-MM-DD.',
            '   - Erkenne Punktschrift/Dot-Matrix (auch auf gemusterten Gläserdeckeln wie "05.10.28 M2"), dunkle Schrift auf rotem/farbigem Karton ("29.01.2028 21:14"), Prägedruck, schrägen Druck und weiße Schrift auf dunklem Grund.',
            '   - Brotclips & Backwaren zeigen oft NUR Tag und Monat OHNE Jahr + Chargencode (z.B. "02.12. C2" oder "05.01.") -> "C2"/"M2"/"L4" ist KEIN Jahr! Ergänze das Jahr anhand von heute (' + todayStr + '; liegt TT.MM. mehr als 7 Tage in der Vergangenheit, nimm das nächste Jahr).',
            '   - Bei nur Monat/Jahr (z.B. 11/26 oder 11.2026) nimm den letzten Tag des Monats.',
            '   - Ignoriere Uhrzeiten (21:14, 14:32), Temperaturen (-18 °C) und FSC-/Chargencodes (C081636, C2, M2).',
            '   - Wenn Produktionsdatum UND Ablaufdatum draufstehen, wähle IMMER das spätere Ablaufdatum.',
            '   - Wenn kein Datum sicher lesbar ist, gib null zurück (nichts erfinden!).',
            '5. rawText: Der gelesene Datums-Text exakt wie aufgedruckt (oder null).',
            'Antworte ausschließlich als JSON mit den Schlüsseln: productName, brand, quantity, expiryDate, rawText.'
          ].join('\n')
        : [
            `Du bist ein hochpräziser MHD-Scanner (Mindesthaltbarkeitsdatum / Verbrauchsdatum) für Lebensmittelverpackungen in Deutschland/Europa. Heute ist ${todayStr}.`,
            'Lies ausschließlich das Ablaufdatum (MHD / "mindestens haltbar bis" / "zu verbrauchen bis" / "EXP") aus dem Bild.',
            'Wichtige Regeln & Sonderfälle:',
            '- Brotclips & Frische-Etiketten OHNE Jahr: z.B. "02.12. C2" oder "05.01. L3" -> Das Datum ist NUR Tag.Monat ("02.12."), der Buchstabe+Zahl danach ("C2", "M2") ist ein Chargencode und KEIN Jahr! Ergänze das Jahr passend zu heute (' + todayStr + '): liegt TT.MM. in diesem Jahr mehr als 7 Tage zurück, nimm das nächste Jahr (z.B. heute Nov 2026: "02.12." -> 2026-12-02, "05.01." -> 2027-01-05).',
            '- Dunkle Schrift auf rotem oder buntem Karton mit Uhrzeit daneben: z.B. "29.01.2028 21:14" -> gib "2028-01-29" zurück; ignoriere Uhrzeiten (21:14), Temperaturen (-18 °C) und FSC-Codes (C081636).',
            '- Inkjet-Punktschrift (Dot-Matrix / Nadeldruck) auf gewölbten oder gemusterten Deckeln: z.B. "05.10.28 M2 14:3..." -> gib "2028-10-05" zurück, auch wenn ein Druckmuster/Herz durch die Ziffern läuft.',
            '- Europäisches Datumsformat ist Tag.Monat.Jahr (z.B. 24.11.26 = 2026-11-24, 05 12 2026 = 2026-12-05, 11/26 oder 11.2026 = 2026-11-30).',
            '- Falls Verpackungsdatum UND Ablaufdatum sichtbar sind, gib das spätere Ablaufdatum zurück.',
            '- Wenn wirklich kein Datum erkennbar ist, gib expiryDate: null zurück – erfinde niemals ein Datum!',
            'Antworte ausschließlich als JSON: {"expiryDate": "YYYY-MM-DD" | null, "rawText": string | null, "confidence": "high" | "medium" | "low"}'
          ].join('\n');

    const modelName = (process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash').trim();
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=` +
      encodeURIComponent(apiKey);

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      }),
      cache: 'no-store'
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        fallbackToLocal: true,
        error: data?.error?.message || `Gemini HTTP ${res.status}`
      });
    }

    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(textOut);
    } catch {
      const m = textOut.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    // Normalisiert zuerst expiryDate und greift als Netz & doppelter Boden auf rawText zurück
    const expiryDate =
      normalizeExpiryDate(parsed.expiryDate, todayStr) ||
      normalizeExpiryDate(parsed.rawText, todayStr);

    return NextResponse.json({
      ok: true,
      expiryDate,
      rawText: parsed.rawText || null,
      productName: parsed.productName || null,
      brand: parsed.brand || null,
      quantity: parsed.quantity || null,
      confidence: parsed.confidence || (expiryDate ? 'high' : 'low')
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      fallbackToLocal: true,
      error: err?.message || 'KI-Scan Fehler'
    });
  }
}
