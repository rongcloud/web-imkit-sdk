<template>
  <div class="modal-delete-provider">
    <rc-modal-provider @click="handleCancel">
      <rc-modal-dialog
        :width="392">
        <div class="rc-kit-modal-dialog-header" slot="header">{{ contentMsg }}</div>
        <div class="rc-kit-modal-dialog-content" slot="content">
          {{ contentMsgContent }}
        </div>
        <div class="rc-kit-modal-dialog-footer" slot="footer">
          <button class="cancel" @click="handleCancel">{{ cancelMsg }}</button>
          <button class="confirm" @click="handleConfirm">{{ confirmMsg }}</button>
        </div>
      </rc-modal-dialog>
    </rc-modal-provider>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { $tt } from '../../i18n-vue';

defineProps<{
  // 是否显示撤回选项，因为是通过 document.createElement 创建的，props 定义为字符串
  recallEnable: 'true' | 'false',
}>();

const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const recall = ref<boolean>(false);

const contentMsg = $tt('dialog.delete.msg');
const contentMsgContent = $tt('dialog.delete.msg.content');
const cancelMsg = $tt('dialog.cancel.msg');
const confirmMsg = $tt('dialog.delete.msg.confirm');

const handleCancel = (e: MouseEvent) => {
  emit('cancel');
};
const handleConfirm = (e: MouseEvent) => {
  emit('confirm', recall.value);
};

</script>
<style>
.rc-kit-modal-dialog-header {
  font-size: 18px;
  padding: 40px 0 20px 0;
  line-height: 20px;
  text-align: center;
  font-weight: 500;
}
.rc-kit-modal-dialog-content {
  font-size: 14px;
  text-align: center;
}
.rc-kit-modal-dialog-footer {
  display: flex;
  justify-content: center;
  padding: 30px 0 40px 0;
}
.rc-kit-modal-dialog-footer  button {
  min-width: 70px;
  text-decoration: none;
  border-radius: 4px;
  outline: none;
  font-size: 16px;
  border: 0;
  margin: 0 15px;
  cursor: pointer;
  width: 110px;
  height: 36px;
  background-color: #F3F5FA;
}
.rc-kit-modal-dialog-footer .cancel {
  color: #020814;
}
.rc-kit-modal-dialog-footer  .confirm {
  color: #FF5A50;
}
.cancel:hover, .confirm:hover {
  background-color: #E3E7EF;
}
.content-check {
  display: flex;
  margin-top: 15px;
  align-items: center;
}
.checkbox input[type="checkbox"] {
  display: none;
}
.checkbox .custom {
  display: flex;
  width: 15px;
  height: 15px;
  border: 1px solid #ABB8CB;
  border-radius: 3px;
  background-color: #FFFFFF;
  font-size: 0;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  margin-right: 7px;
  box-sizing: border-box;
}

.checkbox input[type="checkbox"]:checked + .custom {
  background-color: #0099FF;
  border-color: #0099FF;
}

</style>
