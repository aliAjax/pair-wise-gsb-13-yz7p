// 资料层：保管台的基础常量

export const STATION_NAME = "城东一号加油站";

export const STORAGE_KEY = "dfwlfront-7-lostfound";

export const CATEGORIES = [
  "证件卡片",
  "现金票据",
  "手机数码",
  "钥匙门禁",
  "箱包衣物",
  "其他物品"
] as const;

export const SHIFTS = ["早班", "中班", "晚班"] as const;

export const DEFAULT_RETENTION_DAYS = 30;

/** 简单手机号校验：11 位、1 开头 */
export const PHONE_PATTERN = /^1\d{10}$/;

/** 物品特征/自述细节统一按这些符号切分 */
export const TOKEN_SPLIT_PATTERN = /[、，,。.;；\s/\\|]+/;
