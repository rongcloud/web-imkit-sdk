<template>
  <div class="modal-confirm-provider">
    <rc-modal-provider @click="handleCancel">
      <rc-modal-dialog
        :width="286">
        <div class="rc-kit-modal-dialog-header" slot="header">{{ titleMsg }}</div>
        <div class="rc-kit-modal-dialog-content" slot="content">{{ content }}</div>
        <div class="rc-kit-modal-dialog-footer" slot="footer">
          <button class="cancel" @click="handleCancel">{{ cancelMsg }}</button>
          <button class="confirm" @click="handleConfirm">{{ confirmMsg }}</button>
        </div>
      </rc-modal-dialog>
    </rc-modal-provider>
  </div>
</template>
<script setup lang="ts">
import { $tt } from '../../i18n-vue';

withDefaults(defineProps<{ content?: string }>(), { content: '' });

const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const titleMsg = $tt('dialog.tips.msg');
const cancelMsg = $tt('dialog.cancel.msg');
const confirmMsg = $tt('dialog.confirm.msg');

const handleCancel = (e: MouseEvent) => {
  emit('cancel');
};
const handleConfirm = (e: MouseEvent) => {
  emit('confirm');
};

</script>
<style>
.rc-kit-modal-dialog-header {
  font-size: 14px;
  border-bottom: 1px solid #EAEAEA;
  padding: 10px 30px;
  line-height: 20px;
}
.rc-kit-modal-dialog-content {
  font-size: 12px;
  padding: 15px 30px;
}
.rc-kit-modal-dialog-footer {
  display: flex;
  justify-content: center;
  padding: 20px;
}
.rc-kit-modal-dialog-footer  button {
  min-width: 70px;
  text-decoration: none;
  border-radius: 3px;
  outline: none;
  font-size: 12px;
  padding: 5px 15px;
  border: 0;
  margin: 0 23px;
  cursor: pointer;
}
.rc-kit-modal-dialog-footer .cancel {
  border: 1px solid #DEDEDE;
  background-color: #F5F5F5;
}
.rc-kit-modal-dialog-footer  .confirm {
  border: 1px solid #0099FF;
  background-color: #0099FF;
  color: #FFFFFF;
}
</style>
