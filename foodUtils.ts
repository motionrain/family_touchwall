// @ts-nocheck

export const FOOD_CATEGORIES = [
  { id: 'drinks',         icon: '🧃', title: 'Getränke',                               desc: 'Wasser, Kaffee, Tee und ungesüßte Säfte.' },
  { id: 'produce',        icon: '🥦', title: 'Obst & Gemüse',                          desc: 'Frisches Obst, Gemüse, Salate und Hülsenfrüchte.' },
  { id: 'grains',         icon: '🌾', title: 'Getreide & Kartoffeln',                  desc: 'Brot, Nudeln, Reis, Flocken und Kartoffeln.' },
  { id: 'dairy',          icon: '🧀', title: 'Milchprodukte & Käse',                   desc: 'Milch, Joghurt, Quark, Sahne und Käse.' },
  { id: 'meat_fish_eggs', icon: '🥩', title: 'Fleisch, Fisch, Wurst & Eier',           desc: 'Eiweiß- und Nährstofflieferanten.' },
  { id: 'oils_fats',      icon: '🧈', title: 'Öle, Fette & Würzmittel',                desc: 'Öle, Butter, Kräuterbutter, Essig, Senf und Soßen.' },
  { id: 'sweets_snacks',  icon: '🍫', title: 'Süßwaren & Sonstiges',                   desc: 'Chips, Schokolade, Zuckerwaren und Sonstiges.' }
];

export const STORAGE_PILLS = [
  { id: 'fridge',   label: '🧊 Kühlschrank' },
  { id: 'freezer',  label: '❄️ TK / Gefrier.' },
  { id: 'cupboard', label: '🚪 Vorratsschrank' },
  { id: 'pantry',   label: '🗄️ Keller / Vorrat' },
  { id: 'kitchen',  label: '🍎 Küche' },
  { id: 'petfood',  label: '🐾 Tierfutter' }
];

export function detectFoodCategory(nameStr, customCategory = '') {
  if (customCategory && FOOD_CATEGORIES.some(c => c.id === customCategory)) {
    return customCategory;
  }
  const n = String(nameStr || '').toLowerCase();
  if (/butter|kräuterbutter|meggle|margarine|öl|sonnenblumenöl|olivenöl|rapsöl|kokosöl|fett|schmalz|essig|hengstenberg|senf|thomy|ketchup|mayo|mayonnaise|dressing|burger sauce|heinz|soße|sauce|pesto/.test(n)) return 'oils_fats';
  if (/schokolade|choco|schoko|nutella|keks|cookie|gummibär|chips|flips|eis|bonbon|praline/.test(n)) return 'sweets_snacks';
  if (/wasser|mineralwasser|kaffee|espresso|tee|saft|apfelsaft|orangensaft|schorle|cola|limo|getränk|sirup|kakao|\bbier\b|\bwein\b/.test(n)) return 'drinks';
  if (/milch|vollmilch|schwarzwaldmilch|landfein|joghurt|quark|käse|frischkäse|philadelphia|scheibenkäse|gouda|mozzarella|parmesan|emmentaler|camembert|feta|schlagsahne|sahne|schmand|creme fraiche|mascarpone|ayran|kefir/.test(n)) return 'dairy';
  if (/fleisch|hackfleisch|rinderhack|rind|schwein|hähnchen|huhn|pute|geflügel|schnitzel|steak|gulasch|wurst|bratwurst|rostbratwurst|leberwurst|würstchen|wiener|lyoner|salami|schinken|speck|aufschnitt|fisch|lachs|thunfisch|fischstäbchen|forelle|garnele|\bei\b|eier/.test(n)) return 'meat_fish_eggs';
  if (/brot|landbrot|mehrkorn|brötchen|toast|baguette|croissant|nudel|spaghetti|pasta|penne|rigatoni|tortellini|ravioli|spätzle|reis|spitzenreis|langkorn|basmati|jasmin|milchreis|getreide|haferflocken|müsli|cornflakes|mehl|grieß|stärke|wraps|wrap|tortilla|taco|schär|kartoffel|kartoffelpüree|pfanni|gnocchi|schupfnudel|pommes|knödel/.test(n)) return 'grains';
  if (/obst|apfel|äpfel|elstar|apfelmus|banane|clementine|mandarine|orange|susi|beere|erdbeer|himbeer|heidelbeer|traube|birne|zitrone|limette|kiwi|mango|ananas|melone|gemüse|salat|eisberg|mâche|mache|feldsalat|rucola|spinat|gurke|tomate|tomatenmark|passierte|oro di parma|paprika|karotte|möhre|zwiebel|knoblauch|brokkoli|blumenkohl|spargel|stangenspargel|rotkohl|kraut|pilz|champignon|avocado|mais|erbse|bohne|linse|kichererbse|chili sin carne|gefro/.test(n)) return 'produce';
  return 'sweets_snacks';
}

