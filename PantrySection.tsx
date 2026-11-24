// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
'use client';

//
//
// ============================================================================
// PART 01: IMPORTS, LAGERORTE, KATEGORIEN, MARKEN & TABELLEN-STYLES
// ============================================================================
//
//

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Package, Trash2, Plus, CheckCircle2, Camera,
  ShoppingCart, RotateCcw, ChefHat, Pencil, Check, X,
  Table as TableIcon, LayoutGrid, Wand2,
  AlertTriangle, BellRing, Search, SlidersHorizontal,
  ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, FolderKanban, Tag
} from 'lucide-react';
import * as Cfg from './touchwallConfig';
import PantryRecipes from './PantryRecipes';
import PantryOffers from './PantryOffers';
import ProductThumb from './ProductThumb';
import { uploadProductPhotoToSupabase } from './productImageUtils';

const {
  formatDateStr,
  addDays,
  createTodoistTaskItem,
  playTouchwallAlarmSound
} = Cfg;

// Erweiterte Lagerorte (inkl. Vorratsschrank & Tierfutter)
export const STORAGE_LOCATIONS = [
  { id: 'all',      icon: '🏠', name: 'Alle Orte',       label: '🏠 Alle Orte',       short: '🏠 Alle' },
  { id: 'fridge',   icon: '🧊', name: 'Kühlschrank',     label: '🧊 Kühlschrank',     short: '🧊 Kühl.' },
  { id: 'freezer',  icon: '❄️', name: 'Gefrierschrank',  label: '❄️ Gefrierschrank',  short: '❄️ TK' },
  { id: 'cupboard', icon: '🚪', name: 'Vorratsschrank',  label: '🚪 Vorratsschrank',  short: '🚪 Schrank' },
  { id: 'pantry',   icon: '🗄️', name: 'Keller / Vorrat', label: '🗄️ Keller / Vorrat', short: '🗄️ Keller' },
  { id: 'kitchen',  icon: '🍎', name: 'Küche',           label: '🍎 Küche',           short: '🍎 Küche' },
  { id: 'petfood',  icon: '🐾', name: 'Tierfutter',      label: '🐾 Tierfutter',      short: '🐾 Tierfutter' }
];

export const FOOD_CATEGORIES = [
  { id: 'drinks',         icon: '🧃', title: 'Getränke',                               short: 'Getränke',          desc: 'Wasser, Kaffee, Tee und ungesüßte Säfte.' },
  { id: 'produce',        icon: '🥦', title: 'Obst und Gemüse',                        short: 'Obst & Gemüse',     desc: 'Frisches Obst, Gemüse, Salate, Pilze und Hülsenfrüchte.' },
  { id: 'grains',         icon: '🌾', title: 'Getreide, Getreideprodukte & Kartoffeln', short: 'Getreide & Nudeln', desc: 'Brot, Nudeln, Reis, Flocken und Kartoffeln.' },
  { id: 'dairy',          icon: '🧀', title: 'Milch und Milchprodukte',                short: 'Milch & Käse',      desc: 'Milch, Joghurt, Quark, Sahne und Käse.' },
  { id: 'meat_fish_eggs', icon: '🥩', title: 'Fleisch, Fisch, Wurst und Eier',         short: 'Fleisch & Fisch',   desc: 'Eiweiß- und Nährstofflieferanten.' },
  { id: 'oils_fats',      icon: '🧈', title: 'Öle und Fette (inkl. Würzmittel)',       short: 'Öle & Gewürze',     desc: 'Öle, Butter, Kräuterbutter, Essig, Senf, Gewürze und Soßen.' },
  { id: 'sweets_snacks',  icon: '🍫', title: 'Süßwaren, Knabbereien & Tierfutter',     short: 'Snacks & Sonst.',   desc: 'Snacks, Schokolade, Tiernahrung und Sonstiges.' }
];

const FOOD_EMOJI_PICKER = [
  '🌭', '🥩', '🍗', '🥓', '🍔', '🐟', '🥚', '🧀', '🧈', '🥛',
  '🥣', '🥬', '🥒', '🍅', '🫑', '🥕', '🥔', '🧅', '🥦', '🌽',
  '🍄', '🥑', '🍊', '🍎', '🍌', '🍓', '🍋', '🍇', '🍝', '🍚',
  '🥖', '🥐', '🍕', '🌮', '🥫', '🌾', '🍫', '🍪', '🧃', '🐶',
  '🐾', '🦴', '🐱', '🐴'
];

const KNOWN_BRAND_PREFIXES = [
  'Kaufland', 'K-Classic', 'K-Bio', 'K-Favourites', 'K-Purland', 'ja!', 'GUT&GÜNSTIG', 'Gut & Günstig',
  'EDEKA', 'REWE Beste Wahl', 'REWE Bio', 'REWE', 'Milbona', 'Milsani', 'Bellarom',
  'Kania', 'Combino', 'Alnatura', 'dmBio', 'Schär', 'Dr. Schär', 'Seitz', 'Gefro', 'Meggle',
  'Philadelphia', 'Thomy', 'Heinz', 'Hengstenberg', 'Pfanni', 'Barilla', 'Dr. Oetker',
  'Iglo', 'Frosta', 'Landfein', 'Schwarzwaldmilch', 'Weihenstephan', 'Bärenmarke',
  'Kerrygold', 'Oro di Parma', 'Alnavit', 'Bauckhof', 'Müller', 'Ehrmann', 'Zott',
  'Danone', 'Arla', 'Exquisa', 'miree', 'Rama', 'Lätta', 'Bonduelle', 'Kühne',
  'Knorr', 'Maggi', 'Ostmann', 'Löwensenf', 'Ernte Krone', 'mysmile', 'Die süße Susi',
  'Rinti', 'Wolfsblut', 'Josera', 'Belcando', 'Animonda', 'Premiere', 'Pedigree'
];

// Erzwingt dunkle, kontrastreiche Dropdowns in der Excel-Tabelle