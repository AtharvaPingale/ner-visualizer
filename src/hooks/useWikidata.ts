import { useEffect } from "react";
import { useStore } from "../store";
import { fetchWikidata } from "../lib/wikidata";
import { useFilteredEntities } from "./useFilteredEntities";

export function useWikidataLookups() {
  const filtered = useFilteredEntities();
  const setEntry = useStore((s) => s.setWikidataEntry);

  useEffect(() => {
    const seen = new Set<string>();
    for (const e of filtered) {
      const key = e.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const cache = useStore.getState().wikidataCache;
      if (cache.has(key)) continue;
      setEntry(key, "pending");
      fetchWikidata(e.text).then((result) => setEntry(key, result));
    }
  }, [filtered, setEntry]);
}
