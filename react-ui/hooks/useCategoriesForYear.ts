import { useEffect, useRef, useState } from "react";

// The categories a school year offers, cached per year.
//
// Both entry dialogs let the filing year be overridden, so the category list
// has to follow whatever year is currently selected rather than being loaded
// once for the page. Years are re-visited constantly — toggling between two
// years while entering a batch — so each one is fetched once and kept.
export function useCategoriesForYear<T>(
  fetcher: (year: number) => Promise<T[]>,
  year: number | null | undefined
): { categories: T[]; loading: boolean } {
  const cache = useRef(new Map<number, T[]>());
  const [categories, setCategories] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  // The fetcher is typically an inline import reference, stable in practice but
  // not by identity; keeping it in a ref stops it from re-triggering the fetch.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (year === null || year === undefined || !Number.isFinite(year)) {
      setCategories([]);
      return;
    }
    const cached = cache.current.get(year);
    if (cached) {
      setCategories(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetcherRef
      .current(year)
      .then((rows) => {
        cache.current.set(year, rows);
        // A year switched away from mid-flight must not overwrite the list of
        // the year now selected.
        if (!cancelled) setCategories(rows);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  return { categories, loading };
}
