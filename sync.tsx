// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */
'use client';

import { createClient } from '@supabase/supabase-js';
import React from 'react';
import {
  RefreshCw, X, ShieldCheck
} from 'lucide-react';

export const PUBLIC_CLOUD_BACKEND_URL = '/api/cloud';

// Eindeutige Tab-/Geräte-ID, damit eigene Speicherungen keinen doppelten Live-Reload auslösen
export const TOUCHWALL_CLIENT_ID =
  typeof window !== 'undefined'
    ? `tw_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
    : 'server';

// ============================================================================
// ELTERN-PIN ADMIN-TOKEN (SESSION-SPEICHER MIT AUTO-LOCK)
// ============================================================================
