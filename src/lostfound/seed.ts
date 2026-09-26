// 本机保存层：首次打开时生成的演示数据（不读写 localStorage，纯构造）

import { STATION_NAME } from "./constants";
import type { LostItem, StationState } from "./types";

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function seedItems(): LostItem[] {
  const inHandoverWindow = Date.now() - (Date.now() % 86_400_000) + 8 * 3600_000;

  return [
    {
      id: "LF-0001",
      category: "手机数码",
      brand: "苹果",
      description: "黑色、苹果手机、碎屏、带蓝色挂绳",
      findings: [
        {
          id: "f-1",
          station: STATION_NAME,
          foundAt: isoHoursAgo(6),
          reporter: "王芳",
          note: "顾客遗落在 3 号加油机旁",
          createdAt: isoHoursAgo(6)
        }
      ],
      locations: [
        {
          id: "l-1",
          location: "便利店内 · 遗失物保管台 A1 格",
          movedAt: isoHoursAgo(6),
          operator: "王芳",
          note: "首次入库"
        }
      ],
      custodian: "李强",
      claims: [
        {
          id: "c-1",
          name: "赵磊",
          phone: "13800001111",
          detail: "碎屏、黑色、有蓝色挂绳",
          claimedAt: isoHoursAgo(3),
          matchedTokens: ["碎屏", "黑色", "蓝色挂绳"],
          status: "核对通过",
          reviewer: "王芳",
          reviewedAt: isoHoursAgo(3),
          reviewNote: "特征对得上，但未出示购买凭证"
        },
        {
          id: "c-2",
          name: "陈静",
          phone: "13900002222",
          detail: "苹果手机、黑色、屏幕裂了",
          claimedAt: isoHoursAgo(1),
          matchedTokens: ["苹果手机", "黑色", "碎屏"],
          status: "核对通过",
          reviewer: "李强",
          reviewedAt: isoHoursAgo(1),
          reviewNote: "两人都说得出特征，已暂停交接"
        }
      ],
      disputes: [
        {
          id: "d-1",
          raisedAt: isoHoursAgo(1),
          reason: "赵磊、陈静均说中手机特征，需凭凭证或监控判定",
          status: "挂起"
        }
      ],
      handovers: [],
      status: "争议挂起",
      registeredAt: isoHoursAgo(6),
      retentionDays: 30,
      expiresAt: isoInDays(30),
      corrections: []
    },
    {
      id: "LF-0002",
      category: "证件卡片",
      brand: "—",
      description: "身份证、张姓、卡套有卡通贴纸",
      findings: [
        {
          id: "f-2",
          station: STATION_NAME,
          foundAt: isoHoursAgo(26),
          reporter: "周敏",
          note: "收银台拾获",
          createdAt: isoHoursAgo(26)
        },
        {
          id: "f-3",
          station: STATION_NAME + " · 便利店",
          foundAt: isoHoursAgo(20),
          reporter: "李强",
          note: "同一身份证再次被顾客交到柜台，并入本件",
          createdAt: isoHoursAgo(20)
        }
      ],
      locations: [
        {
          id: "l-2",
          location: "便利店内 · 遗失物保管台 B2 格",
          movedAt: isoHoursAgo(26),
          operator: "周敏",
          note: "首次入库"
        }
      ],
      custodian: "李强",
      claims: [],
      disputes: [],
      handovers: [
        {
          id: "h-1",
          from: "周敏",
          to: "李强",
          at: new Date(inHandoverWindow).toISOString(),
          shift: "早班",
          note: "夜班遗留，随交接本移交"
        }
      ],
      status: "在管",
      registeredAt: isoHoursAgo(26),
      retentionDays: 30,
      expiresAt: isoInDays(29),
      corrections: []
    },
    {
      id: "LF-0003",
      category: "箱包衣物",
      brand: "—",
      description: "黑色羽绒服、XXL、内袋有加油卡",
      findings: [
        {
          id: "f-4",
          station: STATION_NAME,
          foundAt: isoHoursAgo(24 * 35),
          reporter: "周敏",
          note: "挂在便利店试衣区",
          createdAt: isoHoursAgo(24 * 35)
        }
      ],
      locations: [
        {
          id: "l-3",
          location: "便利店内 · 遗失物保管台 C1 格",
          movedAt: isoHoursAgo(24 * 35),
          operator: "周敏",
          note: "首次入库"
        }
      ],
      custodian: "李强",
      claims: [],
      disputes: [],
      handovers: [],
      status: "在管",
      registeredAt: isoHoursAgo(24 * 35),
      retentionDays: 30,
      expiresAt: isoInDays(-5),
      corrections: []
    },
    {
      id: "LF-0004",
      category: "其他物品",
      brand: "膳魔师",
      description: "不锈钢保温杯、杯底刻有 LM、红色提绳",
      findings: [
        {
          id: "f-5",
          station: STATION_NAME,
          foundAt: isoHoursAgo(24 * 45),
          reporter: "周敏",
          note: "休息区桌面",
          createdAt: isoHoursAgo(24 * 45)
        }
      ],
      locations: [
        {
          id: "l-4",
          location: "便利店内 · 遗失物保管台 C2 格",
          movedAt: isoHoursAgo(24 * 45),
          operator: "周敏",
          note: "首次入库"
        }
      ],
      custodian: "—",
      claims: [
        {
          id: "c-3",
          name: "刘伟",
          phone: "13700003333",
          detail: "红色提绳的保温杯",
          matchedTokens: ["红色提绳"],
          claimedAt: isoHoursAgo(24 * 40),
          status: "已驳回",
          reviewer: "周敏",
          reviewedAt: isoHoursAgo(24 * 40),
          reviewNote: "只说中提绳，无法说清杯底刻字，暂不放行"
        }
      ],
      disputes: [],
      handovers: [],
      status: "已归档",
      registeredAt: isoHoursAgo(24 * 45),
      retentionDays: 30,
      expiresAt: isoInDays(-15),
      disposal: {
        reason: "超过保管期",
        handler: "孙建国",
        destination: "上交站务管理部统一处置",
        disposedAt: isoHoursAgo(24 * 14),
        note: "保管期满，公示 7 日无人认领"
      },
      corrections: [
        {
          id: "x-1",
          field: "destination",
          oldValue: "随班销毁",
          newValue: "上交站务管理部统一处置",
          reason: "原去向登记不规范，按站务要求更正",
          operator: "孙建国",
          correctedAt: isoHoursAgo(24 * 13)
        }
      ]
    }
  ];
}

export function buildSeedState(): StationState {
  return {
    version: 1,
    station: STATION_NAME,
    shift: {
      shift: "早班",
      custodian: "李强",
      since: new Date(Date.now() - (Date.now() % 86_400_000) + 8 * 3600_000).toISOString()
    },
    seq: 4,
    items: seedItems(),
    handovers: [
      {
        id: "HO-0001",
        at: new Date(Date.now() - (Date.now() % 86_400_000) + 8 * 3600_000).toISOString(),
        shift: "早班",
        fromCustodian: "周敏",
        toCustodian: "李强",
        itemIds: ["LF-0002", "LF-0003"],
        note: "夜班口头事项已全部落账，两件物品实物与记录一致"
      }
    ]
  };
}
