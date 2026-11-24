// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// ============================================================================
// KONFIGURATION: MÄRKTE, KATEGORIEN & TAGES-ABFRAGEN
// ============================================================================
const DEFAULT_ZIP = '79618';

// Fallback-Keys, falls marktguru.de HTML kurzzeitig umgebaut wird (werden primär live extrahiert)
const FALLBACK_MG_KEYS = {
  apiKey: '8Kk+pmbf7w74/B3b47/d7/P2b4g6R/K8xK9w8/p3b8=',
  clientKey: 'WU/RH+PMGDi+gkZer3WbMelt6zcYHSTytNB7VpTia90='
};

let cachedMgKeys: { apiKey: string; clientKey: string; fetchedAt: number } | null = null;
const memoryFeedCache = new Map<string, { data: any; ts: number }>();

function getBerlinDateKey() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function getSupabaseAdminOrNull() {
  try {
    const rawUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
      .trim()
      .replace(/^["']|["']$/g, '');
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!rawUrl || !key) return null;
    const cleanUrl = new URL(rawUrl).origin;
    return createClient(cleanUrl, key, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}

// Extrahiert die aktuellen öffentlichen Web-Keys direkt aus https://www.marktguru.de (6h Cache)
async function getMarktguruKeys(forceRefresh = false) {
  if (!forceRefresh && cachedMgKeys && Date.now() - cachedMgKeys.fetchedAt < 6 * 60 * 60 * 1000) {
    return cachedMgKeys;
  }

  try {
    const res = await fetch('https://www.marktguru.de/', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml'
      },
      cache: 'no-store'
    });

    if (res.ok) {
      const html = await res.text();
      const apiMatch =
        html.match(/["']apiKey["']\s*:\s*["']([^"']{16,})["']/i) ||
        html.match(/x-apikey["']?\s*[:=]\s*["']([^"']{16,})["']/i);
      const clientMatch =
        html.match(/["']clientKey["']\s*:\s*["']([^"']{16,})["']/i) ||
        html.match(/x-clientkey["']?\s*[:=]\s*["']([^"']{16,})["']/i);

      if (apiMatch?.[1] && clientMatch?.[1]) {
        cachedMgKeys = {
          apiKey: apiMatch[1].trim(),
          clientKey: clientMatch[1].trim(),
          fetchedAt: Date.now()
        };
        return cachedMgKeys;
      }
    }
  } catch (err) {
    console.warn('[Offers API] Marktguru Key-Extraktion Fallback:', err?.message || err);
  }

  return cachedMgKeys || { ...FALLBACK_MG_KEYS, fetchedAt: Date.now() };
}

// ============================================================================
// MARKT- & KATEGORIE-ERKENNUNG (INKL. HAUSHALT, HAUSHALTSWAREN & DROGERIE)
// ============================================================================
function normalizeStoreId(advertiserName: string): string {
  const n = String(advertiserName || '').toLowerCase();
  if (n.includes('kaufland')) return 'kaufland';
  if (n.includes('netto')) return 'netto';
  if (n.includes('lidl')) return 'lidl';
  if (n.includes('aldi')) return 'aldi';
  if (n.includes('rewe')) return 'rewe';
  if (n.includes('hieber') || n.includes('edeka') || n.includes('marktkauf')) return 'hieber';
  if (n.includes('penny')) return 'penny';
  if (n.includes('norma')) return 'norma';
  if (n.includes('dm-drogerie') || n === 'dm' || n.startsWith('dm ')) return 'dm';
  if (n.includes('rossmann') || n.includes('müller') || n.includes('mueller')) return 'rossmann';
  return 'other';
}

function detectOfferCategory(title: string, desc: string, mgCategories: string[] = []): string {
  const text = `${title} ${desc} ${mgCategories.join(' ')}`.toLowerCase();

  // 1. Haushalt & Reinigung (Verbrauchsmittel)
  if (
    /waschmittel|persil|ariel|lenor|weichspüler|spülmaschinentabs|geschirrspül|finish|somat|pril|spülmittel|toilettenpapier|klopapier|zewa|küchenrolle|küchentücher|tempo|taschentücher|müllbeutel|gefrierbeutel|alufolie|backpapier|frischhaltefolie|allzweckreiniger|badreiniger|wc-reiniger|glasreiniger|meister proper|frosch|viss|domestos|sagrotan|calgon|bref|swiffer|schwamm|putztuch|entkalker|scheuermilch|fleckentferner|vanish/.test(
      text
    )
  ) {
    return 'haushalt';
  }

  // 2. Haushaltswaren, Küche & Wochen-Aktion (Non-Food)
  if (
    /pfanne|bratpfanne|kochtopf|topfset|messerblock|küchenmesser|küchenhelfer|schneidebrett|vorratsdose|frischhaltedose|trinkflasche|thermoskanne|wasserkocher|toaster|kaffeemaschine|heißluftfritteuse|airfryer|mixer|stabmixer|staubsauger|bügeleisen|wäscheständer|wäschekorb|aufbewahrungsbox|bettwäsche|spannbettlaken|handtuch|duschtuch|kissen|decke|werkzeug|akkuschrauber|bohrer|parkside|led-leuchte|batterien|verlängerungskabel|garten|blumentopf|kerze|deko|haushaltsgeräte|geschirr|tasse|glas-set|besteck/.test(
      text
    )
  ) {
    return 'haushaltswaren';
  }

  // 3. Drogerie & Körperpflege
  if (
    /shampoo|duschgel|seife|handseife|zahnpasta|zahnbürste|mundspülung|deo|deodorant|creme|lotion|bodylotion|nivea|dove|fa\b|head\s*&\s*shoulders|elnett|haarspray|rasierer|rasierklingen|gillette|windeln|pampers|feuchttücher|binden|tampons|wattepads|kosmetik|parfüm|sonnencreme/.test(
      text
    )
  ) {
    return 'drogerie';
  }

  // 4. Tierfutter & Tierbedarf
  if (
    /hundefutter|katzenfutter|tierfutter|katzenstreu|whiskas|felix|sheba|gourmet|pedigree|cesar|rinti|frolic|dreamies|leckerli|kauknochen|hundenahrung|katzennahrung|vogel|kleintier/.test(
      text
    )
  ) {
    return 'tier';
  }

  // 5. Getränke & Kaffee
  if (
    /kaffee|espresso|caffè|caffe|crema|bohnen|kapseln|pads|jacobs|dallmayr|lavazza|tchibo|melitta|nescafé|tee\b|mineralwasser|wasser|cola|pepsi|fanta|sprite|mezzo|spezi|paulaner|bier|pils|weizen|radler|kasten|sekt|prosecco|wein|rotwein|weißwein|saft|apfelsaft|orangensaft|schorle|energy|red bull|monster|eistee|sirup|haferdrink|mandeldrink/.test(
      text
    )
  ) {
    return 'getraenke';
  }

  // 6. Fleisch, Wurst & Fisch
  if (
    /fleisch|schwein|rind|hähnchen|huhn|pute|geflügel|filet|steak|gulasch|hackfleisch|schnitzel|braten|wurst|bratwurst|salami|schinken|lyoner|leberwurst|aufschnitt|wiener|bockwurst|bacon|speck|fisch|lachs|forelle|thunfisch|garnelen|fischstäbchen|metzgerei|geflügelwurst/.test(
      text
    )
  ) {
    return 'fleisch';
  }

  // 7. Milch, Käse & Butter
  if (
    /milch|vollmilch|butter|kerrygold|meggle|weihenstephan|rama|lätta|margarine|käse|gouda|emmentaler|mozzarella|parmesan|frischkäse|philadelphia|exquisa|miree|camembert|feta|hirtenkäse|joghurt|skyr|quark|sahne|schlagsahne|schmand|crème fraîche|creme fraiche|pudding|müller milch|ehrmann|zott|danone|eier|freilandeier/.test(
      text
    )
  ) {
    return 'milch';
  }

  // 8. Obst & Gemüse
  if (
    /apfel|äpfel|birne|banane|orange|mandarine|clementine|traube|erdbeer|himbeer|heidelbeer|blaubeer|beeren|zitrone|kiwi|mango|ananas|melone|avocado|tomate|rispentomate|gurke|paprika|salat|feldsalat|eisberg|rucola|spinat|karotte|möhre|zwiebel|knoblauch|kartoffel|brokkoli|blumenkohl|champignon|pilz|zucchini|aubergine|spargel|obst|gemüse/.test(
      text
    )
  ) {
    return 'frische';
  }

  // 9. Süßes & Snacks
  if (
    /schokolade|milka|lindt|ritter sport|kinder|ferrero|duplo|hanuta|nutella|haribo|gummibär|chips|funny-frisch|pringles|flips|salzstangen|nüsse|cashew|pistazien|keks|cookie|leibniz|oreo|praline|eis\b|magnum|ben\s*&\s*jerry|knabber|riegel|bonbon|popcorn/.test(
      text
    )
  ) {
    return 'snacks';
  }

  // 10. Vorrat, Brot & Tiefkühl
  return 'vorrat';
}

function detectGlutenFreeHint(title: string, desc: string, category: string): boolean {
  const t = `${title} ${desc}`.toLowerCase();
  if (/glutenfrei|gluten-free|ohne gluten|schär|seitz|bauckhof|gefro/.test(t)) return true;
  if (['haushalt', 'haushaltswaren', 'drogerie', 'tier'].includes(category)) return false;
  if (/weizen|dinkel|roggen|gerste|brot|brötchen|toast|nudel|pasta|spaghetti|pizza|paniert|keks|waffel|kuchen|bier|malz|mehl|haferflocken|müsli|croissant/.test(t)) {
    return false;
  }
  return ['frische', 'milch', 'fleisch'].includes(category);
}

function formatValidUntilLabel(validityDates: any[]): { label: string; toIso: string } {
  if (!Array.isArray(validityDates) || validityDates.length === 0) {
    return { label: 'Aktuelle Woche', toIso: '' };
  }
  const latest = validityDates[validityDates.length - 1] || validityDates[0];
  const rawTo = String(latest?.to || '').slice(0, 10);
  if (!rawTo || rawTo.length < 10) return { label: 'Aktuelle Woche', toIso: '' };
  try {
    const dt = new Date(`${rawTo}T12:00:00Z`);
    const wd = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'Europe/Berlin' }).format(dt);
    const ddmm = `${rawTo.slice(8, 10)}.${rawTo.slice(5, 7)}.`;
    return { label: `bis ${wd}, ${ddmm}`, toIso: rawTo };
  } catch {
    return { label: `bis ${rawTo}`, toIso: rawTo };
  }
}

function mapMarktguruOffer(raw: any) {
  if (!raw || !raw.id) return null;
  const price = Number(raw.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const rawOld = Number(raw.oldPrice);
  const oldPrice = Number.isFinite(rawOld) && rawOld > price ? rawOld : 0;

  const advName =
    raw.advertisers?.[0]?.name ||
    raw.advertiser?.name ||
    'Supermarkt';
  const storeId = normalizeStoreId(advName);

  const prodName = String(raw.product?.name || '').trim();
  const brandName = String(raw.brand?.name || '').trim();
  const desc = String(raw.description || '').trim();

  let title = prodName;
  if (brandName && !title.toLowerCase().includes(brandName.toLowerCase())) {
    title = title ? `${brandName} ${title}` : brandName;
  }
  if (!title) {
    title = desc.split('\n')[0].slice(0, 80) || 'Aktions-Angebot';
  }

  const unitParts: string[] = [];
  if (raw.volume && raw.unit?.shortName) {
    unitParts.push(`${raw.volume} ${raw.unit.shortName}`);
  } else if (raw.quantity && raw.unit?.shortName) {
    unitParts.push(`${raw.quantity} ${raw.unit.shortName}`);
  }
  if (raw.referencePrice && raw.unit?.shortName) {
    const refStr = Number(raw.referencePrice).toFixed(2).replace('.', ',');
    unitParts.push(`(${refStr} €/${raw.unit.shortName})`);
  }
  const unit = unitParts.join(' ') || (desc && desc !== title ? desc.slice(0, 60) : 'Aktionspackung');

  const mgCats = Array.isArray(raw.categories)
    ? raw.categories.map((c: any) => String(c?.name || '')).filter(Boolean)
    : [];

  const category = detectOfferCategory(title, desc, mgCats);
  const { label: validUntil, toIso: validToIso } = formatValidUntilLabel(raw.validityDates);
  const discountPercent = oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  const savingsEuro = oldPrice > price ? Number((oldPrice - price).toFixed(2)) : 0;

  const imageUrl = `https://mg2de.b-cdn.net/api/v1/offers/${encodeURIComponent(String(raw.id))}/images/default/0/medium.webp`;

  return {
    id: `mg_${raw.id}`,
    externalId: String(raw.id),
    title,
    description: desc.slice(0, 140),
    brand: brandName,
    storeId,
    storeName: advName,
    category,
    price: Number(price.toFixed(2)),
    oldPrice: oldPrice ? Number(oldPrice.toFixed(2)) : 0,
    discountPercent,
    savingsEuro,
    unit,
    validUntil,
    validToIso,
    glutenFree: detectGlutenFreeHint(title, desc, category),
    imageUrl,
    offerUrl: `https://www.marktguru.de/offers/${encodeURIComponent(String(raw.id))}`,
    isLive: true
  };
}

async function queryMarktguruSearch(
  queryTerm: string,
  zipCode: string,
  keys: { apiKey: string; clientKey: string },
  limit = 28
) {
  const url =
    `https://api.marktguru.de/api/v1/offers/search` +
    `?as=web&limit=${limit}&offset=0` +
    `&q=${encodeURIComponent(queryTerm)}` +
    `&zipCode=${encodeURIComponent(zipCode)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, {
      headers: {
        'x-apikey': keys.apiKey,
        'x-clientkey': keys.clientKey,
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      },
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!res.ok) return { ok: false, status: res.status, results: [] };
    const json = await res.json();
    const list = Array.isArray(json?.results) ? json.results : [];
    return { ok: true, status: res.status, results: list };
  } catch {
    return { ok: false, status: 0, results: [] };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// BREITER TAGES-FEED (DECKT KAUFLAND, NETTO, LIDL, ALDI, REWE, DM & HAUSHALT AB)
// ============================================================================
const DAILY_FEED_QUERIES = [
  // Märkte allgemein (was Kaufland, Netto & Co. aktuell im Angebot haben)
  { q: 'Kaufland', limit: 40 },
  { q: 'Netto', limit: 36 },
  { q: 'Lidl', limit: 32 },
  { q: 'ALDI', limit: 28 },
  { q: 'REWE', limit: 28 },
  { q: 'PENNY', limit: 24 },
  { q: 'NORMA', limit: 24 },
  { q: 'EDEKA', limit: 24 },
  { q: 'dm', limit: 24 },

  // Haushalt & Reinigung (NEU!)
  { q: 'Waschmittel', limit: 24 },
  { q: 'Toilettenpapier', limit: 20 },
  { q: 'Spülmaschinentabs', limit: 20 },
  { q: 'Reiniger', limit: 20 },
  { q: 'Küchenrolle', limit: 16 },
  { q: 'Weichspüler', limit: 16 },

  // Haushaltswaren & Wochenaktionen (NEU!)
  { q: 'Pfanne', limit: 20 },
  { q: 'Haushalt', limit: 20 },
  { q: 'Bettwäsche', limit: 16 },
  { q: 'Werkzeug', limit: 16 },

  // Drogerie & Pflege (NEU!)
  { q: 'Shampoo', limit: 20 },
  { q: 'Duschgel', limit: 20 },
  { q: 'Zahnpasta', limit: 16 },

  // Lebensmittel, Frische, Getränke & Tierbedarf
  { q: 'Käse', limit: 24 },
  { q: 'Butter', limit: 20 },
  { q: 'Kaffee', limit: 24 },
  { q: 'Fleisch', limit: 24 },
  { q: 'Wurst', limit: 20 },
  { q: 'Obst', limit: 20 },
  { q: 'Gemüse', limit: 20 },
  { q: 'Pizza', limit: 20 },
  { q: 'Nudeln', limit: 20 },
  { q: 'Bier', limit: 20 },
  { q: 'Cola', limit: 20 },
  { q: 'Schokolade', limit: 20 },
  { q: 'Hundefutter', limit: 18 },
  { q: 'Katzenfutter', limit: 18 }
];

async function buildDailyLiveFeed(zipCode: string) {
  let keys = await getMarktguruKeys(false);

  // Test-Probe: Falls Keys abgelaufen (401/403), einmal frisch von marktguru.de holen
  const probe = await queryMarktguruSearch('Kaufland', zipCode, keys, 30);
  if (!probe.ok && (probe.status === 401 || probe.status === 403)) {
    keys = await getMarktguruKeys(true);
  }

  const offerMap = new Map<string, any>();
  const ingestList = (rawList: any[]) => {
    rawList.forEach(item => {
      const mapped = mapMarktguruOffer(item);
      if (mapped && !offerMap.has(mapped.id)) {
        offerMap.set(mapped.id, mapped);
      }
    });
  };

  if (probe.ok) ingestList(probe.results);

  // In parallelen 6er-Batches abfragen (schnell & freundlich zur API)
  const restQueries = DAILY_FEED_QUERIES.filter(x => x.q !== 'Kaufland');
  const BATCH_SIZE = 6;
  for (let i = 0; i < restQueries.length; i += BATCH_SIZE) {
    const slice = restQueries.slice(i, i + BATCH_SIZE);
    const batchRes = await Promise.all(
      slice.map(entry => queryMarktguruSearch(entry.q, zipCode, keys, entry.limit))
    );
    batchRes.forEach(r => {
      if (r.ok) ingestList(r.results);
    });
  }

  // Abgelaufene Angebote ausfiltern
  const todayIso = getBerlinDateKey();
  const offers = Array.from(offerMap.values())
    .filter(o => !o.validToIso || o.validToIso >= todayIso)
    .sort((a, b) => {
      if (b.discountPercent !== a.discountPercent) return b.discountPercent - a.discountPercent;
      return a.price - b.price;
    });

  return offers;
}

// ============================================================================
// GET /api/offers?zip=79618[&q=Suchbegriff][&store=kaufland][&refresh=1]
// ============================================================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawZip = String(searchParams.get('zip') || DEFAULT_ZIP).replace(/[^0-9]/g, '').slice(0, 5);
    const zipCode = rawZip.length === 5 ? rawZip : DEFAULT_ZIP;
    const queryTerm = String(searchParams.get('q') || '').trim();
    const storeFilter = String(searchParams.get('store') || '').trim().toLowerCase();
    const forceRefresh = searchParams.get('refresh') === '1' || searchParams.get('refresh') === 'true';

    const dateKey = getBerlinDateKey();

    // ------------------------------------------------------------------------
    // MODUS A: DIREKTE LIVE-SUCHE NACH PRODUKT ODER MARKT (SOFORT-ABFRAGE)
    // ------------------------------------------------------------------------
    if (queryTerm) {
      let keys = await getMarktguruKeys(false);
      let res = await queryMarktguruSearch(queryTerm, zipCode, keys, 48);
      if (!res.ok && (res.status === 401 || res.status === 403)) {
        keys = await getMarktguruKeys(true);
        res = await queryMarktguruSearch(queryTerm, zipCode, keys, 48);
      }

      const todayIso = getBerlinDateKey();
      const map = new Map<string, any>();
      (res.results || []).forEach(r => {
        const mapped = mapMarktguruOffer(r);
        if (!mapped) return;
        if (mapped.validToIso && mapped.validToIso < todayIso) return;
        if (storeFilter && storeFilter !== 'all' && mapped.storeId !== storeFilter) return;
        if (!map.has(mapped.id)) map.set(mapped.id, mapped);
      });

      const list = Array.from(map.values()).sort((a, b) => {
        if (b.discountPercent !== a.discountPercent) return b.discountPercent - a.discountPercent;
        return a.price - b.price;
      });

      return NextResponse.json({
        ok: true,
        mode: 'live_search',
        query: queryTerm,
        zipCode,
        dateKey,
        updatedAt: new Date().toISOString(),
        source: 'live',
        totalCount: list.length,
        offers: list
      });
    }

    // ------------------------------------------------------------------------
    // MODUS B: TAGESAKTUELLER KOMPLETT-FEED (1× TÄGLICH AUTOMATISCH + CACHE)
    // ------------------------------------------------------------------------
    const cacheKey = `${zipCode}::${dateKey}`;

    // 1. Schneller In-Memory-Cache (gleicher Tag, bis zu 3h)
    if (!forceRefresh) {
      const memHit = memoryFeedCache.get(cacheKey);
      if (memHit && Date.now() - memHit.ts < 3 * 60 * 60 * 1000 && memHit.data?.offers?.length > 0) {
        return NextResponse.json({ ...memHit.data, cachedFrom: 'memory' });
      }
    }

    const supabase = getSupabaseAdminOrNull();

    // 2. Supabase Tages-Cache prüfen (bleibt über Vercel Serverless Restarts erhalten!)
    if (!forceRefresh && supabase) {
      try {
        const { data: row, error } = await supabase
          .from('tw_offers_cache')
          .select('offers, meta, updated_at')
          .eq('cache_key', cacheKey)
          .maybeSingle();

        if (!error && row && Array.isArray(row.offers) && row.offers.length > 0) {
          const payload = {
            ok: true,
            mode: 'daily_feed',
            zipCode,
            dateKey,
            updatedAt: row.updated_at,
            source: 'live_daily_cache',
            totalCount: row.offers.length,
            offers: row.offers
          };
          memoryFeedCache.set(cacheKey, { data: payload, ts: Date.now() });
          return NextResponse.json({ ...payload, cachedFrom: 'supabase' });
        }
      } catch {
        // Tabelle optional – weiter mit Live-Abruf
      }
    }

    // 3. Frischen Tages-Feed live laden!
    const liveOffers = await buildDailyLiveFeed(zipCode);

    if (liveOffers.length > 0) {
      const nowIso = new Date().toISOString();
      const payload = {
        ok: true,
        mode: 'daily_feed',
        zipCode,
        dateKey,
        updatedAt: nowIso,
        source: 'live_fresh',
        totalCount: liveOffers.length,
        offers: liveOffers
      };

      memoryFeedCache.set(cacheKey, { data: payload, ts: Date.now() });

      // In Supabase für den restlichen Tag ablegen (alle Geräte profitieren sofort!)
      if (supabase) {
        try {
          await supabase.from('tw_offers_cache').upsert(
            {
              cache_key: cacheKey,
              zip_code: zipCode,
              date_key: dateKey,
              offers: liveOffers,
              meta: { count: liveOffers.length, refreshedAt: nowIso },
              updated_at: nowIso
            },
            { onConflict: 'cache_key' }
          );
        } catch {}
      }

      return NextResponse.json(payload);
    }

    // 4. Notfall-Fallback: Letzter vorhandener Cache aus Supabase (z. B. Vortag)
    if (supabase) {
      try {
        const { data: lastRow } = await supabase
          .from('tw_offers_cache')
          .select('offers, date_key, updated_at')
          .eq('zip_code', zipCode)
          .order('date_key', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastRow && Array.isArray(lastRow.offers) && lastRow.offers.length > 0) {
          return NextResponse.json({
            ok: true,
            mode: 'daily_feed',
            zipCode,
            dateKey: lastRow.date_key,
            updatedAt: lastRow.updated_at,
            source: 'stale_cache',
            totalCount: lastRow.offers.length,
            offers: lastRow.offers
          });
        }
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      mode: 'daily_feed',
      zipCode,
      dateKey,
      updatedAt: new Date().toISOString(),
      source: 'fallback_empty',
      totalCount: 0,
      offers: []
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Fehler beim Laden der Live-Angebote', offers: [] },
      { status: 500 }
    );
  }
}