export function getFoodEmoji(nameStr, customEmoji = '') {
  if (customEmoji && String(customEmoji).trim() !== '') return String(customEmoji).trim();
  const n = String(nameStr || '').toLowerCase();
  if (/hunde|katzen|tierfutter|futter/.test(n)) return '🐶';
  if (/bratwurst|rostbratwurst|leberwurst|wurst|würstchen|wiener|lyoner|aufschnitt|schinken|salami|speck/.test(n)) return '🌭';
  if (/clementine|mandarine|orange|apfelsine|susi/.test(n)) return '🍊';
  if (/apfel|äpfel|elstar|boskoop|pink lady|rotkohl|apfelmus/.test(n)) return '🍎';
  if (/banane/.test(n)) return '🍌';
  if (/erdbeer|himbeer|heidelbeer|blaubeer|beeren|kirsch/.test(n)) return '🍓';
  if (/zitrone|limette/.test(n)) return '🍋';
  if (/salat|eisberg|mâche|mache|kopfsalat|rucola|feldsalat|spinat|dressing|kräuter/.test(n)) return '🥬';
  if (/gurke/.test(n)) return '🥒';
  if (/tomate|passierte|tomatenmark/.test(n)) return '🍅';
  if (/paprika|chili/.test(n)) return '🫑';
  if (/karotte|möhre/.test(n)) return '🥕';
  if (/kartoffel|kartoffelpüree|pfanni|pommes|gnocchi|schupfnudel/.test(n)) return '🥔';
  if (/zwiebel|knoblauch/.test(n)) return '🧅';
  if (/brokkoli|blumenkohl|spargel/.test(n)) return '🥦';
  if (/mais/.test(n)) return '🌽';
  if (/pilz|champignon/.test(n)) return '🍄';
  if (/avocado/.test(n)) return '🥑';
  if (/käse|frischkäse|philadelphia|scheibenkäse|gouda|mozzarella|parmesan|emmentaler|camembert|feta/.test(n)) return '🧀';
  if (/milch|vollmilch|hafermilch|kakao/.test(n)) return '🥛';
  if (/butter|kräuterbutter|meggle|margarine/.test(n)) return '🧈';
  if (/joghurt|quark|pudding|schmand|sahne|schlagsahne|creme/.test(n)) return '🥣';
  if (/\bei\b|eier/.test(n)) return '🥚';
  if (/hähnchen|huhn|pute|geflügel|nuggets/.test(n)) return '🍗';
  if (/hackfleisch|rinderhack|rind|steak|fleisch|schnitzel|gulasch/.test(n)) return '🥩';
  if (/fisch|lachs|thunfisch|fischstäbchen|forelle/.test(n)) return '🐟';
  if (/nudel|spaghetti|pasta|penne|tortellini|ravioli|spätzle/.test(n)) return '🍝';
  if (/reis|spitzenreis|langkorn|basmati|jasmin|milchreis/.test(n)) return '🍚';
  if (/brot|landbrot|brötchen|toast|baguette|croissant/.test(n)) return '🥖';
  if (/pizza|flammkuchen/.test(n)) return '🍕';
  if (/wrap|taco|tortilla|schär/.test(n)) return '🌮';
  if (/senf|thomy|heinz|ketchup|mayo|soße|sauce|pesto|öl|essig/.test(n)) return '🥫';
  if (/mehl|zucker|salz|haferflocken|müsli|cornflakes/.test(n)) return '🌾';
  if (/schokolade|choco|schoko|nutella|keks|gummibär|chips|eis/.test(n)) return '🍫';
  if (/wasser|saft|cola|limo|bier|wein|kaffee|tee/.test(n)) return '🧃';
  return '🥫';
}

