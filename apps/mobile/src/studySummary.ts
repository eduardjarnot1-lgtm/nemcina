import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { studySummary } from '@nemcina/core';
import { useProgress } from './progress';

/** Refresh day boundaries while open and immediately after returning to the app. */
export function useStudySummary() {
  const { studyDays } = useProgress();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 30_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return useMemo(() => studySummary(studyDays, {
    now, offsetMinutes: -new Date(now).getTimezoneOffset(),
  }), [studyDays, now]);
}
