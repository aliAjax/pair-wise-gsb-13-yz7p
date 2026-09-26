<script setup lang="ts">
// 页面层：遗失物保管台。只负责交互与展示，规则调 rules，保存调 store。
import { computed, reactive, ref, watch } from "vue";
import ModalShell from "./components/ModalShell.vue";
import {
  AMENDABLE_FIELDS,
  STATUS_LABEL,
  checkDetail,
  checkName,
  checkPhone,
  daysLeft,
  featureSimilarity,
  formatDateTime,
  isExpired,
  registerFinding,
  releaseItem,
  resolveDispute,
  submitClaim,
  archiveItem,
  amendArchived,
  handover,
  countByStatus,
} from "./lostfound/rules";
import type {
  ClaimAttempt,
  CustodyTransfer,
  DispositionReason,
  ItemStatus,
  LostItem,
} from "./lostfound/types";
import { loadState, resetState, saveState } from "./lostfound/store";

// ---------- 本机数据 ----------
const state = ref(loadState());

watch(
  state,
  (value) => {
    saveState(value);
  },
  { deep: true }
);

const items = computed(() => state.value.items);
const duty = computed(() => state.value.duty);

// ---------- 页面提示 ----------
const flash = ref<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | undefined;
function notify(tone: "ok" | "warn" | "err", text: string) {
  flash.value = { tone, text };
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (flash.value = null), 4200);
}

// ---------- 顶部统计 ----------
const counts = computed(() => countByStatus(items.value));
const activeCount = computed(
  () => counts.value.custody + counts.value.pending + counts.value.disputed
);
const expiredCount = computed(
  () => items.value.filter((it) => it.status === "custody" && isExpired(it)).length
);

const metrics = computed(() => [
  { label: "在管物品（责任随班移交）", value: activeCount.value, tone: "custody" },
  { label: "待发还（已核对通过）", value: counts.value.pending, tone: "pending" },
  { label: "争议冻结", value: counts.value.disputed, tone: "disputed" },
  { label: "已归档", value: counts.value.archived, tone: "archived" },
]);

// ---------- 筛选与搜索 ----------
type FilterKey = "all" | ItemStatus;
const filter = ref<FilterKey>("all");
const keyword = ref("");

const filterOptions: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部物品" },
  { key: "custody", label: "保管中" },
  { key: "pending", label: "待发还" },
  { key: "disputed", label: "争议冻结" },
  { key: "released", label: "已认领" },
  { key: "archived", label: "已归档" },
];

const visibleItems = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return items.value
    .filter((it) => (filter.value === "all" ? true : it.status === filter.value))
    .filter((it) => {
      if (!kw) return true;
      return [it.itemNo, it.feature, it.category, it.storageLocation, it.custodian]
        .join(" ")
        .toLowerCase()
        .includes(kw);
    })
    .sort((a, b) => +new Date(b.registeredAt) - +new Date(a.registeredAt));
});

// ---------- 登记发现 ----------
const blankRegister = () => ({
  feature: "",
  category: "箱包",
  station: duty.value.station,
  location: "",
  storageLocation: "",
  holdDays: 30,
  finder: duty.value.custodian,
  note: "",
});

const registerForm = reactive(blankRegister());

function submitRegister() {
  try {
    const result = registerFinding(items.value, { ...registerForm }, duty.value.custodian);
    if (result.kind === "supplemented") {
      state.value.items = state.value.items.map((it) =>
        it.id === result.item.id ? result.item : it
      );
      notify(
        "warn",
        `检测到时效内同特征物品，未新开件；已在 ${result.item.itemNo} 追加第 ${result.item.findings.length} 条发现记录。`
      );
    } else {
      state.value.items = [result.item, ...state.value.items];
      notify("ok", `已登记新物品 ${result.item.itemNo}，保管责任人为 ${result.item.custodian}。`);
    }
    const station = registerForm.station;
    Object.assign(registerForm, blankRegister(), { station });
  } catch (e) {
    notify("err", (e as Error).message);
  }
}

