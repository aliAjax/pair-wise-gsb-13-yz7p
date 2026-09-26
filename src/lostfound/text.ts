// 判断层：文本规范化与特征比对（纯函数，不依赖界面与存储）

import { TOKEN_SPLIT_PATTERN } from "./constants";

export function normalizeText(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

/** 把“黑色 皮质 钱包”这类描述切成特征词集合 */
export function featureTokens(raw: string): string[] {
  const tokens = raw
    .split(TOKEN_SPLIT_PATTERN)
    .map((token) => normalizeText(token))
    .filter((token) => token.length >= 2);
  return [...new Set(tokens)];
}

export function intersect<T>(a: readonly T[], b: readonly T[]): T[] {
  const set = new Set(b);
  return a.filter((item) => set.has(item));
}

/** Jaccard 相似度，用于给“疑似重复”候选排序 */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const hit = intersect(a, b).length;
  return hit / (a.length + b.length - hit);
}

/** 同一特征：类别一致且特征词集合完全一致 */
export function sameFeature(a: readonly string[], b: readonly string[]): boolean {
  return a.length > 0 && a.length === b.length && intersect(a, b).length === a.length;
}

export function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : "****";
}
