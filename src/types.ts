export type Entity = {
  text: string;
  type: string;
  start: number;
  end: number;
  score: number;
};

export type Lang = "en" | "multi";

export type ModelStatusKind = "idle" | "loading" | "ready" | "error";

export type ModelStatus = {
  kind: ModelStatusKind;
  message: string;
};

export type Progress = {
  active: boolean;
  pct: number;
  label: string;
};

export type WikidataResult = {
  id: string;
  label?: string;
  description?: string;
};

export type GraphNode = {
  id: string;
  text: string;
  type: string;
  count: number;
  radius: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};

export type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
};