// ---------- 弹层通用 ----------
type ModalKind = "claim" | "handover" | "archive" | "dispute" | "amend" | null;
const modal = ref<ModalKind>(null);
const activeItem = ref<LostItem | null>(null);

function open(kind: Exclude<ModalKind, null>, item?: LostItem) {
  activeItem.value = item ?? null;
  if (kind === "claim" && item) Object.assign(claimForm, blankClaim());
  if (kind === "handover") Object.assign(handoverForm, blankHandover());
  if (kind === "archive" && item) Object.assign(archiveForm, blankArchive(item));
  if (kind === "dispute" && item) Object.assign(disputeForm, blankDispute());
  if (kind === "amend" && item) Object.assign(amendForm, blankAmend(item));
  modal.value = kind;
}
function close() {
  modal.value = null;
  activeItem.value = null;
}

// ---------- 认领核对 ----------
const blankClaim = () => ({
  claimedName: "",
  claimedPhone: "",
  claimedDetail: "",
  clerk: duty.value.custodian,
});
const claimForm = reactive(blankClaim());

const liveChecks = computed(() => {
  const item = activeItem.value;
  return {
    name: checkName(claimForm.claimedName),
    phone: checkPhone(claimForm.claimedPhone),
    detail: item ? checkDetail(claimForm.claimedDetail, item) : false,
  };
});
const detailSimilarity = computed(() =>
  activeItem.value
    ? Math.round(featureSimilarity(claimForm.claimedDetail, activeItem.value.feature) * 100)
    : 0
);

const claimOutcomeText: Record<ClaimAttempt["result"], string> = {
  rejected: "核对未通过",
  matched: "核对通过，进入待发还",
  duplicate: "同一认领人已登记过",
  frozen: "触发争议冻结",
};

function submitClaimForm() {
  const item = activeItem.value;
  if (!item) return;
  try {
    const result = submitClaim(items.value, item.id, { ...claimForm });
    state.value.items = state.value.items.map((it) =>
      it.id === result.item.id ? result.item : it
    );
    if (result.outcome === "frozen") {
      notify("err", "第二名顾客也说得上细节：物品已争议冻结，任何人不得取走，须负责人裁定。");
    } else if (result.outcome === "rejected") {
      notify("warn", "核对未通过，已记录本次认领，物品状态不变。");
    } else if (result.outcome === "duplicate") {
      notify("warn", "该认领人此前已核对通过，无需重复登记。");
    } else {
      notify("ok", "三项核对通过，物品进入待发还；发还前请再次确认本人。");
    }
    close();
  } catch (e) {
    notify("err", (e as Error).message);
  }
}

function doRelease(item: LostItem) {
  const claim = item.claims.find((c) => c.result === "matched");
  if (!claim) return;
  const ok = window.confirm(
    `确认将 ${item.itemNo} 发还给 ${claim.claimedName}（${claim.claimedPhone}）？\n发还后记录不可删除。`
  );
  if (!ok) return;
  try {
    state.value.items = releaseItem(items.value, item.id, duty.value.custodian);
    notify("ok", `已发还，领取人：${claim.claimedName}，经办值班人：${duty.value.custodian}。`);
  } catch (e) {
    notify("err", (e as Error).message);
  }
}

// ---------- 换班移交 ----------
const blankHandover = () => ({
  toCustodian: "",
  shift: duty.value.shift,
  note: "",
});
const handoverForm = reactive(blankHandover());

const activeItems = computed(() =>
  items.value.filter((it) => it.status !== "released" && it.status !== "archived")
);

function submitHandover() {
  try {
    const result = handover(
      items.value,
      duty.value,
      handoverForm.toCustodian,
      handoverForm.shift,
      duty.value.station,
      handoverForm.note
    );
    state.value.items = result.items;
    state.value.duty = result.duty;
    state.value.transfers = [result.transfer, ...state.value.transfers];
    notify("ok", `保管责任已移交至 ${result.duty.custodian}，在管 ${result.transfer.itemCount} 件。`);
    close();
  } catch (e) {
    notify("err", (e as Error).message);
  }
}

