// @ts-nocheck
/* eslint-disable react/no-unescaped-entities */

export function safeArr(val, fallback = []) {
  return Array.isArray(val) ? val : fallback;
}

export function safeObj(val, fallback = {}) {
  return val && typeof val === 'object' && !Array.isArray(val) ? val : fallback;
}

// =========================================================
// COOKIE- & SESSION-HELFER FÜR DEN LOGIN-SCHUTZ
// =========================================================
