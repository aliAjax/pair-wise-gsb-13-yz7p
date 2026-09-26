// 编排层：保管台状态。调用判断层规则、通过本机保存层持久化，本身不写判断细节

import { defineStore } from "pinia";
import { loadState, resetState, saveState } from "./storage";
import {
  blankCorrection,
  canRelease,
  checkDetail,
  disputeTriggered,
  findDuplicate,
  isExpired,
  validateArchive,
  validateClaim,
  validateCorrection,
  validateHandover,
  validateRegister
} from "./rules";
import { maskPhone } from "./text";
import type {
  ArchiveInput,
  Claim,
  Correction,
  DisputeEvent,
  FindingEntry,
  HandoverLine,
  HandoverRecord,
  LocationMove,
  LostItem,
  MutationResult,
  RegisterInput,
  ClaimInput,
  HandoverInput,
  CorrectionInput,
  StationState
} from "./types";

let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function fail(...errors: string[]): MutationResult {
  return { ok: false, errors };
}

export const useLostFoundStore = defineStore("lostfound", {
  state: (): StationState => loadState(),

  getters: {
    now: () => new Date(),
    heldItems(state): LostItem[] {
      return state.items.filter((item) => item.status === "在管" || item.status === "争议挂起");
    },
    disputedItems(state): LostItem[] {
      return state.items.filter((item) => item.status === "争议挂起");
    },
    archivedItems(state): LostItem[] {
      return state.items.filter((item) => item.status === "已归档");
    }
  },

  actions: {
    persist() {
      saveState(this.$state);
    },

    reset() {
      this.$patch(resetState());
    },

    privatePatch(mutator: (draft: StationState) => void) {
      // 状态均为 JSON 安全数据，深拷贝后修改再整体 patch
      const draft: StationState = JSON.parse(JSON.stringify(this.$state)) as StationState;
      mutator(draft);
      this.$patch(draft);
      this.persist();
    },

    findItem(id: string): LostItem | undefined {
      return this.items.find((item) => item.id === id);
    },

    // ---------- 登记 ----------

    /** 查重结果：页面据此决定“补发现记录”还是开新件 */
    previewRegister(input: RegisterInput) {
      return findDuplicate(this.items, input, new Date());
    },

    register(input: RegisterInput): MutationResult {
      const errors = validateRegister(input);
      if (errors.length) return fail(...errors);

      const duplicate = findDuplicate(this.items, input, new Date());
      if (duplicate.exact) {
        // 同一特征在时效内重复登记：只补发现记录，不新开一件
        return this.appendFinding(duplicate.exact.id, input);
      }

      this.seq += 1;
      const id = `LF-${String(this.seq).padStart(4, "0")}`;
      const foundAt = new Date(input.foundAt).toISOString();
      const expiresAt = new Date(
        new Date(input.foundAt).getTime() + input.retentionDays * 86_400_000
      ).toISOString();

      const finding: FindingEntry = {
        id: uid("f"),
        station: input.station.trim(),
        foundAt,
        reporter: input.reporter.trim(),
        note: input.note.trim() || "首次登记",
        createdAt: new Date().toISOString()
      };
      const location: LocationMove = {
        id: uid("l"),
        location: input.location.trim(),
        movedAt: foundAt,
        operator: input.reporter.trim(),
        note: "首次入库"
      };
      const item: LostItem = {
        id,
        category: input.category,
        brand: input.brand.trim() || "—",
        description: input.description.trim(),
        findings: [finding],
        locations: [location],
        custodian: this.shift.custodian,
        claims: [],
        disputes: [],
        handovers: [],
        status: "在管",
        registeredAt: new Date().toISOString(),
        retentionDays: input.retentionDays,
        expiresAt,
        corrections: []
      };
      this.items = [item, ...this.items];
      this.persist();
      return { ok: true };
    },

    /** 补一条发现记录（重复发现或人工合并） */
    appendFinding(itemId: string, input: RegisterInput): MutationResult {
      const item = this.findItem(itemId);
      if (!item) return fail("未找到对应物品");
      if (isExpired(item, new Date())) return fail("该物品已超过保管期，不能并入新发现");
      const errors = validateRegister(input);
      if (errors.length) return fail(...errors);

      this.privatePatch((draft) => {
        const target = draft.items.find((entry) => entry.id === itemId)!;
        target.findings.push({
          id: uid("f"),
          station: input.station.trim(),
          foundAt: new Date(input.foundAt).toISOString(),
          reporter: input.reporter.trim(),
          note: input.note.trim() || "同一物品重复发现，补登发现记录",
          createdAt: new Date().toISOString()
        });
      });
      return { ok: true };
    },

    moveLocation(itemId: string, location: string, movedAt: string, operator: string, note: string): MutationResult {
      const item = this.findItem(itemId);
      if (!item) return fail("未找到对应物品");
      if (!location.trim()) return fail("请填写新的暂存位置");
      if (!movedAt || Number.isNaN(Date.parse(movedAt))) return fail("请选择移动时间");
      if (!operator.trim()) return fail("请填写经办人");

      const move: LocationMove = {
        id: uid("l"),
        location: location.trim(),
        movedAt: new Date(movedAt).toISOString(),
        operator: operator.trim(),
        note: note.trim() || "调整暂存位置"
      };
      this.privatePatch((draft) => {
        draft.items.find((entry) => entry.id === itemId)!.locations.push(move);
      });
      return { ok: true };
    },

    // ---------- 认领核对 ----------

    submitClaim(itemId: string, input: ClaimInput): MutationResult {
      const item = this.findItem(itemId);
      if (!item) return fail("未找到对应物品");
      if (item.status === "已归档") return fail("物品已归档，不能再提交认领");
      if (item.status === "已认领") return fail("物品已被认领");

      const errors = validateClaim(input);
      if (errors.length) return fail(...errors);

      const check = checkDetail(item, input.detail);
      const claim: Claim = {
        id: uid("c"),
        name: input.name.trim(),
        phone: input.phone.trim(),
        detail: input.detail.trim(),
        claimedAt: new Date().toISOString(),
        matchedTokens: check.matched,
        status: "待核对"
      };
      this.privatePatch((draft) => {
        draft.items.find((entry) => entry.id === itemId)!.claims.push(claim);
      });
      return { ok: true };
    },

    /** 值班人核对姓名/电话/物品细节；通过 2 人自动挂起争议，绝不放行给后到者 */
    reviewClaim(
      itemId: string,
      claimId: string,
      approved: boolean,
      reviewer: string,
      reviewNote: string
    ): MutationResult {
      const item = this.findItem(itemId);
      if (!item) return fail("未找到对应物品");
      if (!reviewer.trim()) return fail("请填写核对值班人");
      if (!reviewNote.trim()) return fail("请填写核对依据");
      const claim = item.claims.find((entry) => entry.id === claimId);
      if (!claim || claim.status !== "待核对") return fail("该认领申请已处理");

      this.privatePatch((draft) => {
        const target = draft.items.find((entry) => entry.id === itemId)!;
        const targetClaim = target.claims.find((entry) => entry.id === claimId)!;
        targetClaim.status = approved ? "核对通过" : "已驳回";
        targetClaim.reviewer = reviewer.trim();
        targetClaim.reviewedAt = new Date().toISOString();
        targetClaim.reviewNote = reviewNote.trim();

        if (approved && disputeTriggered(target)) {
          target.status = "争议挂起";
          target.claims
            .filter((entry) => entry.status === "核对通过")
            .forEach((entry) => {
              entry.status = "争议挂起";
            });
          const dispute: DisputeEvent = {
            id: uid("d"),
            raisedAt: new Date().toISOString(),
            reason: "两名以上顾客说中物品细节，暂停交接，待凭凭证/监控判定",
            status: "挂起"
          };
          target.disputes.push(dispute);
        }
      });
      return { ok: true };
    },

    resolveDispute(itemId: string, winnerClaimId: string, basis: string, operator: string): MutationResult {
      const item = this.findItem(itemId);
      if (!item) return fail("未找到对应物品");
      const dispute = item.disputes.find((entry) => entry.status === "挂起");
      if (!dispute) return fail("没有挂起中的争议");
      const winner = item.claims.find((claim) => claim.id === winnerClaimId);
      if (!winner) return fail("请选择确认的认领人");
      if (!basis.trim()) return fail("请填写判定依据");
      if (!operator.trim()) return fail("请填写处理值班人");

      this.privatePatch((draft) => {
        const target = draft.items.find((entry) => entry.id === itemId)!;
        target.disputes
          .filter((entry) => entry.status === "挂起")
          .forEach((entry) => {
            entry.status = "已解决";
            entry.winnerClaimId = winnerClaimId;
            entry.basis = basis.trim();
            entry.operator = operator.trim();
            entry.resolvedAt = new Date().toISOString();
          });
        target.claims.forEach((claim) => {
          if (claim.id === winnerClaimId) {
            claim.status = "核对通过";
          } else if (claim.status === "争议挂起") {
            claim.status = "已驳回";
            claim.reviewer = operator.trim();
            claim.reviewedAt = new Date().toISOString();
            claim.reviewNote = `争议判定给 ${winner.name}，依据：${basis.trim()}`;
          }
        });
        target.status = "在管";
      });
      return { ok: true };
    },

    releaseItem(itemId: string, claimId: string, operator: string): MutationResult {
      const item = this.findItem(itemId);
      if (!item) return fail("未找到对应物品");
      const guard = canRelease(item);
      if (!guard.ok) return fail(guard.reason);
      const claim = item.claims.find((entry) => entry.id === claimId);
      if (!claim || claim.status !== "核对通过") return fail("请选择核对通过的认领人");
      if (!operator.trim()) return fail("请填写发放值班人");

      this.privatePatch((draft) => {
        const target = draft.items.find((entry) => entry.id === itemId)!;
        const chosen = target.claims.find((entry) => entry.id === claimId)!;
        target.status = "已认领";
        target.release = {
          claimId,
          name: chosen.name,
          phoneMasked: maskPhone(chosen.phone),
          detail: chosen.detail,
          operator: operator.trim(),
          releasedAt: new Date().toISOString()
        };
      });
      return { ok: true };
    },

    // ---------- 交接班：保管责任随记录移交 ----------

    handover(input: HandoverInput): MutationResult {
      const errors = validateHandover(input, this.shift.custodian);
      if (errors.length) return fail(...errors);

      const from = this.shift.custodian;
      const to = input.to.trim();
      const at = new Date(input.at).toISOString();
      const movingIds = this.heldItems.map((item) => item.id);
      if (movingIds.length === 0) return fail("当前没有在管物品需要移交");

      this.privatePatch((draft) => {
        draft.items.forEach((entry) => {
          if (entry.status === "在管" || entry.status === "争议挂起") {
            const line: HandoverLine = {
              id: uid("h"),
              from,
              to,
              at,
              shift: input.shift,
              note: input.note.trim() || "随交接班记录移交保管责任"
            };
            entry.handovers.push(line);
            entry.custodian = to;
          }
        });
        const record: HandoverRecord = {
          id: `HO-${String(draft.handovers.length + 1).padStart(4, "0")}`,
          at,
          shift: input.shift,
          fromCustodian: from,
          toCustodian: to,
          itemIds: movingIds,
          note: input.note.trim() || "随交接班记录移交保管责任"
        };
        draft.handovers.unshift(record);
        draft.shift = { shift: input.shift, custodian: to, since: at };
      });
      return { ok: true };
    },

    // ---------- 归档与更正 ----------

    archive(itemId: string, input: ArchiveInput): MutationResult {
      const item = this.findItem(itemId);
      if (!item) return fail("未找到对应物品");
      const errors = validateArchive(item, input);
      if (errors.length) return fail(...errors);

      this.privatePatch((draft) => {
        const target = draft.items.find((entry) => entry.id === itemId)!;
        target.status = "已归档";
        target.custodian = "—";
        target.disposal = {
          reason: input.reason,
          handler: input.handler.trim(),
          destination: input.destination.trim(),
          disposedAt: new Date().toISOString(),
          note: input.note.trim()
        };
      });
      return { ok: true };
    },

    /** 已归档记录更正：保留原值与原因 */
    correctArchived(itemId: string, input: CorrectionInput, reason: string, operator: string): MutationResult {
      const item = this.findItem(itemId);
      if (!item) return fail("未找到对应物品");
      if (!reason.trim()) return fail("请填写更正原因");
      if (!operator.trim()) return fail("请填写更正人");
      const clean = blankCorrection(input);
      const errors = validateCorrection(item, clean);
      if (errors.length) return fail(...errors);

      const corrections: Correction[] = [];
      if (clean.description && clean.description !== item.description) {
        corrections.push({
          id: uid("x"),
          field: "description",
          oldValue: item.description,
          newValue: clean.description,
          reason: reason.trim(),
          operator: operator.trim(),
          correctedAt: new Date().toISOString()
        });
      }
      if (clean.handler && clean.handler !== item.disposal?.handler) {
        corrections.push({
          id: uid("x"),
          field: "disposal.handler",
          oldValue: item.disposal?.handler ?? "",
          newValue: clean.handler,
          reason: reason.trim(),
          operator: operator.trim(),
          correctedAt: new Date().toISOString()
        });
      }
      if (clean.destination && clean.destination !== item.disposal?.destination) {
        corrections.push({
          id: uid("x"),
          field: "disposal.destination",
          oldValue: item.disposal?.destination ?? "",
          newValue: clean.destination,
          reason: reason.trim(),
          operator: operator.trim(),
          correctedAt: new Date().toISOString()
        });
      }

      this.privatePatch((draft) => {
        const target = draft.items.find((entry) => entry.id === itemId)!;
        if (clean.description) target.description = clean.description;
        if (target.disposal && clean.handler) target.disposal.handler = clean.handler;
        if (target.disposal && clean.destination) target.disposal.destination = clean.destination;
        target.corrections.push(...corrections);
      });
      return { ok: true };
    }
  }
});
