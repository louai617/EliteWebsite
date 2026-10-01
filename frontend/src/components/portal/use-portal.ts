'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, errorMessage } from '@/lib/api';

interface Result<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/** Loads a portal endpoint with loading / error / data states and a reload function. */
export function usePortal<T>(path: string) {
  const [version, setVersion] = useState(0);
  const key = `${path}#${version}`;
  const [result, setResult] = useState<Result<T>>({ key: '', data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<T>(path, controller.signal)
      .then((data) => setResult({ key, data, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof ApiError && err.status === 401 ? 'Your session has expired. Please sign in again.' : errorMessage(err, "We couldn't load this section.");
        setResult((prev) => ({ key, data: prev.data, error: message }));
      });
    return () => controller.abort();
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // Still loading while the latest result belongs to an older request; previous data stays visible.
  return { data: result.data, error: result.key === key ? result.error : null, loading: result.key !== key, reload };
}
