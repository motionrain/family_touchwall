// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
'use client';

//
//
// ============================================================================
// PART 01: IMPORTS, KONSTANTEN & KOMPONENTEN-EINBINDUNG
// ============================================================================
//
//

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, CheckSquare, ShoppingCart, Package, Camera,
  RefreshCw, LogOut, Cloud, Trash2, Check, X,
  BellRing, Download, WifiOff, Menu, SlidersHorizontal,
  Search, RotateCcw, Wand2, AlertTriangle, Pencil, CheckCircle2,
  Utensils, ChefHat, Tag, FileText, GraduationCap, Swords, Palette,
  Lock, Unlock, ChevronDown, Users, Eye
} from 'lucide-react';
import * as Cfg from '../touchwallConfig';
import {
  PUBLIC_CLOUD_BACKEND_URL,
  callCloudApi,
  useTouchwallRealtime,
  useTouchwallPresence,
  hasJsonChanged,
  loadLocalSyncMeta,
  saveLocalSyncMeta,
  mergeSyncMetaMaps,
  mergePantryChannelSafe,
  registerPendingCalendarOp,
  mergeCalendarEventsSafe,
  mergeSkillBoardSafe,
  isAdminWriteAllowed,
  useAdminAccess,
  setStoredAdminToken,
  clearStoredAdminToken,
  getStoredActiveMember,
  setStoredMemberToken,
  clearStoredMemberToken,
  setGuestModeActive,
  isGuestModeActive
} from '../sync';
import AuthScreen from '../AuthScreen';
import {
  getFoodEmoji,
  FOOD_CATEGORIES,
  detectFoodCategory
} from '../PantrySection';
import OtherSections from '../OtherSections';
import MealPlanSection from '../MealPlanSection';
import NotesSection from '../NotesSection';
import PantryRecipes from '../PantryRecipes';
import PantryOffers from '../PantryOffers';
import SchoolSection from '../SchoolSection';
import QuestSection from '../quest';
import SettingsSection from '../SettingsSection';
import PocketAgenda from './PocketAgenda';
import PocketTasks from './PocketTasks';
import PocketScanner from './PocketScanner';
import PocketShopping from './PocketShopping';

const openCookieSettingsModal = () => {};

const SHOW_OAUTH_UI = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true';

const STORAGE_PILLS = [
  { id: 'fridge',   label: '🧊 Kühlschrank' },
  { id: 'freezer',  label: '❄️ Tiefkühler' },
  { id: 'cupboard', label: '🗄️ Vorratsschrank' },
  { id: 'pantry',   label: '🥫 Speisekammer' },
  { id: 'kitchen',  label: '🍳 Küche' },
  { id: 'petfood',  label: '🐾 Tierfutter' }
];

const {
  DEFAULT_MEMBERS,
  DEFAULT_MEALS,
  DEFAULT_NOTES,
  DEFAULT_SCHOOL,
  COLOR_PALETTES,
  formatDateStr,
  addDays,
  buildThemeStyles,
  buildMemberStyles,
  discoverTodoistWorkspace,
  pullFromTodoistTwoWay,
  createTodoistTaskItem,
  closeOrReopenTodoistTask,
  deleteTodoistTask
} = Cfg;

//
//
// ============================================================================
// PART 02: PRODUKT-, MARKEN-, BILD- & GLUTENFREI-HELFER
// ============================================================================
//
//

