<script setup lang="ts">
// 页面层：认领核对区。核对规则（姓名/电话/细节、争议挂起）在规则层
import { computed, reactive, ref } from "vue";
import { checkDetail, fmtDateTime } from "../rules";
import { maskPhone } from "../text";
import { useLostFoundStore } from "../store";
import type { Claim, LostItem } from "../types";

const props = defineProps<{ item: LostItem }>();
const store = useLostFoundStore();

const blankClaim = () => ({ name: "", phone: "", detail: "" });
const claimForm = reactive(blankClaim());
const claimMessage = ref<{ type: "ok" | "error"; text: string } | null>(null);

const reviewing = ref<Claim | null>(null);
const reviewForm = reactive({ note: "", approved: true });
const reviewMessage = ref("");

const resolving = ref(false);
const resolveForm = reactive({ winnerClaimId: "", basis: "", operator: store.shift.custodian });

const releasing = ref(false);
const releaseForm = reactive({ claimId: "", operator: store.shift.custodian });

const liveCheck = computed(() => checkDetail(props.item, claimForm.detail));
const openDispute = computed(() => props.item.disputes.find((d) => d.status === "挂起"));
const approvedClaims = computed(() => props.item.claims.filter((c) => c.status === "核对通过"));
const pendingClaims = computed(() => props.item.claims.filter((c) => c.status === "待核对"));

function submitClaim() {
  const result = store.submitClaim(props.item.id, { ...claimForm });
  claimMessage.value = result.ok
    ? { type: "ok", text: "认领申请已登记，等待值班人核对" }
    : { type: "error", text: result.errors.join("；") };
  if (result.ok) Object.assign(claimForm, blankClaim());
}

function openReview(claim: Claim) {
  reviewing.value = claim;
  reviewForm.note = "";
  reviewForm.approved = true;
  reviewMessage.value = "";
}

function submitReview() {
  if (!reviewing.value) return;
  const result = store.reviewClaim(
    props.item.id,
    reviewing.value.id,
    reviewForm.approved,
    store.shift.custodian,
    reviewForm.note
  );
  reviewMessage.value = result.ok ? "" : result.errors.join("；");
  if (result.ok) reviewing.value = null;
}

function submitResolve() {
  const result = store.resolveDispute(
    props.item.id,
    resolveForm.winnerClaimId,
    resolveForm.basis,
    resolveForm.operator
  );
  if (result.ok) resolving.value = false;
}

function submitRelease() {
  const result = store.releaseItem(props.item.id, releaseForm.claimId, releaseForm.operator);
  if (result.ok) releasing.value = false;
}

function claimStatusClass(status: Claim["status"]) {
  return {
    待核对: "chip pending",
    核对通过: "chip ok",
    已驳回: "chip off",
    争议挂起: "chip warn"
  }[status];
}
</script>

