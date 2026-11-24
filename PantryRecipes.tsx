// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Utensils, ShoppingCart, Globe, Clock,
  Wand2, ExternalLink, ChefHat, Filter, Check,
  ChevronDown, SlidersHorizontal
} from 'lucide-react';
import { getFoodEmoji, isProductGlutenFree, getDaysUntil } from './PantrySection';

// Bereinigt Produktnamen von Supermarkt-Marken & Mengenangaben für präzises Rezept-Matching
function cleanProductCoreName(rawName) {
  return String(rawName || '')
    .toLowerCase()
    .replace(/\/.*$/, ' ')
    .replace(/\b(\d+\s*(g|kg|ml|l|stk|pcs|x|pkg)|k-classic|kaufland|ja!|rewe|edeka|schär|seitz|pfanni|gefro|meggle|landfein|haltbare|schwarzwaldmilch|oro di parma|hengstenberg|delikatess|bio|classic|glutenfrei|frei von|tk)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// UMFASSENDES ENGLISCH -> DEUTSCH WÖRTERBUCH FÜR WEB-REZEPTE & ZUTATEN
// ============================================================================