// @ts-nocheck
'use client';

import React from 'react';
import SchoolSection from './SchoolSection';
import MealPlanSection from './MealPlanSection';
import NotesSection from './NotesSection';
import SettingsSection from './SettingsSection';

export default function OtherSections(props) {
  const { activeSection } = props;

  if (activeSection === 'schule') {
    return <SchoolSection {...props} />;
  }

  if (activeSection === 'essen') {
    return <MealPlanSection {...props} />;
  }

  if (activeSection === 'listen') {
    return <NotesSection {...props} />;
  }

  return <SettingsSection {...props} />;
}
