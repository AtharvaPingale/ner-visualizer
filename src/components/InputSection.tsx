import { useState } from "react";
import { useStore } from "../store";
import { useNER } from "../hooks/useNER";
import { ProgressBar } from "./ProgressBar";
import { EXAMPLES, type ExampleKey } from "../lib/examples";
import type { Lang } from "../types";
import styles from "./InputSection.module.css";
import appStyles from "../App.module.css";

export function InputSection() {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const { run } = useNER();
  const activeLang = useStore((s) => s.activeLang);
  const setLang = useStore((s) => s.setLang);
  const status = useStore((s) => s.modelStatus);

  const handleRun = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setRunning(true);
    try {
      await run(trimmed);
    } catch {
      /* status already updated */
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className={appStyles.section}>
      <h2 className={appStyles.heading}>Input text</h2>

      <div className={styles.field}>
        <label htmlFor="input-text" className={styles.fieldLabel}>
          Text to analyze
        </label>
        <textarea
          id="input-text"
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste any text and click Run NER. Example: When Sebastian Thrun started working on self-driving cars at Google in 2007…"
        />
      </div>

      <div className={styles.actions}>
        <button className={styles.primary} onClick={handleRun} disabled={running || !text.trim()}>
          {running ? "Running…" : "Run NER"}
        </button>
        <select
          className={styles.select}
          value={activeLang}
          onChange={(e) => setLang(e.target.value as Lang)}
          aria-label="Language model"
        >
          <option value="en">English (OntoNotes)</option>
          <option value="multi">Multilingual (XLM-RoBERTa)</option>
        </select>
        <select
          className={styles.select}
          value=""
          onChange={(e) => {
            const k = e.target.value as ExampleKey;
            if (k && EXAMPLES[k]) setText(EXAMPLES[k].text);
          }}
          aria-label="Load example"
        >
          <option value="">Load example…</option>
          {(Object.keys(EXAMPLES) as ExampleKey[]).map((k) => (
            <option key={k} value={k}>
              {EXAMPLES[k].label}
            </option>
          ))}
        </select>
        {status.kind !== "idle" && (
          <span className={`${styles.status} ${styles[status.kind]}`}>{status.message}</span>
        )}
      </div>

      <ProgressBar />
    </section>
  );
}