export function stepMobileQty(rawQtyStr, delta) {
  const clean = String(rawQtyStr || '1x').trim();
  const match = clean.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return delta > 0 ? '2x' : '1x';
  const val = parseFloat(match[1].replace(',', '.'));
  const unit = (match[2] || 'x').trim();
  const uLower = unit.toLowerCase();
  const step = (uLower === 'g' || uLower === 'ml') ? (val >= 200 ? 50 : 25) : 1;
  const nextVal = Math.max(step, Math.round((val + delta * step) * 100) / 100);
  return nextVal + (unit ? (uLower === 'x' ? 'x' : ' ' + unit) : 'x');
}

export function decrementItemPieceCount(rawQtyStr) {
  const clean = String(rawQtyStr || '1x').trim();
  const multiMatch = clean.match(/^(\d+(?:[.,]\d+)?)\s*([x×])\s*(\d+(?:[.,]\d+)?)\s*(g|ml|kg|l|gr|stk|pcs)(.*)$/i);
  if (multiMatch) {
    const currentCount = Math.round(parseFloat(multiMatch[1].replace(',', '.')));
    const unitWeight = parseFloat(multiMatch[3].replace(',', '.'));
    const unit = multiMatch[4];
    const tail = multiMatch[5] || '';
    if (currentCount > 1) {
      const nextCount = currentCount - 1;
      const nextTotal = Math.round(nextCount * unitWeight * 100) / 100;
      if (tail.includes('=')) return { remaining: nextCount, nextQtyStr: nextCount + ' x ' + unitWeight + ' ' + unit + ' = ' + nextTotal + ' ' + unit };
      if (tail.includes('(')) return { remaining: nextCount, nextQtyStr: nextCount + ' x ' + unitWeight + unit + ' (' + nextTotal + unit + ')' };
      return { remaining: nextCount, nextQtyStr: nextCount + 'x ' + unitWeight + unit };
    }
    return { remaining: 0, nextQtyStr: '0' };
  }

  const pieceMatch = clean.match(/^(\d+(?:[.,]\d+)?)\s*(x|pcs|pc|stk|stück|pkg|pack|pck|dosen|dose|flaschen|fl|gläser|glas|becher|rollen|rolle)?$/i);
  if (pieceMatch) {
    const val = parseFloat(pieceMatch[1].replace(',', '.'));
    const rawUnit = pieceMatch[2] || 'x';
    const hasSpace = /^\d+(?:[.,]\d+)?\s+/.test(clean);
    const hadDecimalZero = /\.0\b/.test(pieceMatch[1]);
    if (val > 1) {
      const nextVal = Math.max(1, Math.round(val - 1));
      const formattedNum = hadDecimalZero ? (nextVal + '.0') : String(nextVal);
      return { remaining: nextVal, nextQtyStr: formattedNum + (hasSpace ? ' ' : '') + rawUnit };
    }
    return { remaining: 0, nextQtyStr: '0' };
  }
  return { remaining: 0, nextQtyStr: '0' };
}

export function playMobileBeep(type = 'scan') {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'shopping') {
      [587.33, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.22, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.3);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    }
  } catch (e) {}
}
