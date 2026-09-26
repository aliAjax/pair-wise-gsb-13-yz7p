// 本机保存层：localStorage 读写适配（只负责存取与版本校验，不做业务判断）

import { STORAGE_KEY } from "./constants";
import { buildSeedState } from "./seed";
import type { StationState } from "./types";

function isStateLike(value: unknown): value is StationState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<StationState>;
  return state.version === 1 && Array.isArray(state.items) && typeof state.seq === "number";
}

export function loadState(): StationState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isStateLike(parsed)) return parsed;
    } catch {
      // 数据损坏时回落到种子数据
    }
  }
  return buildSeedState();
}

export function saveState(state: StationState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): StationState {
  const seed = buildSeedState();
  saveState(seed);
  return seed;
}
