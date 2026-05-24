import type { CSSProperties } from "react";
import { useStore } from "../store";
import { entityColor, entityColorDark, entityColorDim } from "../lib/colors";
import type { Entity } from "../types";
import styles from "./EntitySpan.module.css";

type Props = {
  entity: Entity;
  segment: string;
};

export function EntitySpan({ entity, segment }: Props) {
  const setHovered = useStore((s) => s.setHoveredNode);
  const hoveredId = useStore((s) => s.hoveredNodeId);
  const focusedId = useStore((s) => s.focusedNodeId);
  const id = `${entity.text}::${entity.type}`;
  const active = hoveredId === id || focusedId === id;

  const style = {
    "--bg": entityColor(entity.type),
    "--bg-dark": entityColorDark(entity.type),
    "--bg-dim": entityColorDim(entity.type),
  } as CSSProperties;

  return (
    <span
      className={`${styles.entity} ${active ? styles.active : ""}`}
      style={style}
      title={`${entity.type} — score ${entity.score.toFixed(3)}`}
      onMouseEnter={() => setHovered(id)}
      onMouseLeave={() => setHovered(null)}
    >
      <span className={styles.text}>{segment}</span>
      <span className={styles.type}>{entity.type}</span>
    </span>
  );
}
