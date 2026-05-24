# NER Visualizer

A React + TypeScript browser app for Named Entity Recognition. Paste any text, click **Run NER**, and see every entity highlighted inline with color-coded type labels, plotted as a force-directed co-occurrence graph, and cross-referenced against Wikidata. Runs entirely in the browser - no backend, no API keys, no data leaves your machine.

## Quick start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

For a production build:

```bash
npm run build
npm run preview   # serves dist/ locally
```

The first **Run NER** click downloads the model (~45 MB quantized for the English model). On subsequent visits it loads from IndexedDB and works offline.


## Features

- **Inline entity highlighting** — color-coded pills rendered directly inside the text, one per detected entity. Each pill shows the entity type label; hover to see the confidence score.
- **Type filter pills** — toggle entity types on/off in real time without re-running the model. The pill count updates live to show how many entities of each type are currently visible.
- **Confidence threshold slider** — drag to set a minimum score (0.50–1.00); entities below the threshold are removed from every view simultaneously.
- **JSON export** — downloads the raw `Entity[]` array as `entities.json`.
- **Force-directed co-occurrence graph** — entities become nodes (sized by mention count), edges connect entities that appear within 80 characters of each other in the text. Built with d3-force, rendered to SVG.
- **Graph interactions** — hover to highlight a node and dim everything else, click to pin-focus a node, drag any node to reposition it, scroll to zoom, drag the background to pan, Reset button to return to identity transform.
- **Multilingual model** — switch to XLM-RoBERTa for Arabic, German, English, Spanish, French, Italian, Portuguese, Swahili, Chinese, and Yoruba. The second model is lazy-loaded and cached independently.
- **Wikidata entity linking** — after each NER run, every unique entity text is looked up against Wikidata's `wbsearchentities` API. Results (QID, label, description) appear in a table below the graph. Lookups are concurrency-limited to 5 parallel requests and cached for the session so the same string is never fetched twice.

---

## Models

