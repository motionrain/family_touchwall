// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Tag, ShoppingCart, Search, ExternalLink,
  TrendingDown, Trash2, MapPin, ChevronDown,
  BookOpen, RefreshCw, Check, Sparkles, Loader2
} from 'lucide-react';
import { getFoodEmoji } from './PantrySection';

// ============================================================================
// 1. REGIONALE SUPERMÄRKTE & DISCOUNTER (RHEINFELDEN / SÜDBADEN)
// ============================================================================
// ============================================================================
// 2. ANGEBOTS-KATEGORIEN (INKL. HAUSHALT, HAUSHALTSWAREN & DROGERIE)
// ============================================================================
export const OFFER_CATEGORIES = [
  { id: 'all',            icon: '🏷️', label: 'Alle Kategorien',     short: 'Alle' },
  { id: 'haushalt',       icon: '🧺', label: 'Haushalt & Reinigung', short: 'Haushalt' },
  { id: 'haushaltswaren', icon: '🍳', label: 'Haushaltswaren & Aktion', short: 'Non-Food' },
  { id: 'drogerie',       icon: '🧴', label: 'Drogerie & Pflege',    short: 'Drogerie' },
  { id: 'frische',        icon: '🥦', label: 'Obst & Gemüse',        short: 'Frische' },
  { id: 'fleisch',        icon: '🥩', label: 'Fleisch, Wurst & Fisch', short: 'Fleisch' },
  { id: 'milch',          icon: '🧀', label: 'Milch, Käse & Butter', short: 'Milch/Käse' },
  { id: 'vorrat',         icon: '🍝', label: 'Vorrat, Brot & TK',    short: 'Vorrat/TK' },
  { id: 'getraenke',      icon: '🧃', label: 'Getränke & Kaffee',    short: 'Getränke' },
  { id: 'snacks',         icon: '🍫', label: 'Süßes & Snacks',       short: 'Snacks' },
  { id: 'tier',           icon: '🐾', label: 'Tierfutter & Bedarf',  short: 'Tierbedarf' }
];

// ============================================================================
// 3. OFFLINE-/NOTFALL-BASISKATALOG (INKL. HAUSHALT, FALLS LIVE-API MAL KLEMMT)
// ============================================================================
