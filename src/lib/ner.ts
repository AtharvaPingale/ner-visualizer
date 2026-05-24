import type { Entity, Lang } from "../types";

const TRANSFORMERS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

type RawToken = {
  word: string;
  entity_group?: string;
  entity?: string;
  index?: number;
  start: number | null;
  end: number | null;
  score: number;
};

type Pipe = (
  text: string,
  opts: { aggregation_strategy: string }
) => Promise<RawToken[]>;

type TransformersModule = {
  pipeline: (
    task: string,
    model: string,
    opts: { quantized?: boolean; progress_callback?: ProgressCallback }
  ) => Promise<Pipe>;
  env: { allowLocalModels: boolean; useBrowserCache: boolean };
};

const MODEL_IDS: Record<Lang, string> = {
  en: "Xenova/bert-base-NER",
  multi: "Xenova/xlm-roberta-base-ner-hrl",
};

export type ProgressEvent = {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
  progress?: number;
};

export type ProgressCallback = (p: ProgressEvent) => void;

let modulePromise: Promise<TransformersModule> | null = null;
const pipelineCache = new Map<Lang, Promise<Pipe>>();

async function loadTransformers(): Promise<TransformersModule> {
  if (!modulePromise) {
    modulePromise = (
      import(/* @vite-ignore */ TRANSFORMERS_CDN_URL) as Promise<TransformersModule>
    ).then((mod) => {
      mod.env.allowLocalModels = false;
      mod.env.useBrowserCache = true;
      return mod;
    });
  }
  return modulePromise;
}

function normalizeType(raw: string): string {
  return (raw || "").toUpperCase().replace(/^[BI]-/, "");
}

/**
 * Reconstructs character offsets from token words when the model doesn't provide them.
 * Tokens are processed in index order; each non-## word is located via indexOf from
 * the current cursor; ## subwords are appended directly after the previous token's end.
 */
function reconstructOffsets(tokens: RawToken[], text: string): RawToken[] {
  const sorted = [...tokens].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  let cursor = 0;
  const result: RawToken[] = [];

  for (const t of sorted) {
    const word = t.word ?? "";

    // Special tokens like [CLS], [SEP] — mark invalid so aggregateTokens skips them
    if (word.startsWith("[") && word.endsWith("]")) {
      result.push({ ...t, start: -1, end: -1 });
      continue;
    }

    if (word.startsWith("##")) {
      const sub = word.slice(2);
      const prev = result[result.length - 1];
      const prevEnd = typeof prev?.end === "number" && prev.end >= 0 ? prev.end : cursor;
      result.push({ ...t, start: prevEnd, end: prevEnd + sub.length });
      cursor = prevEnd + sub.length;
      continue;
    }

    // Scan forward to find this word in the text (skips gaps from O-tagged tokens)
    const idx = text.indexOf(word, cursor);
    if (idx === -1) {
      result.push({ ...t, start: null, end: null });
      continue;
    }
    result.push({ ...t, start: idx, end: idx + word.length });
    cursor = idx + word.length;
  }

  return result;
}

/**
 * Aggregates raw per-token pipeline output into Entity[].
 *
 * We use aggregation_strategy:"none" to get reliable per-token char offsets,
 * then merge tokens ourselves with a single rule: extend the current entity
 * group whenever the next same-type token is separated only by whitespace
 * (or no gap at all for WordPiece ## subwords).  This handles:
 *   - "B" + "##iden"  → "Biden"  (zero-gap between char offsets)
 *   - "Joe" + "Biden" → "Joe Biden"  (single-space gap)
 *   - "Olaf" + "Scholz" → "Olaf Scholz"  (same)
 * while correctly leaving "Biden ... Olaf" as separate entities because
 * "met with German Chancellor" between them is non-whitespace.
 *
 * entity text is always derived from text.slice(group.start, group.end) so
 * spaces are preserved naturally.
 */
function aggregateTokens(tokens: RawToken[], text: string): Entity[] {
  if (!tokens.length) return [];

  type Group = { type: string; scores: number[]; start: number; end: number };
  const results: Entity[] = [];
  let cur: Group | null = null;

  const flush = () => {
    if (!cur) return;
    results.push({
      text: text.slice(cur.start, cur.end),
      type: cur.type,
      start: cur.start,
      end: cur.end,
      score: Math.min(...cur.scores),
    });
    cur = null;
  };

  for (const t of tokens) {
    // Skip special/padding tokens that have missing or out-of-range offsets.
    // [CLS]/[SEP] often have start=0,end=0; these can corrupt group boundaries
    // because text.slice(X, 0) returns "" and passes the whitespace-gap check.
    if (t.start === null || t.end === null || t.start < 0) continue;

    const rawLabel = (t.entity_group || t.entity || "").toUpperCase();
    const isO = !rawLabel || rawLabel === "O";
    const word = t.word ?? "";
    const isSub = word.startsWith("##");
    const isI = rawLabel.startsWith("I-");
    const type = normalizeType(rawLabel);

    // ## subword tokens belong to the current word regardless of their own label.
    // Check isSub BEFORE isO so that O-labeled continuation subwords still extend
    // the group (some models emit O for non-first subwords of an entity word).
    if (isSub && cur && t.start >= cur.end) {
      cur.end = t.end;
      if (!isO) cur.scores.push(t.score);
      continue;
    }

    if (isO) {
      flush();
      continue;
    }

    // Skip zero-length entity tokens (artifacts of some tokenizers)
    if (t.end <= t.start) continue;

    const tokenStart = t.start;
    const tokenEnd = t.end;

    // Extend current group when:
    //   • I-tag explicitly marks this token as a continuation, OR
    //   • same entity type and only whitespace separates current end from this start
    //     (handles models that emit B- for every word in a multi-word entity)
    // Guard: tokenStart >= cur.end prevents backwards merges caused by special
    // tokens with low offsets that sneak through the null check above.
    if (cur && cur.type === type && tokenStart >= cur.end) {
      if (isI || text.slice(cur.end, tokenStart).trim() === "") {
        cur.end = tokenEnd;
        cur.scores.push(t.score);
        continue;
      }
    }

    flush();
    cur = { type, scores: [t.score], start: tokenStart, end: tokenEnd };
  }

  flush();
  return results;
}

export async function loadPipeline(
  lang: Lang,
  onProgress: ProgressCallback
): Promise<Pipe> {
  let cached = pipelineCache.get(lang);
  if (!cached) {
    cached = loadTransformers().then((mod) =>
      mod.pipeline("token-classification", MODEL_IDS[lang], {
        quantized: true,
        progress_callback: onProgress,
      })
    );
    pipelineCache.set(lang, cached);
  }
  return cached;
}

export function isPipelineCached(lang: Lang): boolean {
  return pipelineCache.has(lang);
}

export async function runNER(
  lang: Lang,
  text: string,
  onProgress: ProgressCallback
): Promise<Entity[]> {
  const pipe = await loadPipeline(lang, onProgress);
  // "none" gives reliable per-token char offsets; we aggregate ourselves.
  const raw = await pipe(text, { aggregation_strategy: "none" });
  const tokens = raw.length > 0 && raw[0].start === null ? reconstructOffsets(raw, text) : raw;
  const result = aggregateTokens(tokens, text);
  console.log("[NER] aggregated entities:", JSON.stringify(result, null, 2));
  return result;
}
