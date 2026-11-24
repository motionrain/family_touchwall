// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import {
  X, Copy, ClipboardPaste, Volume2, Clock, Share2
} from 'lucide-react';
import * as Cfg from './touchwallConfig';
import { registerPendingCalendarOp } from './sync';

const {
  formatDateStr,
  addDays,
  playTouchwallAlarmSound,
  DEFAULT_SCHOOL,
  updateTodoistTaskItem
} = Cfg;

export default function TouchwallModals({
  eventModal,
  setEventModal,
  saveEventModal,
  deleteEventById,
  duplicateEventToTarget,
  setCopiedEvent,
  taskModal,
  setTaskModal,
  setFamilyTasks,
  setEvents,
  pendingCalendarOpsRef,
  sendCalendarApiAction,
  lastLocalEditTimeRef,
  safeTodoistConfig,
  yearDayModal,
  setYearDayModal,
  safeEvents,
  schoolModal,
  setSchoolModal,
  setSchoolData,
  activeSchoolChild,
  qrModalOpen,
  setQrModalOpen,
  qrShareUrl,
  activeAlarmBanner,
  setActiveAlarmBanner,
  toast,
  safeMembers,
  todayStr,
  themeStyles,
  getMemberStyles,
  renderAvatar,
  triggerEventAlarmNow,
  showToast
}) {
  