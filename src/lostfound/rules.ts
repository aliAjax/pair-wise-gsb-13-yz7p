// 判断层：登记、认领、争议、移交、归档、更正的全部业务规则（纯函数）

import { DEFAULT_RETENTION_DAYS, PHONE_PATTERN } from "./constants";
import { featureTokens, intersect, jaccard, sameFeature } from "./text";
import type {
  ArchiveInput,
  Claim,
  ClaimInput,
  CorrectionInput,
  HandoverInput,
  LostItem,
  RegisterInput
} from "./types";

// ---------- 通用小工具 ----------

export function isExpired(item: LostItem, now: Date): boolean {
  return now.getTime() > Date.parse(item.expiresAt);
}

export function isHeld(item: LostItem): boolean {
  return item.status === "在管" || item.status === "争议挂起";
}

export function currentLocation(item: LostItem): string {
  const last = item.locations[item.locations.length - 1];
  return last ? last.location : "未登记";
}

export function openDispute(item: LostItem) {
  return item.disputes.find((dispute) => dispute.status === "挂起");
}

export function fmtDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ---------- 登记与重复发现 ----------

export function validateRegister(input: RegisterInput): string[] {
  const errors: string[] = [];
  if (!input.station.trim()) errors.push("请填写发现站点");
  if (!input.foundAt || Number.isNaN(Date.parse(input.foundAt))) errors.push("请选择有效的发现时间");
  if (!input.category) errors.push("请选择物品类别");
  if (featureTokens(input.description).length === 0) errors.push("请填写物品特征（至少一个两字符以上的特征词）");
  if (!input.location.trim()) errors.push("请填写暂存位置");
  if (!Number.isFinite(input.retentionDays) || input.retentionDays < 1) errors.push("保管期至少 1 天");
  if (!input.reporter.trim()) errors.push("请填写登记人");
  return errors;
}

export interface DuplicateMatch {
  exact: LostItem | null; // 同一特征且在时效内：只补发现记录
  possible: LostItem[]; // 疑似重复，交给值班人确认
}

/** 只在“仍在保管时效内”的在管/争议物品里查重 */
export function findDuplicate(items: LostItem[], input: RegisterInput, now: Date): DuplicateMatch {
  const tokens = featureTokens(input.description);
  const candidates = items.filter(
    (item) => isHeld(item) && item.category === input.category && !isExpired(item, now)
  );
  const exactList = candidates.filter((item) => sameFeature(featureTokens(item.description), tokens));
  const exact =
    exactList.sort((a, b) => Date.parse(b.registeredAt) - Date.parse(a.registeredAt))[0] ?? null;
  const possible = candidates
    .filter((item) => item.id !== exact?.id)
    .map((item) => ({ item, score: jaccard(featureTokens(item.description), tokens) }))
    .filter((entry) => entry.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
  return { exact, possible };
}

// ---------- 认领核对 ----------

export interface DetailCheck {
  matched: string[];
  ratio: number;
  passed: boolean;
}

/** 顾客自述细节 vs 登记特征：至少说中一个特征词才算“说得上” */
export function checkDetail(item: LostItem, detail: string): DetailCheck {
  const itemTokens = featureTokens(item.description);
  const claimTokens = featureTokens(detail);
  const matched = intersect(itemTokens, claimTokens);
  return {
    matched,
    ratio: itemTokens.length === 0 ? 0 : matched.length / itemTokens.length,
    passed: matched.length >= 1
  };
}

export function validateClaim(input: ClaimInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("请填写认领人姓名");
  if (!PHONE_PATTERN.test(input.phone.trim())) errors.push("请填写 11 位联系电话");
  if (featureTokens(input.detail).length === 0) errors.push("请描述物品细节（至少一个特征词）");
  return errors;
}

/** 核对通过数达到 2 人即构成争议 */
export function disputeTriggered(item: LostItem): boolean {
  return item.claims.filter((claim) => claim.status === "核对通过").length >= 2;
}

/** 物品能否放行：在管、无未决争议、存在核对通过的认领 */
export function canRelease(item: LostItem): { ok: boolean; reason: string } {
  if (item.status === "争议挂起" || openDispute(item)) {
    return { ok: false, reason: "存在认领争议，已暂停交接，须先登记争议处理结果" };
  }
  if (item.status !== "在管") return { ok: false, reason: "当前状态不可放行" };
  if (!item.claims.some((claim) => claim.status === "核对通过")) {
    return { ok: false, reason: "尚无核对通过的认领人" };
  }
  return { ok: true, reason: "" };
}

// ---------- 移交、归档、更正 ----------

export function validateHandover(input: HandoverInput, fromCustodian: string): string[] {
  const errors: string[] = [];
  if (!input.shift) errors.push("请选择接班班次");
  if (!input.to.trim()) errors.push("请填写接班保管人");
  if (input.to.trim() === fromCustodian.trim()) errors.push("接班保管人不能与交班人相同");
  if (!input.at || Number.isNaN(Date.parse(input.at))) errors.push("请选择有效的交接时间");
  return errors;
}

export function validateArchive(item: LostItem, input: ArchiveInput): string[] {
  const errors: string[] = [];
  if (item.status !== "在管") errors.push("只有在管物品可以处置归档");
  if (openDispute(item)) errors.push("存在未决争议，不能归档");
  if (item.claims.some((claim) => claim.status === "待核对")) {
    errors.push("仍有待核对的认领申请，请先完成核对");
  }
  if (!input.handler.trim()) errors.push("必须登记处置人");
  if (!input.destination.trim()) errors.push("必须登记物品去向");
  return errors;
}

export function validateCorrection(item: LostItem, input: CorrectionInput): string[] {
  const errors: string[] = [];
  if (item.status !== "已归档") errors.push("只有已归档记录才能更正");
  const changed =
    (input.description !== undefined && input.description !== item.description) ||
    (input.handler !== undefined && input.handler !== item.disposal?.handler) ||
    (input.destination !== undefined && input.destination !== item.disposal?.destination);
  if (!changed) errors.push("没有需要更正的内容");
  if (input.description !== undefined && featureTokens(input.description).length === 0) {
    errors.push("更正后的物品特征不能为空");
  }
  return errors;
}

export function blankCorrection(input: CorrectionInput): CorrectionInput {
  return {
    description: input.description?.trim() || undefined,
    handler: input.handler?.trim() || undefined,
    destination: input.destination?.trim() || undefined
  };
}

export function retentionOptions(): number[] {
  return [7, 15, DEFAULT_RETENTION_DAYS, 60, 90];
}
