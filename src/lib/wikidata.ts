import type { WikidataResult } from "../types";

const CONCURRENCY = 5;
let active = 0;
const queue: Array<() => void> = [];

function acquire(): Promise<void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (active < CONCURRENCY) {
        active++;
        resolve();
      } else {
        queue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

function release() {
  active--;
  const next = queue.shift();
  if (next) next();
}

export async function fetchWikidata(text: string): Promise<WikidataResult | null> {
  await acquire();
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      text
    )}&language=en&format=json&origin=*&limit=1`;
    const r = await fetch(url);
    const data = (await r.json()) as { search?: WikidataResult[] };
    return data.search?.[0] ?? null;
  } catch {
    return null;
  } finally {
    release();
  }
}
