import { useStore } from "../store";
import styles from "./ProgressBar.module.css";

export function ProgressBar() {
  const { active, pct, label } = useStore((s) => s.progress);
  if (!active) return null;
  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
