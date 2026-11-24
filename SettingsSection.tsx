// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, RefreshCw, Cloud, Check, Plus, ChevronDown,
  KeyRound, Mail, Unlink, Copy, Lock, Unlock, Palette,
  Image as ImageIcon, RotateCcw, Trash2, SlidersHorizontal,
  Smile, ShieldAlert, Timer, X, UserCheck, Film
} from 'lucide-react';
import { COLOR_PALETTES, PAGE_THEMES, AVATAR_EMOJIS } from './touchwallConfig';
import {
  PUBLIC_CLOUD_BACKEND_URL,
  callCloudApi,
  getStoredAdminToken,
  getStoredMemberToken,
  setStoredAdminToken,
  clearStoredAdminToken
} from './sync';

const SHOW_OAUTH_UI = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true';
const ADMIN_INACTIVITY_MS = 5 * 60 * 1000;