const transfers = computed<CustodyTransfer[]>(() => state.value.transfers);

// ---------- 归档处置 ----------
const blankArchive = (item: LostItem) => ({
  reason: (isExpired(item) ? "expired" : "unclaimed") as DispositionReason,
  disposedBy: duty.value.custodian,
  destination: "",
});
const archiveForm = reactive(blankArchive(activeItem.value ?? ({} as LostItem)));

function submitArchive() {
  const item = activeItem.value;
  if (!item) return;
  try {
    state.value.items = archiveItem(items.value, item.id, { ...archiveForm });
    notify("ok", `已归档：${archiveForm.reason === "expired" ? "超过保管期" : "确认无人认领"}，去向已登记。`);
    close();
  } catch (e) {
    notify("err", (e as Error).message);
  }
}

// ---------- 争议处理 ----------
const blankDispute = () => ({
  handler: "",
  resolution: "release" as "release" | "archive",
  claimId: "",
  note: "",
});
const disputeForm = reactive(blankDispute());

const passedClaims = computed(() =>
  (activeItem.value?.claims ?? []).filter((c) => c.passed)
);

function submitDispute() {
  const item = activeItem.value;
  if (!item) return;
  try {
    const claim = passedClaims.value.find((c) => c.id === disputeForm.claimId);
    state.value.items = resolveDispute(items.value, item.id, {
      at: new Date().toISOString(),
      handler: disputeForm.handler.trim(),
      resolution: disputeForm.resolution,
      releasedTo:
        disputeForm.resolution === "release" && claim
          ? { claimId: claim.id, name: claim.claimedName, phone: claim.claimedPhone }
          : undefined,
      note: disputeForm.note.trim(),
    });
    notify(
      "ok",
      disputeForm.resolution === "release"
        ? `争议已裁定，物品发还给 ${claim?.claimedName}，处理过程已留痕。`
        : "争议已按无人认领处理，可继续登记处置去向并归档。"
    );
    close();
  } catch (e) {
    notify("err", (e as Error).message);
  }
}

// ---------- 归档记录更正 ----------
const blankAmend = (item: LostItem) => ({
  field: AMENDABLE_FIELDS[0].key as string,
  newValue: "",
  editor: duty.value.custodian,
  reason: "",
});
const amendForm = reactive(blankAmend(activeItem.value ?? ({} as LostItem)));

const amendOldValue = computed(() => {
  const item = activeItem.value;
  if (!item) return "";
  const def = AMENDABLE_FIELDS.find((f) => f.key === amendForm.field);
  if (!item || !def) return "";
  if (amendForm.field === "storageLocation") return item.storageLocation;
  if (amendForm.field === "disposition.destination") return item.disposition?.destination ?? "";
  return item.disposition?.disposedBy ?? "";
});

function submitAmend() {
  const item = activeItem.value;
  if (!item) return;
  const def = AMENDABLE_FIELDS.find((f) => f.key === amendForm.field);
  try {
    state.value.items = amendArchived(items.value, item.id, {
      field: amendForm.field,
      fieldLabel: def?.label ?? amendForm.field,
      newValue: amendForm.newValue,
      editor: amendForm.editor,
      reason: amendForm.reason,
    });
    notify("ok", "更正已保存，原值与更正原因保留在记录轨迹中。");
    close();
  } catch (e) {
    notify("err", (e as Error).message);
  }
}

// ---------- 记录轨迹 ----------
interface TimelineEntry {
  at: string;
  label: string;
  text: string;
  tone: string;
}

