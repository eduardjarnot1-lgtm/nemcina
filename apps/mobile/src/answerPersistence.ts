import { useCallback, useRef, useState } from 'react';
import type { AttemptRecord, ItemProgress } from '@nemcina/core';

export type SaveStatus = 'saved' | 'saving' | 'error';

/** Retry the same evaluated answer without grading or awarding it again. */
export function useAnswerPersistence(
  save: (record: ItemProgress, attempt?: AttemptRecord) => Promise<void>,
) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const pending = useRef<{ progress: ItemProgress; attempt: AttemptRecord } | null>(null);
  const busy = useRef(false);
  const retry = useCallback(async () => {
    if (busy.current || !pending.current) return;
    busy.current = true;
    setStatus('saving');
    try {
      await save(pending.current.progress, pending.current.attempt);
      pending.current = null;
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      busy.current = false;
    }
  }, [save]);
  const persist = useCallback(async (progress: ItemProgress, attempt: AttemptRecord) => {
    if (pending.current || busy.current) return;
    pending.current = { progress, attempt };
    await retry();
  }, [retry]);
  return { status, persist, retry };
}
