// 本机保存层：localStorage 的读写与种子数据，页面不直接碰 localStorage。

import type { DeskState, LostItem } from "./types";
import { HOLD_DAYS_DEFAULT, uid } from "./rules";

const STORAGE_KEY = "gas-station-lostfound-v1";

const DAY = 86400000;

function isoDaysAgo(days: number, hour = 9): string {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

export function seedState(): DeskState {
  const items: LostItem[] = [
    {
      id: uid("item"),
      itemNo: "LW-SEED-0001",
      feature: "黑色双肩包，内有笔记本电脑和驾驶证",
      category: "箱包",
      storageLocation: "办公室保管柜 A-2",
      custodian: "王强",
      findings: [
        {
          id: uid("f"),
          at: isoDaysAgo(2, 8),
          station: "第3加油站",
          location: "2号加油机旁地面",
          finder: "王强",
          supplementary: false,
          note: "早高峰后巡场发现",
        },
        {
          id: uid("f"),
          at: isoDaysAgo(1, 18),
          station: "第3加油站",
          location: "便利店收银台询问",
          finder: "赵敏",
          supplementary: true,
          note: "有人来电描述特征，未留姓名，补记一条发现线索",
        },
      ],
      status: "custody",
      claims: [],
      releases: [],
      amendments: [],
      holdDays: HOLD_DAYS_DEFAULT,
      registeredAt: isoDaysAgo(2, 8),
    },
    {
      id: uid("item"),
      itemNo: "LW-SEED-0002",
      feature: "银色金属钥匙串，带蓝色小熊挂件",
      category: "钥匙",
      storageLocation: "收银台失物盒 第1格",
      custodian: "王强",
      findings: [
        {
          id: uid("f"),
          at: isoDaysAgo(1, 12),
          station: "第3加油站",
          location: "便利店休息区桌下",
          finder: "赵敏",
          supplementary: false,
        },
      ],
      status: "custody",
      claims: [
        {
          id: uid("c"),
          at: isoDaysAgo(0, 14),
          claimedName: "李芳",
          claimedPhone: "13800001111",
          claimedDetail: "银色钥匙串，挂着蓝色小熊",
          clerk: "王强",
          namePassed: true,
          phonePassed: true,
          detailPassed: true,
          passed: true,
          result: "matched",
        },
      ],
      releases: [],
      amendments: [],
      holdDays: HOLD_DAYS_DEFAULT,
      registeredAt: isoDaysAgo(1, 12),
    },
    {
      id: uid("item"),
      itemNo: "LW-SEED-0003",
      feature: "棕色男士长款钱包，内有身份证及银行卡数张",
      category: "证件钱物",
      storageLocation: "站长室保险柜",
      custodian: "王强",
      findings: [
        {
          id: uid("f"),
          at: isoDaysAgo(3, 20),
          station: "第3加油站",
          location: "3号加油机",
          finder: "王强",
          supplementary: false,
        },
      ],
      status: "disputed",
      claims: [
        {
          id: uid("c"),
          at: isoDaysAgo(2, 10),
          claimedName: "陈刚",
          claimedPhone: "13900002222",
          claimedDetail: "棕色长款钱包，里面有身份证和好几张银行卡",
          clerk: "王强",
          namePassed: true,
          phonePassed: true,
          detailPassed: true,
          passed: true,
          result: "matched",
        },
        {
          id: uid("c"),
          at: isoDaysAgo(2, 16),
          claimedName: "周杰",
          claimedPhone: "13700003333",
          claimedDetail: "男士钱包棕色长款，夹着身份证、银行卡",
          clerk: "赵敏",
          namePassed: true,
          phonePassed: true,
          detailPassed: true,
          passed: true,
          result: "frozen",
          remark: "两人都说得上来，当场暂停发还并上报站长",
        },
      ],
      releases: [],
      amendments: [],
      holdDays: HOLD_DAYS_DEFAULT,
      registeredAt: isoDaysAgo(3, 20),
    },
    {
      id: uid("item"),
      itemNo: "LW-SEED-0004",
      feature: "一把黑色折叠雨伞",
      category: "其他",
      storageLocation: "杂物间货架（已处置）",
      custodian: "王强",
      findings: [
        {
          id: uid("f"),
          at: isoDaysAgo(40, 9),
          station: "第3加油站",
          location: "加油岛",
          finder: "王强",
          supplementary: false,
        },
      ],
      status: "archived",
      claims: [],
      releases: [],
      disposition: {
        at: isoDaysAgo(9, 10),
        reason: "expired",
        disposedBy: "站长 刘洋",
        destination: "上交辖区滨和路派出所",
      },
      amendments: [],
      holdDays: 30,
      registeredAt: isoDaysAgo(40, 9),
    },
    {
      id: uid("item"),
      itemNo: "LW-SEED-0005",
      feature: "白色儿童水壶，贴有卡通贴纸",
      category: "其他",
      storageLocation: "—",
      custodian: "王强",
      findings: [
        {
          id: uid("f"),
          at: isoDaysAgo(12, 17),
          station: "第3加油站",
          location: "便利店门口",
          finder: "赵敏",
          supplementary: false,
        },
      ],
      status: "released",
      claims: [
        {
          id: uid("c"),
          at: isoDaysAgo(11, 9),
          claimedName: "孙女士",
          claimedPhone: "13600004444",
          claimedDetail: "白色儿童水壶，上面有卡通贴纸",
          clerk: "赵敏",
          namePassed: true,
          phonePassed: true,
          detailPassed: true,
          passed: true,
          result: "matched",
        },
      ],
      releases: [
        {
          at: isoDaysAgo(11, 9),
          claimId: "",
          toName: "孙女士",
          toPhone: "13600004444",
          custodian: "赵敏",
        },
      ],
      amendments: [],
      holdDays: HOLD_DAYS_DEFAULT,
      registeredAt: isoDaysAgo(12, 17),
    },
  ];
  // 回填发还记录引用的认领核对记录 id
  const releasedItem = items.find((it) => it.itemNo === "LW-SEED-0005");
  if (releasedItem && releasedItem.releases[0] && releasedItem.claims[0]) {
    releasedItem.releases[0].claimId = releasedItem.claims[0].id;
  }

  return {
    items,
    duty: {
      station: "第3加油站",
      custodian: "王强",
      shift: "早班",
      since: isoDaysAgo(0, 8),
    },
    transfers: [
      {
        id: uid("t"),
        at: isoDaysAgo(1, 8),
        fromCustodian: "赵敏",
        toCustodian: "王强",
        operator: "王强",
        itemCount: 4,
        note: "晚班物品共4件，钥匙串有顾客约定今早来取",
      },
    ],
  };
}

export function loadState(): DeskState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedState();
  try {
    const parsed = JSON.parse(raw) as Partial<DeskState>;
    if (!Array.isArray(parsed.items) || !parsed.duty) return seedState();
    return parsed as DeskState;
  } catch {
    return seedState();
  }
}

export function saveState(state: DeskState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): DeskState {
  const seeded = seedState();
  saveState(seeded);
  return seeded;
}

export { STORAGE_KEY };
