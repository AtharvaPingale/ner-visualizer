import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useStore } from "../store";
import { useFilteredEntities } from "../hooks/useFilteredEntities";
import { useWikidataLookups } from "../hooks/useWikidata";
import { entityColor, entityColorDark } from "../lib/colors";
import styles from "./WikidataTable.module.css";

export function WikidataTable() {
  useWikidataLookups();
  const filtered = useFilteredEntities();
  const cache = useStore((s) => s.wikidataCache);
  // re-render trigger when cache mutates
  useStore((s) => s.cacheVersion);

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const unique: { text: string; type: string; key: string }[] = [];
    for (const e of filtered) {
      const key = e.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ text: e.text, type: e.type, key });
    }
    return unique;
  }, [filtered]);

  return (
    <div className={styles.panel}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Entity</th>
            <th>Type</th>
            <th>QID</th>
            <th>Label</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.empty}>
                Wikidata matches appear after NER runs.
              </td>
            </tr>
          ) : (
            rows.map(({ text, type, key }) => {
              const entry = cache.get(key);
              const badgeStyle = {
                "--bg": entityColor(type),
                "--bg-dark": entityColorDark(type),
              } as CSSProperties;
              return (
                <tr key={key}>
                  <td>{text}</td>
                  <td>
                    <span className={styles.typeBadge} style={badgeStyle}>
                      {type}
                    </span>
                  </td>
                  <td>
                    {entry === undefined || entry === "pending" ? (
                      <span className={styles.pending}>looking up…</span>
                    ) : entry ? (
                      <a
                        href={`https://www.wikidata.org/wiki/${entry.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {entry.id}
                      </a>
                    ) : (
                      <span className={styles.nomatch}>no match</span>
                    )}
                  </td>
                  <td>{entry && entry !== "pending" ? entry.label ?? "" : ""}</td>
                  <td>{entry && entry !== "pending" ? entry.description ?? "" : ""}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