function timeline(item: LostItem): TimelineEntry[] {
  const rows: TimelineEntry[] = [];
  item.findings.forEach((f) =>
    rows.push({
      at: f.at,
      label: f.supplementary ? "补充发现" : "发现登记",
      text: `${f.station} · ${f.location}；发现人 ${f.finder}${f.note ? `；${f.note}` : ""}`,
      tone: "finding",
    })
  );
  item.claims.forEach((c) =>
    rows.push({
      at: c.at,
      label: `认领核对 · ${claimOutcomeText[c.result]}`,
      text: `${c.claimedName} / ${c.claimedPhone}；细节：${c.claimedDetail}；姓名${c.namePassed ? "✓" : "✗"} 电话${c.phonePassed ? "✓" : "✗"} 细节${c.detailPassed ? "✓" : "✗"}；经办 ${c.clerk}${c.remark ? `；${c.remark}` : ""}`,
      tone: c.passed ? (c.result === "frozen" ? "dispute" : "claim") : "reject",
    })
  );
  item.releases.forEach((r) =>
    rows.push({
      at: r.at,
      label: "发还",
      text: `领取人 ${r.toName} / ${r.toPhone}；发还时保管责任人 ${r.custodian}`,
      tone: "release",
    })
  );
  if (item.disputeResolution) {
    const d = item.disputeResolution;
    rows.push({
      at: d.at,
      label: "争议裁定",
      text: `${d.resolution === "release" ? `发还给 ${d.releasedTo?.name}` : "按无人认领处理"}；处理人 ${d.handler}；${d.note}`,
      tone: "dispute",
    });
  }
  if (item.disposition) {
    const d = item.disposition;
    rows.push({
      at: d.at,
      label: "归档处置",
      text: `${d.reason === "expired" ? "超过保管期" : "确认无人认领"}；处置人 ${d.disposedBy}；去向 ${d.destination}`,
      tone: "archive",
    });
  }
  item.amendments.forEach((a) =>
    rows.push({
      at: a.at,
      label: `归档更正 · ${a.fieldLabel}`,
      text: `原值「${a.oldValue}」→ 新值「${a.newValue}」；更正人 ${a.editor}；原因：${a.reason}`,
      tone: "amend",
    })
  );
  return rows.sort((a, b) => +new Date(a.at) - +new Date(b.at));
}

// ---------- 其他 ----------
function doReset() {
  if (!window.confirm("确定恢复为演示数据？本机已保存的记录将被覆盖。")) return;
  state.value = resetState();
  notify("ok", "已恢复演示数据。");
}

function statusTone(status: ItemStatus): string {
  return status;
}