<template>
  <div class="block">
    <h4>认领核对</h4>

    <div v-if="item.status === '争议挂起'" class="banner warn">
      两名以上顾客都说得出物品细节，已暂停交接，任何一方都不能先领走。
    </div>

    <ul v-if="item.claims.length" class="claim-list">
      <li v-for="claim in item.claims" :key="claim.id">
        <div class="claim-head">
          <span class="claim-name">{{ claim.name }} · {{ maskPhone(claim.phone) }}</span>
          <span :class="claimStatusClass(claim.status)">{{ claim.status }}</span>
        </div>
        <p class="muted claim-text">
          自述：{{ claim.detail }}
          <em>（说中：{{ claim.matchedTokens.join("、") || "无" }}）</em>
        </p>
        <p v-if="claim.reviewNote" class="muted small">
          核对：{{ claim.reviewer }} {{ fmtDateTime(claim.reviewedAt ?? "") }} — {{ claim.reviewNote }}
        </p>
        <div v-if="claim.status === '待核对'" class="inline-actions">
          <button type="button" class="small" @click="openReview(claim)">核对姓名/电话/细节</button>
        </div>
      </li>
    </ul>
    <p v-else class="muted">暂无认领申请。</p>

    <!-- 登记认领申请 -->
    <form v-if="item.status === '在管' || item.status === '争议挂起'" class="subform" @submit.prevent="submitClaim">
      <div class="subform-grid">
        <label>
          姓名
          <input v-model="claimForm.name" placeholder="认领人姓名" />
        </label>
        <label>
          联系电话
          <input v-model="claimForm.phone" inputmode="numeric" maxlength="11" placeholder="11 位手机号" />
        </label>
        <label class="wide">
          自述物品细节
          <input
            v-model="claimForm.detail"
            placeholder="只有说中登记特征才算核对通过"
          />
        </label>
      </div>
      <p class="muted small">
        与登记特征比对：{{ liveCheck.matched.join("、") || "暂无命中" }}
        （命中 {{ liveCheck.matched.length }} 项，{{ liveCheck.passed ? "可提交核对" : "至少说中一项" }}）
      </p>
      <p v-if="claimMessage" class="banner" :class="claimMessage.type">{{ claimMessage.text }}</p>
      <button type="submit" class="small">登记认领申请</button>
    </form>

    <!-- 核对弹层 -->
    <div v-if="reviewing" class="modal-mask" @click.self="reviewing = null">
      <div class="modal">
        <h3>核对认领人 — {{ reviewing.name }}</h3>
        <p class="muted">电话 {{ reviewing.phone }}，自述：{{ reviewing.detail }}</p>
        <p class="muted">命中特征：{{ reviewing.matchedTokens.join("、") || "无" }}</p>
        <label>
          核对依据
          <textarea v-model="reviewForm.note" placeholder="如：姓名与证件一致、能说出独有特征、出示购买凭证等" />
        </label>
        <div class="radio-row">
          <label class="radio">
            <input v-model="reviewForm.approved" type="radio" :value="true" /> 核对通过
          </label>
          <label class="radio">
            <input v-model="reviewForm.approved" type="radio" :value="false" /> 驳回
          </label>
        </div>
        <p v-if="reviewMessage" class="banner error">{{ reviewMessage }}</p>
        <div class="inline-actions">
          <button type="button" @click="submitReview">提交核对结论</button>
          <button type="button" class="secondary" @click="reviewing = null">取消</button>
        </div>
      </div>
    </div>

    <!-- 争议处理 -->
    <div v-if="openDispute" class="subform warn-box">
      <h4>争议处理（{{ fmtDateTime(openDispute.raisedAt) }} 挂起）</h4>
      <p class="muted small">{{ openDispute.reason }}</p>
      <button type="button" class="small" :disabled="resolving" @click="resolving = true">登记争议处理结果</button>
      <form v-if="resolving" class="subform" @submit.prevent="submitResolve">
        <label>
          确认归属
          <select v-model="resolveForm.winnerClaimId">
            <option value="">请选择认领人</option>
            <option
              v-for="claim in item.claims.filter((c) => c.status === '争议挂起' || c.status === '核对通过')"
              :key="claim.id"
              :value="claim.id"
            >
              {{ claim.name }} {{ maskPhone(claim.phone) }}
            </option>
          </select>
        </label>
        <label>
          判定依据
          <textarea v-model="resolveForm.basis" placeholder="凭证、监控、独有细节等" />
        </label>
        <label>
          处理值班人
          <input v-model="resolveForm.operator" />
        </label>
        <div class="inline-actions">
          <button type="submit" class="small">解除挂起</button>
          <button type="button" class="secondary small" @click="resolving = false">取消</button>
        </div>
      </form>
    </div>
    <div v-else-if="item.disputes.length" class="muted small">
      争议已于 {{ fmtDateTime(item.disputes.at(-1)!.resolvedAt ?? "") }} 解决：
      {{ item.disputes.at(-1)!.basis }}
    </div>

    <!-- 放行 -->
    <div v-if="item.status === '在管' && approvedClaims.length" class="subform">
      <button type="button" class="small" :disabled="releasing" @click="releasing = true; releaseForm.claimId = approvedClaims[0].id">
        办理认领放行
      </button>
      <form v-if="releasing" class="subform" @submit.prevent="submitRelease">
        <label>
          放行给
          <select v-model="releaseForm.claimId">
            <option v-for="claim in approvedClaims" :key="claim.id" :value="claim.id">
              {{ claim.name }} {{ maskPhone(claim.phone) }}
            </option>
          </select>
        </label>
        <label>
          发放值班人
          <input v-model="releaseForm.operator" />
        </label>
        <p class="muted small">放行后记录中仅保留脱敏号码。</p>
        <div class="inline-actions">
          <button type="submit" class="small">确认放行</button>
          <button type="button" class="secondary small" @click="releasing = false">取消</button>
        </div>
      </form>
    </div>
    <p v-if="item.status === '已认领' && item.release" class="banner ok">
      已于 {{ fmtDateTime(item.release.releasedAt) }} 由 {{ item.release.operator }} 放行给
      {{ item.release.name }}（{{ item.release.phoneMasked }}）
    </p>
  </div>
</template>
