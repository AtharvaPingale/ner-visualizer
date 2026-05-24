import { create } from "zustand";
import type {
  Entity,
  Lang,
  ModelStatus,
  ModelStatusKind,
  Progress,
  WikidataResult,
} from "./types";

type State = {
  rawText: string;
  entities: Entity[];
  filters: Record<string, boolean>;
  threshold: number;
  activeLang: Lang;
  modelStatus: ModelStatus;
  progress: Progress;
  wikidataCache: Map<string, WikidataResult | null | "pending">;
  hoveredNodeId: string | null;
  focusedNodeId: string | null;
  cacheVersion: number;

  setRawText: (t: string) => void;
  setEntities: (entities: Entity[]) => void;
  setThreshold: (t: number) => void;
  toggleFilter: (type: string) => void;
  setLang: (l: Lang) => void;
  setStatus: (kind: ModelStatusKind, message: string) => void;
  setProgress: (p: Partial<Progress>) => void;
  setWikidataEntry: (key: string, result: WikidataResult | null | "pending") => void;
  setHoveredNode: (id: string | null) => void;
  setFocusedNode: (id: string | null) => void;
};

export const useStore = create<State>((set) => ({
  rawText: "",
  entities: [],
  filters: {},
  threshold: 0.5,
  activeLang: "en",
  modelStatus: { kind: "idle", message: "idle (model loads on first Run)" },
  progress: { active: false, pct: 0, label: "" },
  wikidataCache: new Map(),
  hoveredNodeId: null,
  focusedNodeId: null,
  cacheVersion: 0,

  setRawText: (rawText) => set({ rawText }),
  setEntities: (entities) => set({ entities, focusedNodeId: null }),
  setThreshold: (threshold) => set({ threshold }),
  toggleFilter: (type) =>
    set((s) => ({ filters: { ...s.filters, [type]: !(s.filters[type] ?? true) } })),
  setLang: (activeLang) => set({ activeLang }),
  setStatus: (kind, message) => set({ modelStatus: { kind, message } }),
  setProgress: (p) =>
    set((s) => ({ progress: { ...s.progress, ...p } })),
  setWikidataEntry: (key, result) =>
    set((s) => {
      const next = new Map(s.wikidataCache);
      next.set(key, result);
      return { wikidataCache: next, cacheVersion: s.cacheVersion + 1 };
    }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setFocusedNode: (id) => set({ focusedNodeId: id }),
}));

export function selectFilteredEntities(state: State): Entity[] {
  return state.entities.filter(
    (e) => (state.filters[e.type] ?? true) && e.score >= state.threshold
  );
}