function expiryHint(item: LostItem): string {
  if (item.status === "released" || item.status === "archived") return "";
  const left = daysLeft(item);
  if (isExpired(item)) return `已超期 ${-left} 天，可按超期归档`;
  return `保管剩余 ${left} 天`;
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">石油行业 · 加油站现场管理</p>
          <h1>遗失物保管台</h1>
          <p class="subtitle">
            纸盒收存、口头交班升级为登记留痕：发现登记、同物合并、认领三项核对、争议先冻结、换班责任随记录移交，处置归档必须有人、有去向。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">TypeScript</span>
          <span class="tag">本机 localStorage 保存</span>
          <button type="button" class="secondary ghost" @click="doReset">恢复演示数据</button>
        </div>
      </header>

      <section class="dutybar">
        <div class="duty-main">
          <span class="duty-label">当前值班 · 保管责任人</span>
          <strong>{{ duty.custodian }}</strong>
          <span class="duty-meta">{{ duty.station }} · {{ duty.shift }} · {{ formatDateTime(duty.since) }} 起</span>
        </div>
        <div class="duty-side">
          <span>在管 <b>{{ activeCount }}</b> 件</span>
          <span v-if="expiredCount" class="expired-chip">{{ expiredCount }} 件已超期</span>
          <button type="button" @click="open('handover')">交接班移交</button>
        </div>
      </section>

      <transition name="flash">
        <div v-if="flash" class="flash" :class="flash.tone">{{ flash.text }}</div>
      </transition>

      <section class="metrics">
        <article v-for="m in metrics" :key="m.label" class="metric" :class="`tone-${m.tone}`">
          <span>{{ m.label }}</span>
          <strong>{{ m.value }}</strong>
        </article>
      </section>

      <section class="workspace">
        <form class="panel" @submit.prevent="submitRegister">
          <h2>登记发现</h2>
          <p class="panel-hint">时效内出现相同物品特征时，系统只追加发现记录，不会新开一件。</p>
          <div class="form-grid">
            <label class="full">
              物品特征（合并登记的比对依据）
              <textarea
                v-model="registerForm.feature"
                placeholder="如：黑色双肩包，内有笔记本电脑和驾驶证"
                required
              />
            </label>
            <label>
              物品类别
              <select v-model="registerForm.category">
                <option>箱包</option>
                <option>证件钱物</option>
                <option>钥匙</option>
                <option>电子产品</option>
                <option>衣物</option>
                <option>其他</option>
              </select>
            </label>
            <label>
              保管天数
              <input v-model.number="registerForm.holdDays" type="number" min="1" max="3650" required />
            </label>
            <label>
              发现站点
              <input v-model="registerForm.station" required />
            </label>
            <label>
              发现位置
              <input v-model="registerForm.location" placeholder="如：2号加油机旁" required />
            </label>
            <label class="full">
              暂存位置
              <input v-model="registerForm.storageLocation" placeholder="如：办公室保管柜 A-2" required />
            </label>
            <label>
              发现/登记值班人
              <input v-model="registerForm.finder" required />
            </label>
            <label class="full">
              现场备注
              <textarea v-model="registerForm.note" class="small" placeholder="补充线索、来电询问等" />
            </label>
            <button type="submit">登记 / 补充发现</button>
          </div>
        </form>

        <section class="list-panel">
          <div class="toolbar">
            <h2>遗失物清单</h2>
            <div class="toolbar-controls">
              <input v-model="keyword" class="search" placeholder="搜编号 / 特征 / 暂存位置" />
              <select v-model="filter">
                <option v-for="o in filterOptions" :key="o.key" :value="o.key">{{ o.label }}</option>
              </select>
            </div>
          </div>

          <div class="record-grid">
            <div v-if="visibleItems.length === 0" class="empty">暂无匹配物品</div>
            <article v-for="item in visibleItems" :key="item.id" class="record">
              <div class="record-head">
                <div>
                  <p class="record-no">{{ item.itemNo }} · {{ item.category }}</p>
                  <p class="record-title">{{ item.feature }}</p>
                </div>
                <span class="status" :class="`st-${statusTone(item.status)}`">
                  {{ STATUS_LABEL[item.status] }}
                </span>
              </div>

              <div class="details">
                <span>暂存位置：{{ item.storageLocation }}</span>
                <span>保管责任人：{{ item.custodian }}</span>
                <span>发现 {{ item.findings.length }} 次（含补充 {{ item.findings.filter((f) => f.supplementary).length }}）</span>
                <span :class="{ 'text-danger': isExpired(item) && item.status === 'custody' }">{{ expiryHint(item) }}</span>
              </div>

              <div v-if="item.status === 'disputed'" class="alert-strip">
                两名顾客均通过核对，物品已冻结：不得交给后到者，由负责人裁定后再动。
              </div>

              <div class="actions">
                <button v-if="item.status !== 'released' && item.status !== 'archived'" type="button" @click="open('claim', item)">
                  认领核对
                </button>
                <button
                  v-if="item.status === 'pending'"
                  type="button"
                  @click="doRelease(item)"
                >确认发还</button>
                <button v-if="item.status === 'disputed'" type="button" class="warn-btn" @click="open('dispute', item)">
                  处理争议
                </button>
                <button
                  v-if="item.status === 'custody'"
                  type="button"
                  class="secondary"
                  @click="open('archive', item)"
                >超期/无人认领归档</button>
                <button v-if="item.status === 'archived'" type="button" class="secondary" @click="open('amend', item)">
                  更正记录
                </button>
              </div>

              <details class="timeline">
                <summary>完整记录轨迹（{{ timeline(item).length }} 条）</summary>
                <ol>
                  <li v-for="(row, i) in timeline(item)" :key="i" :class="`tl-${row.tone}`">
                    <span class="tl-time">{{ formatDateTime(row.at) }}</span>
                    <span class="tl-label">{{ row.label }}</span>
                    <p class="tl-text">{{ row.text }}</p>
                  </li>
                </ol>
              </details>
            </article>
          </div>

          <section v-if="transfers.length" class="transfer-log">
            <h3>交接班记录</h3>
            <ul>
              <li v-for="t in transfers.slice(0, 5)" :key="t.id">
                <span>{{ formatDateTime(t.at) }}</span>
                <b>{{ t.fromCustodian }} → {{ t.toCustodian }}</b>
                <em>移交在管 {{ t.itemCount }} 件</em>
                <p v-if="t.note">{{ t.note }}</p>
              </li>
            </ul>
          </section>
        </section>
      </section>
    </div>

    <!-- 认领核对 -->
    <ModalShell
      v-if="modal === 'claim' && activeItem"
      :title="`认领核对 · ${activeItem.itemNo}`"
      subtitle="逐项核对姓名、联系电话和物品细节；三项全部通过才算“说得上”。"
      @close="close"
    >
      <form class="modal-form" @submit.prevent="submitClaimForm">
        <p class="target-feature">登记特征：{{ activeItem.feature }}</p>
        <label>
          顾客姓名
          <input v-model="claimForm.claimedName" placeholder="请顾客出示有效证件" required />
        </label>
        <label>
          联系电话
          <input v-model="claimForm.claimedPhone" placeholder="7~15 位手机号或座机" required />
        </label>
        <label>
          顾客自述物品细节
          <textarea v-model="claimForm.claimedDetail" placeholder="让顾客自行描述，勿提示" required />
        </label>
        <ul class="checklist">
          <li :class="{ pass: liveChecks.name }">姓名格式 {{ liveChecks.name ? "✓" : "✗" }}</li>
          <li :class="{ pass: liveChecks.phone }">电话有效 {{ liveChecks.phone ? "✓" : "✗" }}</li>
          <li :class="{ pass: liveChecks.detail }">
            细节吻合 {{ liveChecks.detail ? "✓" : `✗（重合度 ${detailSimilarity}%）` }}
          </li>
        </ul>
        <p v-if="activeItem.claims.some((c) => c.passed)" class="warn-text">
          已有其他顾客核对通过：若本次也通过，物品将立即转为争议冻结，不能交给后到者。
        </p>
        <label>
          办理值班人
          <input v-model="claimForm.clerk" required />
        </label>
        <div class="modal-actions">
          <button type="button" class="secondary" @click="close">取消</button>
          <button type="submit">提交核对</button>
        </div>
      </form>
    </ModalShell>

    <!-- 交接班 -->
    <ModalShell
      v-if="modal === 'handover'"
      title="交接班 · 保管责任移交"
      subtitle="确认后，全部在管物品的保管责任人改为接班人，移交动作随记录留痕。"
      @close="close"
    >
      <form class="modal-form" @submit.prevent="submitHandover">
        <div class="handover-preview">
          <span>移交人：<b>{{ duty.custodian }}</b>（{{ duty.shift }}）</span>
          <span>在管物品：<b>{{ activeItems.length }}</b> 件</span>
        </div>
        <label>
          接班人姓名
          <input v-model="handoverForm.toCustodian" required />
        </label>
        <label>
          接班班次
          <select v-model="handoverForm.shift">
            <option>早班</option>
            <option>中班</option>
            <option>晚班</option>
          </select>
        </label>
        <label>
          交班说明
          <textarea v-model="handoverForm.note" placeholder="待认领约定、争议物品、暂存位置注意事项" />
        </label>
        <div class="modal-actions">
          <button type="button" class="secondary" @click="close">取消</button>
          <button type="submit">确认移交</button>
        </div>
      </form>
    </ModalShell>

    <!-- 归档处置 -->
    <ModalShell
      v-if="modal === 'archive' && activeItem"
      :title="`归档处置 · ${activeItem.itemNo}`"
      subtitle="超过保管期或确认无人认领时归档；必须登记处置人和去向。"
      @close="close"
    >
      <form class="modal-form" @submit.prevent="submitArchive">
        <label>
          处置原因
          <select v-model="archiveForm.reason">
            <option value="unclaimed">确认无人认领</option>
            <option value="expired" :disabled="!isExpired(activeItem)">
              超过保管期{{ isExpired(activeItem) ? "" : "（尚未超期，不可选）" }}
            </option>
          </select>
        </label>
        <label>
          处置人
          <input v-model="archiveForm.disposedBy" required />
        </label>
        <label>
          去向（必填）
          <input v-model="archiveForm.destination" placeholder="如：上交辖区派出所 / 失物招领中心" required />
        </label>
        <div class="modal-actions">
          <button type="button" class="secondary" @click="close">取消</button>
          <button type="submit">归档</button>
        </div>
      </form>
    </ModalShell>

    <!-- 争议处理 -->
    <ModalShell
      v-if="modal === 'dispute' && activeItem"
      :title="`处理争议 · ${activeItem.itemNo}`"
      subtitle="两名顾客都说得上物品细节。请负责人核实后裁定，处理过程全部留痕。"
      @close="close"
    >
      <form class="modal-form" @submit.prevent="submitDispute">
        <label>
          处理人（站长/负责人）
          <input v-model="disputeForm.handler" required />
        </label>
        <label>
          裁定方式
          <select v-model="disputeForm.resolution">
            <option value="release">核实后发还给其中一方</option>
            <option value="archive">均不能证明归属，按无人认领处理</option>
          </select>
        </label>
        <label v-if="disputeForm.resolution === 'release'">
          发还给
          <select v-model="disputeForm.claimId" required>
            <option value="" disabled>请选择经核对通过的认领人</option>
            <option v-for="c in passedClaims" :key="c.id" :value="c.id">
              {{ c.claimedName }} / {{ c.claimedPhone }}（{{ formatDateTime(c.at) }}）
            </option>
          </select>
        </label>
        <label>
          核实与裁定说明
          <textarea v-model="disputeForm.note" placeholder="核实了哪些凭证、为何如此裁定" required />
        </label>
        <div class="modal-actions">
          <button type="button" class="secondary" @click="close">取消</button>
          <button type="submit">提交裁定</button>
        </div>
      </form>
    </ModalShell>

    <!-- 归档更正 -->
    <ModalShell
      v-if="modal === 'amend' && activeItem"
      :title="`更正归档记录 · ${activeItem.itemNo}`"
      subtitle="已归档记录允许更正登记差错；原值与更正原因会完整保留。"
      @close="close"
    >
      <form class="modal-form" @submit.prevent="submitAmend">
        <label>
          更正字段
          <select v-model="amendForm.field">
            <option v-for="f in AMENDABLE_FIELDS" :key="f.key" :value="f.key">{{ f.label }}</option>
          </select>
        </label>
        <label>
          原值（保留不可改）
          <input :value="amendOldValue" disabled />
        </label>
        <label>
          更正为
          <input v-model="amendForm.newValue" required />
        </label>
        <label>
          更正人
          <input v-model="amendForm.editor" required />
        </label>
        <label>
          更正原因
          <textarea v-model="amendForm.reason" placeholder="如：归档时去向登记笔误，凭派出所回执更正" required />
        </label>
        <div class="modal-actions">
          <button type="button" class="secondary" @click="close">取消</button>
          <button type="submit">保存更正</button>
        </div>
      </form>
    </ModalShell>
  </main>
</template>
