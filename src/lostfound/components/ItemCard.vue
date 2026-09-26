<script setup lang="ts">
// 页面层：单件遗失物卡片，汇总发现/位置/认领/移交/处置各区块
import { computed, reactive, ref } from "vue";
import ClaimBlock from "./ClaimBlock.vue";
import DisposalBlock from "./DisposalBlock.vue";
import { currentLocation, fmtDateTime, isExpired, toLocalInput } from "../rules";
import { useLostFoundStore } from "../store";
import type { LostItem } from "../types";

const props = defineProps<{ item: LostItem }>();
const store = useLostFoundStore();

const showTimeline = ref(false);
const moving = ref(false);
const moveForm = reactive({
  location: "",
  movedAt: toLocalInput(new Date()),
  operator: store.shift.custodian,
  note: ""
});
const moveMessage = ref("");

const expired = computed(() => isExpired(props.item, new Date()));

const statusClass = computed(
  () =>
    ({
      在管: "chip ok",
      争议挂起: "chip warn",
      已认领: "chip info",
      已归档: "chip off"
    })[props.item.status]
);

function submitMove() {
  const result = store.moveLocation(
    props.item.id,
    moveForm.location,
    moveForm.movedAt,
    moveForm.operator,
    moveForm.note
  );
  moveMessage.value = result.ok ? "" : result.errors.join("；");
  if (result.ok) {
    moving.value = false;
    moveForm.location = "";
    moveForm.note = "";
  }
}
</script>

<template>
  <article class="record item-card">
    <div class="record-head">
      <div>
        <p class="record-title">
          {{ item.id }} · {{ item.category }}
          <span v-if="item.brand !== '—'" class="muted">（{{ item.brand }}）</span>
        </p>
        <p class="muted small">特征：{{ item.description }}</p>
      </div>
      <div class="head-tags">
        <span :class="statusClass">{{ item.status }}</span>
        <span v-if="expired && item.status === '在管'" class="chip warn">已超期</span>
      </div>
    </div>

    <div class="details">
      <span>发现站点：{{ item.findings[0]?.station }}</span>
      <span>发现时间：{{ fmtDateTime(item.findings[0]?.foundAt ?? "") }}</span>
      <span>暂存位置：{{ currentLocation(item) }}</span>
      <span>保管责任：{{ item.custodian }}</span>
      <span>保管期：{{ item.retentionDays }} 天（{{ fmtDateTime(item.expiresAt) }} 到期）</span>
      <span>发现记录：{{ item.findings.length }} 条</span>
    </div>

    <div class="inline-actions">
      <button type="button" class="secondary small" @click="showTimeline = !showTimeline">
        {{ showTimeline ? "收起轨迹" : "发现/位置/移交轨迹" }}
      </button>
      <button
        v-if="item.status === '在管' || item.status === '争议挂起'"
        type="button"
        class="secondary small"
        @click="moving = !moving"
      >
        调整暂存位置
      </button>
    </div>

    <form v-if="moving" class="subform" @submit.prevent="submitMove">
      <div class="subform-grid">
        <label>
          新位置
          <input v-model="moveForm.location" placeholder="如：保管台 B3 格" />
        </label>
        <label>
          移动时间
          <input v-model="moveForm.movedAt" type="datetime-local" />
        </label>
        <label>
          经办人
          <input v-model="moveForm.operator" />
        </label>
        <label class="wide">
          说明
          <input v-model="moveForm.note" placeholder="如：贵重物品转保险柜" />
        </label>
      </div>
      <p v-if="moveMessage" class="banner error">{{ moveMessage }}</p>
      <button type="submit" class="small">记录位置变更</button>
    </form>

    <div v-if="showTimeline" class="timeline">
      <div class="timeline-group">
        <h5>发现记录</h5>
        <p v-for="finding in item.findings" :key="finding.id" class="muted small">
          {{ fmtDateTime(finding.foundAt) }} · {{ finding.station }} · {{ finding.reporter }}：{{ finding.note }}
        </p>
      </div>
      <div class="timeline-group">
        <h5>位置轨迹</h5>
        <p v-for="move in item.locations" :key="move.id" class="muted small">
          {{ fmtDateTime(move.movedAt) }} · {{ move.location }} · {{ move.operator }}：{{ move.note }}
        </p>
      </div>
      <div v-if="item.handovers.length" class="timeline-group">
        <h5>责任移交</h5>
        <p v-for="line in item.handovers" :key="line.id" class="muted small">
          {{ fmtDateTime(line.at) }} · {{ line.shift }} · {{ line.from }} → {{ line.to }}：{{ line.note }}
        </p>
      </div>
    </div>

    <ClaimBlock :item="item" />
    <DisposalBlock :item="item" />
  </article>
</template>
