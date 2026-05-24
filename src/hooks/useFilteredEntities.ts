import { useMemo } from "react";
import { useStore } from "../store";
import type { Entity } from "../types";

export function useFilteredEntities(): Entity[] {
  const entities = useStore((s) => s.entities);
  const filters = useStore((s) => s.filters);
  const threshold = useStore((s) => s.threshold);
  return useMemo(
    () => entities.filter((e) => (filters[e.type] ?? true) && e.score >= threshold),
    [entities, filters, threshold]
  );
}
