import { useCallback, useRef } from "react";
import { useStore } from "../store";
import { runNER, type ProgressEvent } from "../lib/ner";

export function useNER() {
  const setStatus = useStore((s) => s.setStatus);
  const setProgress = useStore((s) => s.setProgress);
  const setRawText = useStore((s) => s.setRawText);
  const setEntities = useStore((s) => s.setEntities);
  const inFlight = useRef(false);

  const run = useCallback(
    async (text: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const lang = useStore.getState().activeLang;
      const langLabel = lang === "multi" ? "multilingual" : "English";
      setStatus("loading", `loading ${langLabel} model…`);

      const onProgress = (p: ProgressEvent) => {
        if (p.status === "progress" && p.total) {
          const pct = ((p.loaded ?? 0) / p.total) * 100;
          const mb = ((p.loaded ?? 0) / 1024 / 1024).toFixed(1);
          const totalMb = (p.total / 1024 / 1024).toFixed(1);
          setProgress({ active: true, pct, label: `Downloading ${p.file}: ${mb} / ${totalMb} MB` });
        } else if (p.status === "initiate") {
          setProgress({ active: true, pct: 0, label: `Starting download: ${p.file}` });
        } else if (p.status === "done") {
          setProgress({ active: true, pct: 100, label: `Loaded ${p.file}` });
        } else if (p.status === "ready") {
          setProgress({ active: false, pct: 0, label: "" });
        }
      };

      try {
        const entities = await runNER(lang, text, onProgress);
        setRawText(text);
        setEntities(entities);
        setStatus("ready", `${langLabel} model ready`);
        setProgress({ active: false, pct: 0, label: "" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus("error", `error: ${msg}`);
        setProgress({ active: false, pct: 0, label: "" });
        throw err;
      } finally {
        inFlight.current = false;
      }
    },
    [setStatus, setProgress, setRawText, setEntities]
  );

  return { run };
}