| Model | Quantized size | Languages | Entity types |
|---|---|---|---|
| [`Xenova/bert-base-NER`](https://huggingface.co/Xenova/bert-base-NER) | ~45 MB | English | CoNLL-2003: `PER`, `ORG`, `LOC`, `MISC` |
| [`Xenova/xlm-roberta-base-ner-hrl`](https://huggingface.co/Xenova/xlm-roberta-base-ner-hrl) | ~280 MB | 10 languages | `PER`, `ORG`, `LOC`, `DATE` |

Both models run via [Transformers.js](https://huggingface.co/docs/transformers.js) on ONNX Runtime WASM, loaded from the jsDelivr CDN and cached in the browser's IndexedDB.

---

## NER pipeline in detail

### Why `aggregation_strategy: "none"` + manual aggregation

The pipeline is called with `aggregation_strategy: "none"`, which returns one prediction per WordPiece token. The higher-level strategies (`"simple"`, `"first"`) let the library merge tokens, but they can produce incorrect character offsets for multi-word spans and concatenate words without spaces (e.g. `"JoeBiden"` instead of `"Joe Biden"`).

With `"none"`, every token gets its own BIO label (`B-PER`, `I-PER`, `O`, …) and `start`/`end` character offsets into the original string. The `aggregateTokens` function in `src/lib/ner.ts` then merges them by hand.

### Offset reconstruction

Some quantized Xenova models return `start: null, end: null` on every token even with `aggregation_strategy: "none"`. When that happens, `reconstructOffsets` scans the original text to assign positions:

- Tokens are sorted by `index` (their position in the token sequence).
- Special tokens like `[CLS]` and `[SEP]` are assigned `start: -1, end: -1` so they are skipped downstream.
- WordPiece subword tokens (prefixed `##`) are appended directly after the previous token's end — no space inserted.
- All other tokens are located with `text.indexOf(word, cursor)`, advancing `cursor` forward after each match. This naturally skips gaps covered by O-tagged tokens that are absent from the entity-only output.

### Token merging rules in `aggregateTokens`

After offsets are resolved, tokens are merged into `Entity` spans:

1. **Skip** any token where `start` is null, negative, or `end ≤ start` (special/padding tokens).
2. **Subword extension** (`##` prefix): if a subword token immediately follows the current group (`t.start >= cur.end`), extend the group's end. O-labeled subwords still extend the group because some models emit `O` for non-first subwords of an entity word — this check runs before the O check.
3. **O token**: flush the current group and start nothing.
4. **Continuation** (`I-` prefix or same type with only whitespace between `cur.end` and `t.start`): extend the current group. The whitespace-only rule handles models that emit `B-` on every word of a multi-word entity (e.g. `B-PER "Joe"` + `B-PER "Biden"` → `"Joe Biden"`). The `tokenStart >= cur.end` guard prevents backwards merges from any rogue low-offset tokens.
5. **New entity** (`B-` prefix, different type, or non-whitespace gap): flush the current group, start a new one.

Entity `text` is always `rawText.slice(group.start, group.end)`, so spaces inside multi-word names are preserved naturally.

---

### State (Zustand store)

Everything flows through a single Zustand store in `src/store.ts`:

| Field | Type | Purpose |
|---|---|---|
| `rawText` | `string` | Original input text; set after a successful NER run |
| `entities` | `Entity[]` | Full unfiltered entity list from the last run |
| `filters` | `Record<string, boolean>` | Per-type visibility toggle; defaults to `true` for any unseen type |
| `threshold` | `number` | Minimum confidence score (0.50–1.00) |
| `activeLang` | `"en" \| "multi"` | Which model to use on next Run |
| `modelStatus` | `ModelStatus` | `idle \| loading \| ready \| error` + message string |
| `progress` | `Progress` | Download progress (`active`, `pct`, `label`) |
| `wikidataCache` | `Map<string, WikidataResult \| null \| "pending">` | Lookup cache, keyed by lowercased entity text |
| `cacheVersion` | `number` | Increments on every cache write; used as a re-render trigger |
| `hoveredNodeId` | `string \| null` | Shared hover state between `EntitySpan` and `GraphView` |
| `focusedNodeId` | `string \| null` | Pinned node in the graph; also highlights the matching `EntitySpan` |

Node IDs are `"text::type"` (e.g. `"Joe Biden::PER"`), used as the join key between the text view and the graph.

### Data flow

```
User types text
       │
       ▼
InputSection → useNER.run(text)
                     │
                     ▼
              loadPipeline(lang)   ← lazy, cached per language
                     │
                     ▼
         Transformers.js / ONNX WASM
                     │  (raw BIO tokens, possibly null offsets)
                     ▼
          reconstructOffsets()     ← assigns char positions from text
                     │
                     ▼
           aggregateTokens()       ← merges into Entity[]
                     │
                     ▼
         store.setEntities(entities)
         store.setRawText(text)
                     │
          ┌──────────┼────────────────┐
          ▼          ▼                ▼
    NerSection   GraphView      WikidataTable
  (text + pills)  (d3 graph)   (API lookups)
          │
     useFilteredEntities()  ← applies filters + threshold reactively
```

Filter/threshold changes update `useFilteredEntities` and propagate to all three views without re-running the model.

### Graph rendering

React owns the SVG structure — which `<circle>` / `<path>` elements exist. d3-force owns the physics simulation. On each simulation tick, the `paint()` function writes `transform` and `d` attributes directly onto the DOM elements via refs, **bypassing React's reconciler in the hot path**. This keeps animation smooth even with 100+ nodes.

When entity data changes, the simulation is updated in-place (`sim.nodes(…)` + `sim.alpha(0.6).restart()`) preserving momentum and pinned positions rather than rebuilding from scratch.

Co-occurrence edges are built in `src/lib/graph.ts`: entity pairs where the gap between `entityA.end` and `entityB.start` is ≤ 80 characters are connected. Edge weight equals the number of times that pair co-occurs; edge thickness in the SVG scales as `1 + log(weight + 1)`. Node radius scales as `8 + 3 * sqrt(count)`.

### Wikidata linking

`useWikidata.ts` runs as a side-effect on `useFilteredEntities`. For each unique entity text (case-insensitive dedup) not already in the cache, it marks the entry as `"pending"`, then calls `fetchWikidata` which hits `wbsearchentities` on `wikidata.org`. A module-level semaphore in `src/lib/wikidata.ts` caps concurrency at 5. The store's `cacheVersion` counter ensures `WikidataTable` re-renders when new results arrive, since `Map` mutations don't trigger React otherwise.

---

## Colors

`src/lib/colors.ts` exports three values per entity type:

| Export | Usage |
|---|---|
| `entityColor(type)` | Pill / node fill (light pastel) |
| `entityColorDark(type)` | Pill type label background, node stroke on hover |
| `entityColorDim(type)` | Node fill color when dimmed by hover/focus |

Colors are passed to components via CSS custom properties (`--bg`, `--bg-dark`, `--bg-dim`) so the CSS can reference them without prop drilling.

---

## Examples

Four built-in sample texts are available from the **Load example…** dropdown:

| Key | Content |
|---|---|
| `news` | Political news with dense `PER`, `ORG`, `LOC` mix |
| `biography` | Marie Curie biography — many `PER`, geographic chain |
| `tech` | Tech industry article — heavy `ORG` (good for graph density) |
| `multilingual` | Five languages in one paragraph, for the multilingual model |

---

## Deployment

```bash
npm run build
# upload dist/ to any static host
```

jsDelivr (model CDN) and `wikidata.org` both serve CORS headers, so no proxy is needed. GitHub Pages, Netlify, Vercel, and Cloudflare Pages all work with `dist/` as the publish directory and no extra configuration.

---

## Browser support

Requires a modern browser with:

- ES2020+ (native `import()`, optional chaining, nullish coalescing)
- WebAssembly (ONNX Runtime WASM)
- IndexedDB (model caching — falls back to network on each load if unavailable)
- Pointer Events (graph drag/touch)
- ResizeObserver (graph canvas sizing)

Tested in recent Chrome, Firefox, Safari, and Edge. Mobile layout collapses to a single column below 768 px; graph drag and zoom work via touch through Pointer Events.
