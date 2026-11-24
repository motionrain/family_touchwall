// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState } from 'react';
import { RefreshCw, Clock, Cloud, CalendarCheck, FolderKanban, Plus, Smartphone } from 'lucide-react';
import { formatDateStr, addDays } from './touchwallConfig';

const PRIORITY_BADGES = {
  4: { label: '🔥 P1 Dringend', classes: 'bg-rose-500/25 text-rose-300 border-rose-400/50' },
  3: { label: '🟠 P2 Wichtig',  classes: 'bg-amber-500/25 text-amber-300 border-amber-400/50' },
  2: { label: '🔵 P3 Mittel',   classes: 'bg-sky-500/25 text-sky-300 border-sky-400/50' },
  1: { label: '⚪ P4 Normal',   classes: 'bg-slate-500/20 text-slate-300 border-slate-400/30' }
};

