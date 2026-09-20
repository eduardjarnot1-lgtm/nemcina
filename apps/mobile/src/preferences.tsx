/**
 * What the learner chose about how they learn.
 *
 * Small, local and not secret, so AsyncStorage rather than SecureStore. These
 * are not synced: a daily goal set on a phone on the train is a phone-shaped
 * decision, and pushing it to a tablet would be surprising. Progress syncs;
 * preferences do not.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CEFR_LEVELS, type CefrLevel } from '@nemcina/core';
import { setHapticsEnabled } from './haptics';
import { setSoundEnabled } from './sound';

const KEY = 'nemcina:preferences:v1';

export interface Preferences {
  /** The welcome flow has been seen. Until then, the app opens there. */
  readonly onboarded: boolean;
  /** Where the placement test put them, or what they picked. */
  readonly startingLevel: CefrLevel | null;
  /** Items per session. The learner's own answer to "how much is a day". */
  readonly dailyGoal: number;
  /** Buzz on answers and rewards. On by default, off in one tap. */
  readonly haptics: boolean;
  /** Sound is built but ships silent: there are no audio assets yet, and a
   *  setting that promises a sound it cannot play is worse than no setting. */
  readonly sound: boolean;
}

/** Offered as three answers rather than a slider: a number nobody picked is a number nobody keeps. */
export const GOAL_CHOICES = [8, 12, 20] as const;

export const DEFAULT_PREFERENCES: Preferences = {
  onboarded: false,
  startingLevel: null,
  dailyGoal: 12,
  haptics: true,
  sound: false,
};

interface PreferencesContextValue {
  readonly preferences: Preferences;
  readonly ready: boolean;
  update(changes: Partial<Preferences>): Promise<void>;
  reset(): Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/** Anything read back from storage is a stranger until it has been checked. */
function parse(raw: string | null): Preferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const level = typeof value.startingLevel === 'string'
      && (CEFR_LEVELS as readonly string[]).includes(value.startingLevel)
      ? value.startingLevel as CefrLevel
      : null;
    const goal = typeof value.dailyGoal === 'number' && Number.isFinite(value.dailyGoal)
      ? Math.min(50, Math.max(4, Math.round(value.dailyGoal)))
      : DEFAULT_PREFERENCES.dailyGoal;
    return {
      onboarded: value.onboarded === true,
      startingLevel: level,
      dailyGoal: goal,
      // Absent means "not chosen yet", which is the default rather than false —
      // an older stored preferences blob must not silently turn haptics off.
      haptics: typeof value.haptics === 'boolean' ? value.haptics : DEFAULT_PREFERENCES.haptics,
      sound: typeof value.sound === 'boolean' ? value.sound : DEFAULT_PREFERENCES.sound,
    };
  } catch {
    // Corrupt preferences must not stop the app; the defaults are all usable.
    return DEFAULT_PREFERENCES;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  // The haptics module is asked once here rather than threaded through every
  // screen, so a button deep in a lesson does not need the preferences context
  // just to know whether it may buzz.
  useEffect(() => { setHapticsEnabled(preferences.haptics); }, [preferences.haptics]);
  // Same for sound, which currently has no player registered and so does
  // nothing at all. Wiring it now means adding the assets touches one file.
  useEffect(() => { setSoundEnabled(preferences.sound); }, [preferences.sound]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let raw: string | null = null;
      try { raw = await AsyncStorage.getItem(KEY); } catch { raw = null; }
      if (cancelled) return;
      setPreferences(parse(raw));
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback(async (changes: Partial<Preferences>) => {
    setPreferences((previous) => {
      const next = { ...previous, ...changes };
      // Fire and forget: a failed write costs a setting, not the session.
      void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const reset = useCallback(async () => {
    setPreferences(DEFAULT_PREFERENCES);
    try { await AsyncStorage.removeItem(KEY); } catch { /* nothing to undo */ }
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ preferences, ready, update, reset }),
    [preferences, ready, update, reset],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}
