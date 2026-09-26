<script setup lang="ts">
// 页面层：处置归档与已归档更正区。归档/更正校验在规则层
import { reactive, ref } from "vue";
import { fmtDateTime, isExpired } from "../rules";
import { useLostFoundStore } from "../store";
import type { DisposalReason, LostItem } from "../types";

const props = defineProps<{ item: LostItem }>();
const store = useLostFoundStore();

const archiving = ref(false);
const archiveForm = reactive({
  reason: "超过保管期" as DisposalReason,
  handler: store.shift.custodian,
  destination: "",
  note: ""
});
const archiveMessage = ref("");

const correcting = ref(false);
const correctionForm = reactive({
  description: props.item.description,
  handler: props.item.disposal?.handler ?? "",
  destination: props.item.disposal?.destination ?? "",
  reason: "",
  operator: store.shift.custodian
});
const correctionMessage = ref("");

function submitArchive() {
  const result = store.archive(props.item.id, { ...archiveForm });
  archiveMessage.value = result.ok ? "" : result.errors.join("；");
  if (result.ok) archiving.value = false;
}

function submitCorrection() {
  const result = store.correctArchived(
    props.item.id,
    {
      description: correctionForm.description,
      handler: correctionForm.handler,
      destination: correctionForm.destination
    },
    correctionForm.reason,
    correctionForm.operator
  );
  correctionMessage.value = result.ok ? "" : result.errors.join("；");
  if (result.ok) correcting.value = false;
}

const FIELD_LABELS: Record<string, string> = {
  description: "物品特征",
  "disposal.handler": "处置人",
  "disposal.destination": "去向"
};
</script>

<template>
  <div class="block">
    <h4>处置与归档</h4>

    <!-- 在管：处置归档 -->
    <div v-if="item.status === '在管'">
      <p v-if="isExpired(item, new Date())" class="banner warn">
        已超过保管期（{{ fmtDateTime(item.expiresAt) }} 到期），可登记处置并归档。
      </p>
      <button type="button" class="small" :disabled="archiving" @click="archiving = true">
        处置并归档
      </button>
      <form v-if="archiving" class="subform" @submit.prevent="submitArchive">
        <div class="subform-grid">
          <label>
            归档事由
            <select v-model="archiveForm.reason">
              <option>超过保管期</option>
              <option>确认无人认领</option>
            </select>
          </label>
          <label>
            处置人
            <input v-model="archiveForm.handler" placeholder="必填" />
          </label>
          <label class="wide">
            去向
            <input v-model="archiveForm.destination" placeholder="如：上交站务管理部 / 移交派出所" />
          </label>
          <label class="wide">
            处置说明
            <textarea v-model="archiveForm.note" placeholder="公示情况、交接凭证等" />
          </label>
        </div>
        <p v-if="archiveMessage" class="banner error">{{ archiveMessage }}</p>
        <div class="inline-actions">
          <button type="submit" class="small">确认归档</button>
          <button type="button" class="secondary small" @click="archiving = false">取消</button>
        </div>
      </form>
    </div>

    <!-- 已归档：处置信息与更正 -->
    <div v-else-if="item.status === '已归档' && item.disposal">
      <p class="muted">
        {{ item.disposal.reason }} · {{ fmtDateTime(item.disposal.disposedAt) }} 由
        {{ item.disposal.handler }} 处置，去向：{{ item.disposal.destination }}
      </p>
      <p v-if="item.disposal.note" class="muted small">{{ item.disposal.note }}</p>

      <div v-if="item.corrections.length" class="corrections">
        <h5>更正痕迹（保留原值与原因）</h5>
        <ul>
          <li v-for="correction in item.corrections" :key="correction.id">
            <span class="chip off">{{ FIELD_LABELS[correction.field] ?? correction.field }}</span>
            <s>{{ correction.oldValue }}</s> → <strong>{{ correction.newValue }}</strong>
            <p class="muted small">
              {{ fmtDateTime(correction.correctedAt) }} · {{ correction.operator }} · 原因：{{ correction.reason }}
            </p>
          </li>
        </ul>
      </div>

      <button type="button" class="secondary small" :disabled="correcting" @click="correcting = true">
        更正归档记录
      </button>
      <form v-if="correcting" class="subform" @submit.prevent="submitCorrection">
        <div class="subform-grid">
          <label class="wide">
            物品特征
            <input v-model="correctionForm.description" />
          </label>
          <label>
            处置人
            <input v-model="correctionForm.handler" />
          </label>
          <label>
            去向
            <input v-model="correctionForm.destination" />
          </label>
          <label class="wide">
            更正原因（必填，随记录保留）
            <textarea v-model="correctionForm.reason" />
          </label>
          <label>
            更正人
            <input v-model="correctionForm.operator" />
          </label>
        </div>
        <p v-if="correctionMessage" class="banner error">{{ correctionMessage }}</p>
        <div class="inline-actions">
          <button type="submit" class="small">提交更正</button>
          <button type="button" class="secondary small" @click="correcting = false">取消</button>
        </div>
      </form>
    </div>

    <p v-else class="muted">认领放行的物品无需处置归档。</p>
  </div>
</template>
