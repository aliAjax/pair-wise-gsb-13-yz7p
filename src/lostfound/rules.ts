// 判断层：遗失物保管台的业务规则，全部为纯函数，不接触 localStorage 与页面。

import type {
  Amendment,
  ClaimAttempt,
  CustodyTransfer,
  Disposition,
  DisputeResolution,
  DutyState,
  Finding,
  ItemStatus,
  LostItem,
} from "./types";

export const HOLD_DAYS_DEFAULT = 30;
export const DETAIL_MATCH_RATIO = 0.5; // 物品细节重合度阈值

export const STATUS_LABEL: Record<ItemStatus, string> = {
  custody: "保管中",
  pending: "待发还",
  disputed: "争议冻结",
  released: "已认领",
  archived: "已归档",
};

export const STATUS_ORDER: ItemStatus[] = [
  "custody",
  "pending",
  "disputed",
  "released",
  "archived",
];

export function uid(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ---------- 时间与时效 ----------

export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso: string): string {
  return formatDateTime(iso).slice(0, 10);
}

/** 保管截止时间（以首次登记时间起算） */
export function holdDeadline(item: LostItem): Date {
  return new Date(new Date(item.registeredAt).getTime() + item.holdDays * 86400000);
}

/** 是否已超过约定保管期 */
export function isExpired(item: LostItem, at: Date = new Date()): boolean {
  if (item.status === "released" || item.status === "archived") return false;
  return at.getTime() > holdDeadline(item).getTime();
}

/** 距离截止的剩余天数（负数表示已超期） */
export function daysLeft(item: LostItem, at: Date = new Date()): number {
  return Math.ceil((holdDeadline(item).getTime() - at.getTime()) / 86400000);
}

// ---------- 特征比对：同一特征在时效内重复登记只补发现记录 ----------

/** 归一化特征：去空白与常见标点，便于同物匹配 */
export function normalizeFeature(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s,，。.、;；:："'“”‘’!！?？()（）\-_/\\|]+/g, "")
    .trim();
}

function shingles(text: string, size = 2): Set<string> {
  const t = normalizeFeature(text);
  const set = new Set<string>();
  if (t.length <= size) {
    if (t) set.add(t);
    return set;
  }
  for (let i = 0; i <= t.length - size; i += 1) set.add(t.slice(i, i + size));
  return set;
}

/** 特征相似度（Jaccard），1 表示完全一致 */
export function featureSimilarity(a: string, b: string): number {
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  sa.forEach((s) => {
    if (sb.has(s)) inter += 1;
  });
  return inter / new Set([...sa, ...sb]).size;
}

/** 在管（未发还、未归档）且仍在保管时效内的物品才参与重复登记合并 */
export function findDuplicate(
  items: LostItem[],
  feature: string,
  at: Date = new Date()
): LostItem | undefined {
  const target = normalizeFeature(feature);
  return items.find((item) => {
    if (item.status === "released" || item.status === "archived") return false;
    if (isExpired(item, at)) return false;
    if (normalizeFeature(item.feature) === target) return true;
    return featureSimilarity(item.feature, feature) >= 0.8;
  });
}

