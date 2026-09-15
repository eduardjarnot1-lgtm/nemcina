/**
 * Progress, and where it lives on a phone.
 *
 * The engine knows nothing about AsyncStorage; it knows `ProgressStore`. This
 * module supplies the phone's implementation and puts it behind a React context
 * so no screen constructs its own store — two stores would mean two caches and
 * one of them stale.
 *
 * Writes go straight through to the device. Holding a session in memory and
 * flushing at the end would be faster and would lose a learner's work the first
 * time the app is killed mid-session, which is exactly the failure this product
 * cannot afford.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KeyValueProgressStore,
  type AttemptRecord,
  type ItemProgress,
  type ProgressStore,
  type StudyDay,
} from '@nemcina/core';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';

/**
 * Until accounts exist there is one learner per device (§47 is not built yet).
 * Everything is keyed by user id already, so adding sign-in changes this
 * constant and nothing else.
 */
export const LOCAL_USER = 'local';

interface ProgressContextValue {
  readonly store: ProgressStore;
  /** Every record for the local user, kept in memory for the screens to read. */
  readonly records: ReadonlyMap<string, ItemProgress>;
  /**
   * The recent attempt log, newest first.
   *
   * Recent accuracy uses this bounded log. Daily history separately preserves
   * activity and XP after old answers leave the log.
   */
  readonly attempts: readonly AttemptRecord[];
  readonly studyDays: readonly StudyDay[];
  readonly ready: boolean;
  save(record: ItemProgress, attempt?: AttemptRecord): Promise<void>;
  reload(): Promise<void>;
  clear(): Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const store = useMemo<ProgressStore>(
    () => new KeyValueProgressStore(AsyncStorage, { prefix: 'nemcina:v1', offsetMinutes: -new Date().getTimezoneOffset() }),
    [],
  );
  const [records, setRecords] = useState<ReadonlyMap<string, ItemProgress>>(new Map());
  const [attempts, setAttempts] = useState<readonly AttemptRecord[]>([]);
  const [studyDays, setStudyDays] = useState<readonly StudyDay[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const all = await store.all(LOCAL_USER);
    setRecords(new Map(all.map((record) => [record.itemId, record])));
    setAttempts(await store.recentAttempts(LOCAL_USER, 500));
    setStudyDays(await store.studyDays(LOCAL_USER));
    setReady(true);
  }, [store]);

  useEffect(() => { void reload(); }, [reload]);

  const save = useCallback(async (record: ItemProgress, attempt?: AttemptRecord) => {
    await store.put(record);
    if (attempt) {
      await store.recordAttempt(attempt, -new Date(attempt.at).getTimezoneOffset());
      setStudyDays(await store.studyDays(LOCAL_USER));
    }
    setRecords((previous) => {
      const next = new Map(previous);
      next.set(record.itemId, record);
      return next;
    });
    if (attempt) setAttempts((previous) => [attempt, ...previous].slice(0, 500));
  }, [store]);

  const clear = useCallback(async () => {
    await store.clear(LOCAL_USER);
    setRecords(new Map());
    setAttempts([]);
    setStudyDays([]);
  }, [store]);

  const value = useMemo<ProgressContextValue>(
    () => ({ store, records, attempts, studyDays, ready, save, reload, clear }),
    [store, records, attempts, studyDays, ready, save, reload, clear],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (!value) throw new Error('useProgress must be used inside ProgressProvider');
  return value;
}
