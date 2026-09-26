// 资料层：遗失物保管台的数据结构定义，只描述数据，不包含任何判断逻辑。

export type ItemStatus =
  | "custody" // 在管保管中
  | "pending" // 已核对通过，待发还（唯一认领人）
  | "disputed" // 争议冻结：出现第二名说得上来的顾客，暂不发还
  | "released" // 已认领发还
  | "archived"; // 已归档（超期/无人认领，已处置）

export type DispositionReason = "expired" | "unclaimed";

/** 一次发现/补充发现记录 */
export interface Finding {
  id: string;
  at: string; // ISO 时间
  station: string; // 发现站点
  location: string; // 发现位置（加油机、收银台等）
  finder: string; // 发现人/登记值班人
  note?: string;
  supplementary: boolean; // 是否为同一件物品的补充发现记录
}

/** 认领核对记录：姓名、联系电话、物品细节逐项核对 */
export interface ClaimAttempt {
  id: string;
  at: string;
  claimedName: string;
  claimedPhone: string;
  claimedDetail: string;
  clerk: string; // 办理值班人
  namePassed: boolean;
  phonePassed: boolean;
  detailPassed: boolean;
  passed: boolean; // 三项全部通过才算“说得上”
  result: "rejected" | "matched" | "duplicate" | "frozen";
  remark?: string;
}

/** 值班人换班：保管责任随记录移交 */
export interface CustodyTransfer {
  id: string;
  at: string;
  fromCustodian: string;
  toCustodian: string;
  operator: string;
  itemCount: number; // 移交时在管物品数
  note?: string;
}

/** 发还记录 */
export interface Release {
  at: string;
  claimId: string;
  toName: string;
  toPhone: string;
  custodian: string; // 发还时的保管责任人
}

/** 争议处理记录 */
export interface DisputeResolution {
  at: string;
  handler: string; // 处理人（站长等）
  resolution: "release" | "archive"; // 发还给其中一方 / 无人认领处置
  releasedTo?: { claimId: string; name: string; phone: string };
  note: string;
}

/** 归档处置：必须登记处置人和去向 */
export interface Disposition {
  at: string;
  reason: DispositionReason; // 超过保管期 / 确认无人认领
  disposedBy: string; // 处置人
  destination: string; // 去向（上交派出所、失物招领中心、站内存放柜等）
}

/** 已归档记录的更正：保留原值和原因 */
export interface Amendment {
  id: string;
  at: string;
  editor: string;
  field: keyof LostItem | string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

/** 一件遗失物 */
export interface LostItem {
  id: string;
  itemNo: string; // 物品编号 LW-...
  feature: string; // 物品特征（合并登记的匹配依据）
  category: string; // 物品类别
  storageLocation: string; // 暂存位置
  custodian: string; // 当前保管责任人，随换班移交
  findings: Finding[];
  status: ItemStatus;
  claims: ClaimAttempt[];
  releases: Release[];
  disputeResolution?: DisputeResolution;
  disposition?: Disposition;
  amendments: Amendment[];
  holdDays: number; // 约定保管天数
  registeredAt: string;
}

/** 班次/值班状态 */
export interface DutyState {
  station: string;
  custodian: string; // 当前值班人（也是新登记物品的初始保管责任人）
  shift: "早班" | "中班" | "晚班";
  since: string;
}

export interface DeskState {
  items: LostItem[];
  duty: DutyState;
  transfers: CustodyTransfer[];
}
