// 资料层：遗失物保管台的数据模型（只描述结构，不含任何判断与存取逻辑）

export type ItemStatus = "在管" | "争议挂起" | "已认领" | "已归档";

export type ClaimStatus = "待核对" | "核对通过" | "已驳回" | "争议挂起";

export type DisposalReason = "超过保管期" | "确认无人认领";

/** 一条“发现”记录：同一物品被重复发现时，只向这里追加 */
export interface FindingEntry {
  id: string;
  station: string; // 发现站点
  foundAt: string; // 发现时间 ISO
  reporter: string; // 发现/上报人
  note: string;
  createdAt: string; // 本条录入时间
}

/** 暂存位置变更轨迹 */
export interface LocationMove {
  id: string;
  location: string;
  movedAt: string;
  operator: string;
  note: string;
}

/** 认领申请与核对结论 */
export interface Claim {
  id: string;
  name: string; // 姓名
  phone: string; // 联系电话
  detail: string; // 自述物品细节
  claimedAt: string;
  matchedTokens: string[]; // 登记时由判断层快照的“说中特征”，事后不随描述变化
  status: ClaimStatus;
  reviewer?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

/** 争议事件：两名以上顾客都说得上细节时挂起 */
export interface DisputeEvent {
  id: string;
  raisedAt: string;
  reason: string;
  status: "挂起" | "已解决";
  winnerClaimId?: string;
  basis?: string; // 解除依据（凭证、监控、独有细节等）
  operator?: string;
  resolvedAt?: string;
}

/** 单件物品的保管责任移交记录 */
export interface HandoverLine {
  id: string;
  from: string;
  to: string;
  at: string;
  shift: string;
  note: string;
}

/** 认领出库记录 */
export interface ReleaseRecord {
  claimId: string;
  name: string;
  phoneMasked: string; // 归档只留脱敏号码
  detail: string;
  operator: string; // 发放值班人
  releasedAt: string;
}

export interface Disposal {
  reason: DisposalReason;
  handler: string; // 处置人
  destination: string; // 去向
  disposedAt: string;
  note: string;
}

/** 已归档记录的更正痕迹：必须保留原值和原因 */
export interface Correction {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  operator: string;
  correctedAt: string;
}

export interface LostItem {
  id: string;
  category: string; // 物品类别
  brand: string; // 品牌/颜色等补充
  description: string; // 物品特征（多个特征用顿号/空格分隔）
  findings: FindingEntry[];
  locations: LocationMove[]; // 末条即当前暂存位置
  custodian: string; // 当前保管责任人
  claims: Claim[];
  disputes: DisputeEvent[];
  handovers: HandoverLine[];
  status: ItemStatus;
  registeredAt: string;
  retentionDays: number;
  expiresAt: string; // 保管到期时间
  release?: ReleaseRecord;
  disposal?: Disposal;
  corrections: Correction[];
}

export interface ShiftState {
  shift: string;
  custodian: string;
  since: string;
}

/** 一次交接班的汇总台账 */
export interface HandoverRecord {
  id: string;
  at: string;
  shift: string; // 接班班次
  fromCustodian: string;
  toCustodian: string;
  itemIds: string[]; // 随记录移交的物品
  note: string;
}

export interface StationState {
  version: 1;
  station: string;
  shift: ShiftState;
  seq: number;
  items: LostItem[];
  handovers: HandoverRecord[];
}

/** 登记页提交的原始表单 */
export interface RegisterInput {
  station: string;
  foundAt: string; // datetime-local 原始值
  category: string;
  brand: string;
  description: string;
  location: string;
  retentionDays: number;
  reporter: string;
  note: string;
}

export interface ClaimInput {
  name: string;
  phone: string;
  detail: string;
}

export interface ArchiveInput {
  reason: DisposalReason;
  handler: string;
  destination: string;
  note: string;
}

export interface HandoverInput {
  shift: string;
  to: string;
  at: string;
  note: string;
}

export interface CorrectionInput {
  description?: string;
  handler?: string;
  destination?: string;
}

export type MutationResult = { ok: true } | { ok: false; errors: string[] };