export function nextItemNo(items: LostItem[], at: Date = new Date()): string {
  const day = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, "0")}${String(at.getDate()).padStart(2, "0")}`;
  const seq =
    items.reduce((max, item) => {
      const m = item.itemNo.match(/^LW-\d{8}-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0) + 1;
  return `LW-${day}-${String(seq).padStart(4, "0")}`;
}

// ---------- 登记发现 ----------

export interface RegisterInput {
  feature: string;
  category: string;
  station: string;
  location: string;
  storageLocation: string;
  finder: string;
  holdDays: number;
  note?: string;
  at?: string;
}

export type RegisterResult =
  | { kind: "created"; item: LostItem }
  | { kind: "supplemented"; item: LostItem; finding: Finding };

/** 登记发现：命中时效内同特征物品时只补一条发现记录，不新开一件 */
export function registerFinding(
  items: LostItem[],
  input: RegisterInput,
  custodian: string,
  at: Date = new Date()
): RegisterResult {
  const iso = input.at ?? at.toISOString();
  const duplicate = findDuplicate(items, input.feature, at);
  const finding: Finding = {
    id: uid("f"),
    at: iso,
    station: input.station,
    location: input.location,
    finder: input.finder || custodian,
    note: input.note,
    supplementary: Boolean(duplicate),
  };
  if (duplicate) {
    const item: LostItem = {
      ...duplicate,
      findings: [...duplicate.findings, finding],
    };
    return { kind: "supplemented", item, finding };
  }
  const item: LostItem = {
    id: uid("item"),
    itemNo: nextItemNo(items, at),
    feature: input.feature.trim(),
    category: input.category.trim(),
    storageLocation: input.storageLocation.trim(),
    custodian,
    findings: [finding],
    status: "custody",
    claims: [],
    releases: [],
    amendments: [],
    holdDays: input.holdDays > 0 ? input.holdDays : HOLD_DAYS_DEFAULT,
    registeredAt: iso,
  };
  return { kind: "created", item };
}

// ---------- 认领核对 ----------

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}

/** 电话核对：归一化后 7~15 位数字且与登记一致（登记处目前记录领取人自报电话，
 * 此处核对的是同一人再次出现或与留档号码是否一致） */
export function checkPhone(input: string, reference?: string): boolean {
  const a = normalizePhone(input);
  if (!/^\d{7,15}$/.test(a)) return false;
  if (!reference) return true; // 无留档时只校验格式有效
  return a === normalizePhone(reference);
}

export function checkName(input: string): boolean {
  return input.trim().length >= 2;
}

/** 物品细节核对：归一化后重合度达到阈值，防止仅凭一句“是个包”冒领 */
export function checkDetail(input: string, item: LostItem): boolean {
  const t = input.trim();
  if (t.length < 3) return false;
  if (featureSimilarity(t, item.feature) >= DETAIL_MATCH_RATIO) return true;
  return item.findings.some(
    (f) => featureSimilarity(t, `${item.feature} ${f.note ?? ""}`) >= DETAIL_MATCH_RATIO
  );
}

export interface ClaimInput {
  claimedName: string;
  claimedPhone: string;
  claimedDetail: string;
  clerk: string;
  at?: string;
}

export type ClaimResult = {
  item: LostItem;
  attempt: ClaimAttempt;
} & (
  | { outcome: "rejected" } // 核对未过，登记但物品不动
  | { outcome: "duplicate" } // 同一认领人重复来，不重复推进
  | { outcome: "matched" } // 唯一说得上来的人，进入待发还
  | { outcome: "frozen" } // 第二个说得上来的不同顾客：争议冻结
);

/** 认领：核对姓名、电话、物品细节；两名顾客都说得上时冻结，不交给后到的人 */
export function submitClaim(
  items: LostItem[],
  itemId: string,
  input: ClaimInput,
  at: Date = new Date()
): ClaimResult {
  const item = items.find((it) => it.id === itemId);
  if (!item) throw new Error("物品记录不存在");
  if (item.status === "released" || item.status === "archived") {
    throw new Error("物品已结束保管，不能再登记认领");
  }
  if (item.status === "disputed") {
    throw new Error("该物品处于争议冻结状态，请先由负责人处理争议");
  }

  const namePassed = checkName(input.claimedName);
  const phonePassed = checkPhone(input.claimedPhone);
  const detailPassed = checkDetail(input.claimedDetail, item);
  const passed = namePassed && phonePassed && detailPassed;

  const phone = normalizePhone(input.claimedPhone);
  const samePersonBefore = item.claims.some(
    (c) => c.passed && c.claimedName.trim() === input.claimedName.trim() && c.claimedPhone === phone
  );
  // 之前已有另一名核对通过的顾客
  const otherClaimantExists = item.claims.some(
    (c) => c.passed && !(c.claimedName.trim() === input.claimedName.trim() && c.claimedPhone === phone)
  );

  let result: ClaimAttempt["result"] = "rejected";
  let status: ItemStatus = item.status;
  if (!passed) {
    result = "rejected";
  } else if (samePersonBefore) {
    result = "duplicate";
  } else if (otherClaimantExists) {
    // 两名顾客都说得上：先停争议，不把物品交给后到的人
    result = "frozen";
    status = "disputed";
  } else {
    result = "matched";
    status = "pending";
  }

  const attempt: ClaimAttempt = {
    id: uid("c"),
    at: input.at ?? at.toISOString(),
    claimedName: input.claimedName.trim(),
    claimedPhone: phone,
    claimedDetail: input.claimedDetail.trim(),
    clerk: input.clerk,
    namePassed,
    phonePassed,
    detailPassed,
    passed,
    result,
  };
  const next: LostItem = { ...item, claims: [...item.claims, attempt], status };
  return { item: next, attempt, outcome: result } as ClaimResult;
}

/** 发还：仅待发还状态、存在唯一通过认领人时可执行 */
export function releaseItem(
  items: LostItem[],
  itemId: string,
  custodian: string,
  at: Date = new Date()
): LostItem[] {
  return items.map((item) => {
    if (item.id !== itemId) return item;
    if (item.status !== "pending") throw new Error("仅“待发还”物品可以发还");
    const claim = item.claims.find((c) => c.result === "matched");
    if (!claim) throw new Error("缺少核对通过的认领记录");
    return {
      ...item,
      status: "released",
      custodian,
      releases: [
        ...item.releases,
        {
          at: at.toISOString(),
          claimId: claim.id,
          toName: claim.claimedName,
          toPhone: claim.claimedPhone,
          custodian,
        },
      ],
    };
  });
}

/** 争议处理：由负责人裁定，全程留痕；裁定发还也必须显式指定胜诉认领人 */
export function resolveDispute(
  items: LostItem[],
  itemId: string,
  resolution: DisputeResolution
): LostItem[] {
  return items.map((item) => {
    if (item.id !== itemId) return item;
    if (item.status !== "disputed") throw new Error("仅争议冻结的物品需要处理争议");
    if (resolution.resolution === "release") {
      if (!resolution.releasedTo) throw new Error("裁定发还必须指定认领人");
      const claim = item.claims.find((c) => c.id === resolution.releasedTo!.claimId);
      if (!claim || !claim.passed) throw new Error("指定的认领人核对未通过");
      return {
        ...item,
        status: "released",
        custodian: resolution.handler,
        disputeResolution: resolution,
        releases: [
          ...item.releases,
          {
            at: resolution.at,
            claimId: claim.id,
            toName: claim.claimedName,
            toPhone: claim.claimedPhone,
            custodian: resolution.handler,
          },
        ],
      };
    }
    return { ...item, disputeResolution: resolution };
  });
}

// ---------- 换班：保管责任随记录移交 ----------

export function handover(
  items: LostItem[],
  from: DutyState,
  toCustodian: string,
  toShift: DutyState["shift"],
  station: string,
  note: string,
  at: Date = new Date()
): { items: LostItem[]; transfer: CustodyTransfer; duty: DutyState } {
  const name = toCustodian.trim();
  if (name.length < 2) throw new Error("接班人姓名至少两个字");
  const active = items.filter((it) => it.status !== "released" && it.status !== "archived");
  const transfer: CustodyTransfer = {
    id: uid("t"),
    at: at.toISOString(),
    fromCustodian: from.custodian,
    toCustodian: name,
    operator: name,
    itemCount: active.length,
    note: note.trim() || undefined,
  };
  const nextItems = items.map((item) =>
    item.status === "released" || item.status === "archived"
      ? item
      : { ...item, custodian: name }
  );
  const duty: DutyState = {
    station: station.trim() || from.station,
    custodian: name,
    shift: toShift,
    since: at.toISOString(),
  };
  return { items: nextItems, transfer, duty };
}

// ---------- 归档处置：超期或无人认领，必须登记处置人和去向 ----------

export function archiveItem(
  items: LostItem[],
  itemId: string,
  disposition: Omit<Disposition, "at"> & { at?: string },
  at: Date = new Date()
): LostItem[] {
  return items.map((item) => {
    if (item.id !== itemId) return item;
    if (item.status === "released") throw new Error("已认领物品不能归档处置");
    if (item.status === "archived") throw new Error("物品已归档");
    if (item.status === "pending" || item.status === "disputed") {
      throw new Error("存在待处理认领，不能按无人认领归档");
    }
    if (!disposition.disposedBy.trim()) throw new Error("必须登记处置人");
    if (!disposition.destination.trim()) throw new Error("必须登记去向");
    if (disposition.reason === "expired" && !isExpired(item, at)) {
      throw new Error("物品尚在保管时效内，不能按超期归档");
    }
    return {
      ...item,
      status: "archived",
      disposition: {
        at: disposition.at ?? at.toISOString(),
        reason: disposition.reason,
        disposedBy: disposition.disposedBy.trim(),
        destination: disposition.destination.trim(),
      },
    };
  });
}

// ---------- 已归档记录更正：保留原值和原因 ----------

/** 归档记录允许更正的字段（仅限去向、处置人、暂存位置这类登记差错） */
export const AMENDABLE_FIELDS: { key: keyof LostItem | "disposition.destination" | "disposition.disposedBy"; label: string }[] = [
  { key: "storageLocation", label: "暂存位置" },
  { key: "disposition.destination", label: "处置去向" },
  { key: "disposition.disposedBy", label: "处置人" },
];

export function getAmendableValue(item: LostItem, field: string): string {
  if (field === "disposition.destination") return item.disposition?.destination ?? "";
  if (field === "disposition.disposedBy") return item.disposition?.disposedBy ?? "";
  return String(item[field as keyof LostItem] ?? "");
}

export function amendArchived(
  items: LostItem[],
  itemId: string,
  amendment: {
    field: string;
    fieldLabel: string;
    newValue: string;
    editor: string;
    reason: string;
    at?: string;
  },
  at: Date = new Date()
): LostItem[] {
  return items.map((item) => {
    if (item.id !== itemId) return item;
    if (item.status !== "archived") throw new Error("只有已归档记录可以更正");
    if (!amendment.editor.trim()) throw new Error("必须登记更正人");
    if (!amendment.reason.trim()) throw new Error("必须填写更正原因");
    const oldValue = getAmendableValue(item, amendment.field);
    const newValue = amendment.newValue.trim();
    if (!newValue) throw new Error("更正后的值不能为空");
    if (oldValue === newValue) throw new Error("新值与原值相同，无需更正");

    const record: Amendment = {
      id: uid("a"),
      at: amendment.at ?? at.toISOString(),
      editor: amendment.editor.trim(),
      field: amendment.field,
      fieldLabel: amendment.fieldLabel,
      oldValue,
      newValue,
      reason: amendment.reason.trim(),
    };
    let next = { ...item, amendments: [...item.amendments, record] };
    if (amendment.field === "storageLocation") {
      next = { ...next, storageLocation: newValue };
    } else if (amendment.field === "disposition.destination" && next.disposition) {
      next = { ...next, disposition: { ...next.disposition, destination: newValue } };
    } else if (amendment.field === "disposition.disposedBy" && next.disposition) {
      next = { ...next, disposition: { ...next.disposition, disposedBy: newValue } };
    }
    return next;
  });
}

// ---------- 统计 ----------

export function countByStatus(items: LostItem[]): Record<ItemStatus, number> {
  const counts: Record<ItemStatus, number> = {
    custody: 0,
    pending: 0,
    disputed: 0,
    released: 0,
    archived: 0,
  };
  items.forEach((item) => {
    counts[item.status] += 1;
  });
  return counts;
}
