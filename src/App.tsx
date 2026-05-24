import { useState, useEffect } from "react";
import { InputSection } from "./components/InputSection";
import { NerSection } from "./components/NerSection";
import { GraphView } from "./components/GraphView";
import { WikidataTable } from "./components/WikidataTable";
import styles from "./App.module.css";

export default function App() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
  }, [light]);

  return (
    <div className={styles.app}>
      <div className={styles.themeToggle}>
        <button
          className={styles.toggleBtn}
          onClick={() => setLight((v) => !v)}
          aria-label="Toggle light mode"
        >
          {light ? "🌙 Dark mode" : "☀️ Light mode"}
        </button>
      </div>
      <InputSection />
      <NerSection />
      <section className={styles.section}>
        <h2 className={styles.heading}>Co-occurrence Graph</h2>
        <GraphView />
      </section>
      <section className={styles.section}>
        <h2 className={styles.heading}>Wikidata Entity Linking</h2>
        <WikidataTable />
      </section>
    </div>
  );
}
