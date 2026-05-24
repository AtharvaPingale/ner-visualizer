import { Fragment, useMemo } from "react";
import type { CSSProperties } from "react";
import { useStore } from "../store";
import { useFilteredEntities } from "../hooks/useFilteredEntities";
import { entityColor, entityColorDark, entityColorDim } from "../lib/colors";
import { EntitySpan } from "./EntitySpan";
import styles from "./NerSection.module.css";
import appStyles from "../App.module.css";

export function NerSection() {
  const rawText = useStore((s) => s.rawText);
  const entities = useStore((s) => s.entities);
  const filters = useStore((s) => s.filters);
  const toggleFilter = useStore((s) => s.toggleFilter);
  const threshold = useStore((s) => s.threshold);
  const setThreshold = useStore((s) => s.setThreshold);
  const filtered = useFilteredEntities();

  // Dynamic type list: only types that actually appeared in the latest NER result.
  const presentTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of entities) set.add(e.type);
    return [...set].sort();
  }, [entities]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of filtered) c[e.type] = (c[e.type] || 0) + 1;
    return c;
  }, [filtered]);

  const segments = useMemo(() => {
    if (!rawText) return null;
    const sorted = [...filtered].sort((a, b) => a.start - b.start);
    type Part =
      | { kind: "text"; value: string }
      | { kind: "entity"; entity: typeof sorted[number]; segment: string };
    const parts: Part[] = [];
    let cursor = 0;
    for (const e of sorted) {
      if (e.start < cursor) continue;
      if (e.start > cursor) parts.push({ kind: "text", value: rawText.slice(cursor, e.start) });
      parts.push({ kind: "entity", entity: e, segment: rawText.slice(e.start, e.end) });
      cursor = e.end;
    }
    if (cursor < rawText.length) parts.push({ kind: "text", value: rawText.slice(cursor) });
    return parts;
  }, [rawText, filtered]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(entities, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "entities.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className={appStyles.section}>
      <h2 className={appStyles.heading}>Named Entity Recognition</h2>

      {entities.length > 0 && (
        <div className={styles.controls}>
          <div className={styles.filterRow}>
            {presentTypes.map((t) => {
              const active = filters[t] ?? true;
              const style = {
                "--bg": entityColor(t),
                "--bg-dark": entityColorDark(t),
                "--bg-dim": entityColorDim(t),
              } as CSSProperties;
              return (
                <button
                  key={t}
                  type="button"
                  className={`${styles.typePill} ${active ? "" : styles.inactive}`}
                  style={style}
                  onClick={() => toggleFilter(t)}
                  title={`Toggle ${t}`}
                >
                  <span className={styles.pillText}>{t}</span>
                  <span className={styles.pillCount}>{counts[t] ?? 0}</span>
                </button>
              );
            })}
          </div>
          <div className={styles.metaRow}>
            <div className={styles.thresholdRow}>
              <label htmlFor="threshold">Confidence ≥</label>
              <input
                id="threshold"
                type="range"
                min={0.5}
                max={1}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
              />
              <span className={styles.thresholdValue}>{threshold.toFixed(2)}</span>
            </div>
            <span className={styles.totalCount}>
              <strong>{filtered.length}</strong> entities shown
            </span>
            <button className={styles.exportBtn} onClick={handleExport}>
              Export JSON
            </button>
          </div>
        </div>
      )}

      <div className={styles.output}>
        {!rawText ? (
          <span className={styles.empty}>Run NER on some text to see highlighted entities.</span>
        ) : segments && segments.length === 0 ? (
          <>
            {rawText}
            <div className={styles.empty} style={{ marginTop: 12 }}>
              No entities match the current filters.
            </div>
          </>
        ) : (
          segments?.map((p, i) =>
            p.kind === "text" ? (
              <Fragment key={i}>{p.value}</Fragment>
            ) : (
              <EntitySpan key={i} entity={p.entity} segment={p.segment} />
            )
          )
        )}
      </div>
    </section>
  );
}
