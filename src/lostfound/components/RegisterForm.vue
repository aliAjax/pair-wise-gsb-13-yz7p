<script setup lang="ts">
// 页面层：遗失物登记表单。查重判断来自规则层，本组件只负责录入与提示
import { computed, reactive, ref } from "vue";
import { CATEGORIES, DEFAULT_RETENTION_DAYS, STATION_NAME } from "../constants";
import { retentionOptions, toLocalInput } from "../rules";
import { useLostFoundStore } from "../store";
import type { LostItem, RegisterInput } from "../types";

const store = useLostFoundStore();

const blank = (): RegisterInput => ({
  station: STATION_NAME,
  foundAt: toLocalInput(new Date()),
  category: "",
  brand: "",
  description: "",
  location: "",
  retentionDays: DEFAULT_RETENTION_DAYS,
  reporter: store.shift.custodian,
  note: ""
});

const form = reactive<RegisterInput>(blank());
const message = ref<{ type: "ok" | "error"; text: string } | null>(null);
const exactMatch = ref<LostItem | null>(null);
const possible = ref<LostItem[]>([]);

const retentionList = retentionOptions();

const locationSuggestions = computed(() => {
  const locations = store.heldItems.map((item) => item.locations.at(-1)?.location ?? "");
  return [...new Set(locations)].filter(Boolean);
});

function scanDuplicates() {
  if (!form.category || !form.description.trim()) {
    exactMatch.value = null;
    possible.value = [];
    return;
  }
  const result = store.previewRegister({ ...form });
  exactMatch.value = result.exact;
  possible.value = result.possible.slice(0, 3);
}

function showResult(result: ReturnType<typeof store.register>, mergedId?: string) {
  if (result.ok) {
    message.value = {
      type: "ok",
      text: mergedId ? `已并入 ${mergedId}，仅补登一条发现记录` : "已新开一件遗失物并登记入库"
    };
    Object.assign(form, blank());
    exactMatch.value = null;
    possible.value = [];
  } else {
    message.value = { type: "error", text: result.errors.join("；") };
  }
}

function submit(forceNew = false) {
  const input = { ...form };
  const mergedId = exactMatch.value?.id;
  if (exactMatch.value && !forceNew) {
    const result = store.appendFinding(exactMatch.value.id, input);
    if (result.ok) {
      showResult(result, mergedId);
      return;
    }
    showResult(result);
    return;
  }
  if (forceNew) {
    exactMatch.value = null;
    possible.value = [];
  }
  showResult(store.register(input));
}

function mergeInto(item: LostItem) {
  showResult(store.appendFinding(item.id, { ...form }), item.id);
}
</script>

<template>
  <form class="panel register-panel" @submit.prevent="submit(false)">
    <h2>登记遗失物</h2>
    <div v-if="message" class="banner" :class="message.type" role="status">{{ message.text }}</div>

    <div class="form-grid">
      <label>
        发现站点
        <input v-model="form.station" required />
      </label>
      <label>
        发现时间
        <input v-model="form.foundAt" type="datetime-local" required />
      </label>
      <label>
        物品类别
        <select v-model="form.category" required @change="scanDuplicates">
          <option value="">请选择</option>
          <option v-for="option in CATEGORIES" :key="option">{{ option }}</option>
        </select>
      </label>
      <label>
        品牌 / 颜色补充
        <input v-model="form.brand" placeholder="如：苹果、黑色" />
      </label>
      <label class="wide">
        物品特征（用顿号或空格分隔多个特征）
        <input
          v-model="form.description"
          placeholder="如：黑色、皮质钱包、内有加油卡"
          @input="scanDuplicates"
        />
      </label>
      <label class="wide">
        暂存位置
        <input v-model="form.location" list="location-options" placeholder="如：保管台 A1 格" required />
        <datalist id="location-options">
          <option v-for="location in locationSuggestions" :key="location" :value="location" />
        </datalist>
      </label>
      <label>
        保管期（天）
        <select v-model.number="form.retentionDays">
          <option v-for="days in retentionList" :key="days" :value="days">{{ days }} 天</option>
        </select>
      </label>
      <label>
        登记人
        <input v-model="form.reporter" required />
      </label>
      <label class="wide">
        现场备注
        <textarea v-model="form.note" placeholder="拾取位置、在场人等说明" />
      </label>
    </div>

    <div v-if="exactMatch" class="duplicate-box warn">
      <p>
        检出时效内同特征物品 <strong>{{ exactMatch.id }}</strong
        >（{{ exactMatch.category }}），系统将只补一条发现记录，不新开一件。
      </p>
      <p class="muted">当前位置：{{ exactMatch.locations.at(-1)?.location }}</p>
      <div class="inline-actions">
        <button type="submit">补登发现记录</button>
        <button type="button" class="secondary" @click="submit(true)">确认为新物品，强制新开</button>
      </div>
    </div>

    <div v-else-if="possible.length" class="duplicate-box">
      <p>以下物品特征相近，请值班人确认是否为同一件：</p>
      <ul>
        <li v-for="item in possible" :key="item.id">
          <span>{{ item.id }} · {{ item.description }}</span>
          <button type="button" class="secondary small" @click="mergeInto(item)">并入这件</button>
        </li>
      </ul>
    </div>

    <div class="inline-actions">
      <button type="submit">登记 / 查重</button>
    </div>
  </form>
</template>
