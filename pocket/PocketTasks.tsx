// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState, useMemo } from 'react';
import {
  Send, Trash2, SlidersHorizontal, ChevronDown,
  Calendar, Clock, Flag, FolderKanban, Bell, AlignLeft
} from 'lucide-react';
import * as Cfg from '../touchwallConfig';

const { pushTodoistTaskToPhoneNow, formatDateStr, addDays } = Cfg;

const PRIORITY_META = {
  4: { label: 'P1 Dringend', short: 'P1', cls: 'bg-rose-500/25 text-rose-300 border-rose-400/50' },
  3: { label: 'P2 Hoch',     short: 'P2', cls: 'bg-amber-500/25 text-amber-300 border-amber-400/50' },
  2: { label: 'P3 Mittel',   short: 'P3', cls: 'bg-sky-500/25 text-sky-300 border-sky-400/50' },
  1: { label: 'P4 Normal',   short: 'P4', cls: 'bg-white/10 text-slate-300 border-white/15' }
};

export default function PocketTasks({
  safeMembers,
  openTasks,
  doneTasks,
  selectedPerson,
  todoistConfig,
  todayStr,
  themeStyles,
  onAddQuickTask,
  onToggleTask,
  onDeleteTask,
  onClearDoneTasks,
  showToast
}) {
  const resolvedToday = todayStr || (typeof formatDateStr === 'function' ? formatDateStr(new Date()) : new Date().toISOString().slice(0, 10));

  const [quickTaskText, setQuickTaskText] = useState('');
  const [quickTaskMember, setQuickTaskMember] = useState('hans');
  const [showOptions, setShowOptions] = useState(false);
  const [showDoneSection, setShowDoneSection] = useState(false);

  // Volle Todoist-Felder
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(resolvedToday);
  const [taskDueTime, setTaskDueTime] = useState('18:00');
  const [taskPriority, setTaskPriority] = useState(3);
  const [taskNotifyTime, setTaskNotifyTime] = useState('15m');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskSendPush, setTaskSendPush] = useState(true);
  const [taskAlsoCalendar, setTaskAlsoCalendar] = useState(false);

  const projectsList = useMemo(
    () => (Array.isArray(todoistConfig?.projects) ? todoistConfig.projects : []),
    [todoistConfig]
  );

  const assignableMembers = useMemo(
    () => (Array.isArray(safeMembers) ? safeMembers.filter(m => m.id !== 'all') : []),
    [safeMembers]
  );

  const effectiveMemberId = selectedPerson !== 'all' ? selectedPerson : quickTaskMember;
  const effectiveMemberObj = assignableMembers.find(m => m.id === effectiveMemberId) || assignableMembers[0];

  const getDateOffsetStr = (days) => {
    if (typeof addDays === 'function' && typeof formatDateStr === 'function') {
      return formatDateStr(addDays(new Date(), days));
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = quickTaskText.trim();
    if (!clean) return;

    onAddQuickTask({
      title: clean,
      memberId: effectiveMemberId,
      projectId: taskProjectId,
      dueDate: taskDueDate,
      dueTime: taskDueDate ? taskDueTime : '',
      priority: Number(taskPriority) || 3,
      description: taskDescription.trim(),
      notifyTime: taskNotifyTime,
      sendPush: taskSendPush,
      alsoCalendar: taskAlsoCalendar
    });

    setQuickTaskText('');
    setTaskDescription('');
    setTaskAlsoCalendar(false);
    setShowOptions(false);
  };

  const sortedOpenTasks = useMemo(() => {
    return (Array.isArray(openTasks) ? [...openTasks] : []).sort((a, b) => {
      const pDiff = (Number(b.priority) || 1) - (Number(a.priority) || 1);
      if (pDiff !== 0) return pDiff;
      return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
    });
  }, [openTasks]);

  const sortedDoneTasks = useMemo(() => {
    return Array.isArray(doneTasks)
      ? [...doneTasks].sort((a, b) => Number(b.doneAt || 0) - Number(a.doneAt || 0))
      : [];
  }, [doneTasks]);

  const selectedProjName = projectsList.find(p => String(p.id) === String(taskProjectId))?.name;
  const activePrioMeta = PRIORITY_META[taskPriority] || PRIORITY_META[3];

  return (
    <div className="space-y-3">
      {/* KOMPAKTES TODOIST-EINGABE-COCKPIT */}
      <form onSubmit={handleSubmit} className={'p-3 sm:p-4 rounded-3xl border space-y-2.5 shadow-sm ' + themeStyles.card}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase text-sky-400 truncate">
            ⚡ Neue Aufgabe (Todoist)
          </span>
          <button
            type="button"
            onClick={() => setShowOptions(prev => !prev)}
            className={'px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shrink-0 cursor-pointer ' +
              (showOptions ? 'tw-active-nav' : 'tw-nav-inactive')}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Optionen</span>
            <ChevronDown className={'w-3.5 h-3.5 transition-transform ' + (showOptions ? 'rotate-180' : '')} />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={quickTaskText}
            onChange={(e) => setQuickTaskText(e.target.value)}
            placeholder="Aufgabe eingeben..."
            className={'flex-1 min-w-0 h-11 px-3.5 rounded-2xl border text-sm font-bold ' + themeStyles.input}
          />
          <button
            type="submit"
            className="tw-active-nav h-11 px-4 rounded-2xl font-black text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{taskSendPush ? 'Push' : 'Anlegen'}</span>
          </button>
        </div>

        {/* KOMPAKTE STATUS-PILLS (ANTIPPEN ÖFFNET OPTIONEN) */}
        <div
          onClick={() => setShowOptions(prev => !prev)}
          className="flex items-center gap-1.5 flex-wrap cursor-pointer pt-0.5"
        >
          <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[11px] font-extrabold">
            👤 {effectiveMemberObj?.name?.split(' ')[0] || 'Familie'}
          </span>
          <span className={'px-2 py-0.5 rounded-lg border text-[11px] font-black ' + activePrioMeta.cls}>
            ⚑ {activePrioMeta.short}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[11px] font-bold">
            📅 {taskDueDate ? (taskDueDate === resolvedToday ? 'Heute' : taskDueDate.slice(8, 10) + '.' + taskDueDate.slice(5, 7) + '.') : 'Ohne Datum'}
            {taskDueDate && taskDueTime ? ' • ' + taskDueTime : ''}
          </span>
          {selectedProjName && (
            <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 text-[11px] font-extrabold truncate max-w-[140px]">
              📂 {selectedProjName}
            </span>
          )}
          {taskDescription.trim() && (
            <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-200 text-[11px] font-bold">
              📝 Notiz
            </span>
          )}
        </div>

        {/* AUSKLAPPBARE VOLLE TODOIST-OPTIONEN */}
        {showOptions && (
          <div className={'p-3 rounded-2xl border space-y-3 ' + themeStyles.subtle}>
            {/* ZEILE 1: PERSON + TODOIST-PROJEKT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black uppercase text-sky-400 mb-1">
                  👤 Zuständige Person
                </label>
                <select
                  value={effectiveMemberId}
                  disabled={selectedPerson !== 'all'}
                  onChange={(e) => setQuickTaskMember(e.target.value)}
                  className={'w-full h-10 px-2.5 rounded-xl border text-xs font-extrabold ' + themeStyles.input}
                >
                  {assignableMembers.map(m => (
                    <option key={m.id} value={m.id} className="bg-slate-800 text-white">
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-sky-400 mb-1 flex items-center gap-1">
                  <FolderKanban className="w-3 h-3" /> Todoist-Projekt
                </label>
                <select
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                  className={'w-full h-10 px-2.5 rounded-xl border text-xs font-extrabold ' + themeStyles.input}
                >
                  <option value="" className="bg-slate-800 text-white">
                    Standard (Person / Aufgaben-Projekt)
                  </option>
                  {projectsList.map(p => (
                    <option key={p.id} value={String(p.id)} className="bg-slate-800 text-white">
                      📂 {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ZEILE 2: DATUM-SCHNELLWAHL + DATUM & UHRZEIT */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-[10px] font-black uppercase text-amber-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Fälligkeit
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { l: 'Heute', v: resolvedToday },
                    { l: 'Morgen', v: getDateOffsetStr(1) },
                    { l: '+3T', v: getDateOffsetStr(3) },
                    { l: '+1W', v: getDateOffsetStr(7) },
                    { l: 'Ohne', v: '' }
                  ].map(opt => (
                    <button
                      key={opt.l}
                      type="button"
                      onClick={() => setTaskDueDate(opt.v)}
                      className={'px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ' +
                        (taskDueDate === opt.v ? 'tw-active-nav' : 'tw-nav-inactive')}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className={'h-10 px-2.5 rounded-xl border text-xs font-black ' + themeStyles.input}
                />
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-sky-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="time"
                    value={taskDueTime}
                    disabled={!taskDueDate}
                    onChange={(e) => setTaskDueTime(e.target.value)}
                    className={'w-full h-10 pl-8 pr-2.5 rounded-xl border text-xs font-black disabled:opacity-40 ' + themeStyles.input}
                  />
                </div>
              </div>
            </div>

            {/* ZEILE 3: PRIORITÄT + ERINNERUNG */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black uppercase text-rose-300 mb-1 flex items-center gap-1">
                  <Flag className="w-3 h-3" /> Priorität
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(Number(e.target.value))}
                  className={'w-full h-10 px-2.5 rounded-xl border text-xs font-extrabold ' + themeStyles.input}
                >
                  <option value={4} className="bg-slate-800 text-rose-300">🔴 P1 – Dringend</option>
                  <option value={3} className="bg-slate-800 text-amber-300">🟠 P2 – Hoch</option>
                  <option value={2} className="bg-slate-800 text-sky-300">🔵 P3 – Mittel</option>
                  <option value={1} className="bg-slate-800 text-white">⚪ P4 – Normal</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-emerald-300 mb-1 flex items-center gap-1">
                  <Bell className="w-3 h-3" /> Erinnerung
                </label>
                <select
                  value={taskNotifyTime}
                  onChange={(e) => setTaskNotifyTime(e.target.value)}
                  className={'w-full h-10 px-2.5 rounded-xl border text-xs font-extrabold ' + themeStyles.input}
                >
                  <option value="none" className="bg-slate-800 text-white">Keine</option>
                  <option value="0m" className="bg-slate-800 text-white">Pünktlich</option>
                  <option value="15m" className="bg-slate-800 text-white">15 Min. vorher</option>
                  <option value="30m" className="bg-slate-800 text-white">30 Min. vorher</option>
                  <option value="1h" className="bg-slate-800 text-white">1 Std. vorher</option>
                  <option value="1d" className="bg-slate-800 text-white">1 Tag vorher</option>
                </select>
              </div>
            </div>

            {/* ZEILE 4: BESCHREIBUNG */}
            <div>
              <label className="block text-[10px] font-black uppercase opacity-75 mb-1 flex items-center gap-1">
                <AlignLeft className="w-3 h-3" /> Beschreibung / Notiz (optional)
              </label>
              <textarea
                rows={2}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Zusätzliche Infos für Todoist..."
                className={'w-full px-3 py-2 rounded-xl border text-xs font-semibold resize-none ' + themeStyles.input}
              />
            </div>

            {/* ZEILE 5: PUSH & KALENDER-SCHALTER */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10 text-xs font-bold">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={taskSendPush}
                  onChange={(e) => setTaskSendPush(e.target.checked)}
                  className="w-4 h-4 accent-sky-500 rounded"
                />
                <span>📲 Sofort-Push senden</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={taskAlsoCalendar}
                  onChange={(e) => setTaskAlsoCalendar(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
                <span>📅 Auch in Kalender</span>
              </label>
            </div>
          </div>
        )}
      </form>

      {/* OFFENE AUFGABEN */}
      <div className={'rounded-3xl border p-3.5 sm:p-4 space-y-2.5 ' + themeStyles.card}>
        <div className="font-extrabold text-sm">✅ Offene Aufgaben ({sortedOpenTasks.length})</div>

        {sortedOpenTasks.length === 0 ? (
          <div className="py-6 text-center text-xs font-bold opacity-55">
            🎉 Alles erledigt! Keine offenen Aufgaben.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {sortedOpenTasks.map(task => {
              const mem = safeMembers.find(m => m.id === task.member) || safeMembers[1] || safeMembers[0];
              const pMeta = PRIORITY_META[Number(task.priority) || 1] || PRIORITY_META[1];
              const projName = projectsList.find(p => String(p.id) === String(task.projectId))?.name;

              return (
                <div
                  key={task.id}
                  onClick={() => onToggleTask(task)}
                  className={'p-3 rounded-2xl border flex items-start justify-between gap-2.5 cursor-pointer ' + themeStyles.subtle}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={false}
                      readOnly
                      className="w-5 h-5 mt-0.5 accent-indigo-600 rounded shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={'px-1.5 py-0.5 rounded-md border text-[9px] font-black ' + pMeta.cls}>
                          {pMeta.short}
                        </span>
                        {projName && (
                          <span className="px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 text-[9px] font-extrabold truncate max-w-[120px]">
                            📂 {projName}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm leading-snug break-words">{task.title}</div>
                      {task.description && (
                        <div className="text-[11px] opacity-75 line-clamp-2 break-words">{task.description}</div>
                      )}
                      <div className="text-[11px] font-semibold opacity-75">
                        👤 {mem?.name?.split(' ')[0] || 'Familie'} • ⏳ {task.due || 'Offen'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (task.todoistId && todoistConfig?.apiToken) {
                          pushTodoistTaskToPhoneNow(
                            todoistConfig.apiToken,
                            task.todoistId,
                            task.title,
                            mem?.todoistUserId,
                            todoistConfig.collaborators
                          );
                          showToast('Handy-Ping gesendet!', task.title, '📲');
                        } else {
                          showToast('Hinweis', 'Aufgabe ist lokal gespeichert.', 'ℹ️');
                        }
                      }}
                      title="Sofort-Ping an Todoist senden"
                      className="tw-glow-btn px-2.5 py-2 rounded-xl text-xs font-black"
                    >
                      📲
                    </button>

                    {onDeleteTask && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTask(task);
                        }}
                        title="Aufgabe löschen"
                        className="tw-nav-inactive p-2 rounded-xl text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* KOMPAKT AUSKLAPPBARE ERLEDIGT-LISTE */}
        {sortedDoneTasks.length > 0 && (
          <div className="pt-3 mt-2 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowDoneSection(prev => !prev)}
                className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5 cursor-pointer"
              >
                <span>☑️ Erledigt ({sortedDoneTasks.length})</span>
                <ChevronDown className={'w-4 h-4 transition-transform ' + (showDoneSection ? 'rotate-180' : '')} />
              </button>

              {onClearDoneTasks && (
                <button
                  type="button"
                  onClick={() => onClearDoneTasks(sortedDoneTasks)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600/90 text-white text-[11px] font-black flex items-center gap-1 shadow-md cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Leeren</span>
                </button>
              )}
            </div>

            {showDoneSection && (
              <div className="space-y-1.5">
                {sortedDoneTasks.map(task => {
                  const mem = safeMembers.find(m => m.id === task.member) || safeMembers[1] || safeMembers[0];
                  return (
                    <div
                      key={task.id}
                      className={'p-2.5 rounded-xl border flex items-center justify-between gap-2 ' + themeStyles.subtle}
                    >
                      <div
                        onClick={() => onToggleTask(task)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 opacity-65 cursor-pointer"
                      >
                        <input type="checkbox" checked={true} readOnly className="w-4 h-4 accent-emerald-500 rounded shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold line-through truncate">{task.title}</div>
                          <div className="text-[10px] opacity-75">👤 {mem?.name?.split(' ')[0] || 'Familie'}</div>
                        </div>
                      </div>

                      {onDeleteTask && (
                        <button
                          type="button"
                          onClick={() => onDeleteTask(task)}
                          className="tw-nav-inactive p-1.5 rounded-xl text-rose-400 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
