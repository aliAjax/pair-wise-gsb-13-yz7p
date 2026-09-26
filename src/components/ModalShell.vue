<script setup lang="ts">
// 通用弹层：负责遮罩、标题与关闭，具体表单由插槽提供
defineProps<{
  title: string;
  subtitle?: string;
}>();

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true">
      <header class="modal-head">
        <div>
          <h3>{{ title }}</h3>
          <p v-if="subtitle" class="modal-sub">{{ subtitle }}</p>
        </div>
        <button type="button" class="icon-btn" aria-label="关闭" @click="emit('close')">×</button>
      </header>
      <div class="modal-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(23, 32, 51, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  z-index: 50;
  overflow-y: auto;
}

.modal {
  background: #fff;
  border-radius: 12px;
  width: min(640px, 100%);
  box-shadow: 0 20px 60px rgba(23, 32, 51, 0.25);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px 0;
}

.modal-head h3 {
  margin: 0;
  font-size: 19px;
}

.modal-sub {
  margin: 6px 0 0;
  color: #69758c;
  font-size: 13px;
  line-height: 1.6;
}

.icon-btn {
  background: #eef2f7;
  color: #445069;
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 20px;
  line-height: 1;
  border-radius: 8px;
  flex: none;
}

.modal-body {
  padding: 16px 20px 20px;
}
</style>
