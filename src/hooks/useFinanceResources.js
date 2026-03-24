import { useEffect, useState } from 'react';

const CACHE_KEY = 'finance_resources_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const useFinanceResources = () => {
  const [data, setData] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const cachedRaw = localStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const cachedAtMs = typeof cached?.cachedAtMs === 'number' ? cached.cachedAtMs : 0;
          const cachedFiles = Array.isArray(cached?.files) ? cached.files : null;

          if (cachedFiles && (Date.now() - cachedAtMs) < CACHE_TTL_MS) {
            if (!cancelled) {
              setData({ folderId: cached?.folderId || null, fetchedAtMs: cached?.fetchedAtMs || null, cachedAtMs });
              setFiles(cachedFiles);
              setLoading(false);
            }
            return;
          }
        }
      } catch {
        // Clear corrupted cache
        try { localStorage.removeItem(CACHE_KEY); } catch {}
      }

      try {
        const resp = await fetch('/api/insights/finance-resources');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        if (!json?.ok) throw new Error(json?.error || 'Failed to load finance resources');
        const nextFiles = Array.isArray(json?.files) ? json.files : [];

        const cachePayload = {
          folderId: json?.folderId || null,
          fetchedAtMs: json?.fetchedAtMs || null,
          cachedAtMs: Date.now(),
          files: nextFiles,
        };
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
        } catch {
        }

        if (!cancelled) {
          setData({ folderId: cachePayload.folderId, fetchedAtMs: cachePayload.fetchedAtMs, cachedAtMs: cachePayload.cachedAtMs });
          setFiles(nextFiles);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setLoading(false);
          // Don't block UI on error - show empty state with error message
          setError(e?.message || 'Failed to load finance resources');
          // Keep any stale data visible rather than clearing entirely
          if (!data) {
            setData(null);
            setFiles([]);
          }
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { doc: data, files, loading, error };
};
