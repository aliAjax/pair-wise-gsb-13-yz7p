<script setup lang="ts">
// 页面层：遗失物保管台主页面（原交接页扩展而来）
import { computed, reactive, ref } from "vue";
import ItemCard from "./ItemCard.vue";
import RegisterForm from "./RegisterForm.vue";
import { SHIFTS } from "../constants";
import { fmtDateTime, isExpired, toLocalInput } from "../rules";
import { useLostFoundStore } from "../store";

const store = useLostFoundStore();

const tab = ref<"register" | "ledger" | "handover">("ledger");
const statusFilter = ref("全部");
const keyword = ref("");

const STATUS_FILTERS = ["全部", "在管", "争议挂起", "已认领", "已归档"] as const;

const metrics = computed(() => {
  const now = new Date();
  return [
    { label: "在管物品", value: store.heldItems.length },
    { label: "争议挂起", value: store.disputedItems.length },
    {
      label: "超期未处置",
      value: store.items.filter((item) => item.status === "在管" && isExpired(item, now)).length
    },
    { label: "已归档", value: store.archivedItems.length }
  ];
});

const filteredItems = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  return store.items.filter((item) => {
    if (statusFilter.value !== "全部" && item.status !== statusFilter.value) return false;
    if (!key) return true;
    const haystack = [
      item.id,
      item.category,
      item.brand,
      item.description,
      ...item.findings.map((finding) => finding.station),
      ...item.claims.map((claim) => claim.name)
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(key);
  });
});

// ---------- 交接班 ----------
const handoverForm = reactive({
  shift: "",
  to: "",
  at: toLocalInput(new Date()),
  note: ""
});
const handoverMessage = ref<{ type: "ok" | "error"; text: string } | null>(null);

function submitHandover() {
  const result = store.handover({ ...handoverForm });
  handoverMessage.value = result.ok
    ? { type: "ok", text: `已交接给 ${handoverForm.to}，${store.heldItems.length} 件在管物品责任随记录移交` }
    : { type: "error", text: result.errors.join("；") };
  if (result.ok) {
    handoverForm.shift = "";
    handoverForm.to = "";
    handoverForm.note = "";
  }
}

function resetDemo() {
  if (window.confirm("确定重置为演示数据？当前登记内容将被清除。")) {
    store.reset();
    handoverMessage.value = null;
  }
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">石油行业前端最小闭环 · 遗失物保管台</p>
          <h1>加油站遗失物保管台</h1>
          <p class="subtitle">
            登记发现站点、时间、物品特征与暂存位置；同特征在时效内重复登记只补发现记录；
            认领须核对姓名、电话与物品细节，多人说中即挂起争议；交接班保管责任随记录移交；
            超期或无人认领须登记处置人和去向方可归档，归档更正保留原值与原因。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">Vite</span>
          <span class="tag">TypeScript</span>
          <span class="tag">Pinia</span>
        </div>
      </header>

      <section class="shift-strip">
        <span class="tag strong">当前班次：{{ store.shift.shift }}</span>
        <span class="tag strong">保管责任：{{ store.shift.custodian }}</span>
        <span class="tag">自 {{ fmtDateTime(store.shift.since) }} 起</span>
        <span class="tag">站点：{{ store.station }}</span>
        <button type="button" class="secondary small" @click="resetDemo">重置演示数据</button>
      </section>

      <section class="metrics">
        <article v-for="metric in metrics" :key="metric.label" class="metric">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </section>

      <nav class="tabs">
        <button type="button" :class="{ active: tab === 'ledger' }" @click="tab = 'ledger'">保管台账</button>
        <button type="button" :class="{ active: tab === 'register' }" @click="tab = 'register'">登记遗失物</button>
        <button type="button" :class="{ active: tab === 'handover' }" @click="tab = 'handover'">交接班</button>
      </nav>

      <!-- 保管台账 -->
      <section v-if="tab === 'ledger'" class="list-panel">
        <div class="toolbar">
          <h2>保管台账</h2>
          <div class="toolbar-controls">
            <input v-model="keyword" class="search" placeholder="搜索编号 / 特征 / 站点 / 认领人" />
            <select v-model="statusFilter">
              <option v-for="option in STATUS_FILTERS" :key="option">{{ option }}</option>
            </select>
          </div>
        </div>
        <div class="record-grid">
          <div v-if="filteredItems.length === 0" class="empty">暂无匹配记录</div>
          <ItemCard v-for="item in filteredItems" :key="item.id" :item="item" />
        </div>
      </section>

      <!-- 登记 -->
      <section v-else-if="tab === 'register'">
        <RegisterForm />
      </section>

      <!-- 交接班 -->
      <section v-else class="workspace">
        <form class="panel" @submit.prevent="submitHandover">
          <h2>交接班登记</h2>
          <p class="muted small">
            交接后，{{ store.heldItems.length }} 件在管物品的保管责任随记录一并移交：
            {{ store.heldItems.map((item) => item.id).join("、") || "无" }}
          </p>
          <div class="form-grid">
            <label>
              接班班次
              <select v-model="handoverForm.shift" required>
                <option value="">请选择</option>
                <option v-for="option in SHIFTS" :key="option">{{ option }}</option>
              </select>
            </label>
            <label>
              接班保管人
              <input v-model="handoverForm.to" placeholder="接班值班人姓名" required />
            </label>
            <label>
              交接时间
              <input v-model="handoverForm.at" type="datetime-local" required />
            </label>
            <label>
              交接说明
              <textarea v-model="handoverForm.note" placeholder="口头事项落账、待办提醒等" />
            </label>
          </div>
          <p v-if="handoverMessage" class="banner" :class="handoverMessage.type">
            {{ handoverMessage.text }}
          </p>
          <button type="submit">确认交接（责任随记录移交）</button>
        </form>

        <section class="list-panel">
          <h2>交接台账</h2>
          <div class="record-grid">
            <div v-if="store.handovers.length === 0" class="empty">暂无交接记录</div>
            <article v-for="record in store.handovers" :key="record.id" class="record">
              <div class="record-head">
                <p class="record-title">{{ record.id }} · {{ record.shift }}</p>
                <span class="chip info">{{ record.itemIds.length }} 件</span>
              </div>
              <div class="details">
                <span>时间：{{ fmtDateTime(record.at) }}</span>
                <span>移交：{{ record.fromCustodian }} → {{ record.toCustodian }}</span>
                <span class="wide">物品：{{ record.itemIds.join("、") }}</span>
              </div>
              <p class="note">{{ record.note }}</p>
            </article>
          </div>
        </section>
      </section>
    </div>
  </main>
</template>
