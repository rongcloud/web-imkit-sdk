<template>
  <div class="modal-forwarding-provider">
    <rc-modal-provider @click="handleCancel">
      <rc-modal-dialog :width="520" :height="450" :mobile-full-width="true">
        <div class="rc-kit-modal-dialog-header" slot="header">{{ titleMsg }}</div>
        <div class="rc-kit-modal-dialog-content" slot="content">
          <div class="search">
            <input class="search-input" v-model="search" type="text" :placeholder="searchMsg" @input="handleInputChange" >
            <img class="search-icon" :src="SEARCH_ICON" alt="SEARCH_ICON">
          </div>
          <div class="list">
            <div class="list-item" v-for="item in convRenderList" :key="item.key" :class="{ 'is-selected': isConversationChecked(item) }" @click="toggleConversation(item)">
              <div class="checkbox" @click.stop>
                <label :for="item.key">
                  <input :id="item.key" type="checkbox" v-model="convCheckedList" :value="item">
                  <span class="custom">
                    <img :src="CHECKED_ICON" alt="CHECKED_ICON">
                  </span>
                </label>
              </div>
              <div class="conversation">
                <rc-icon
                  class="profile"
                  :width="32"
                  :height="32"
                  :radius="50"
                  :url="item.portraitUri"
                  :online="false"></rc-icon>
                <span class="name">{{ item.name }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="rc-kit-modal-dialog-footer" slot="footer">
          <button class="cancel" @click="handleCancel">{{ cancelMsg }}</button>
          <button class="confirm" :disabled="convCheckedList.length === 0" @click="handleConfirm">{{ confirmMsg }}</button>
        </div>
      </rc-modal-dialog>
    </rc-modal-provider>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ConversationType } from '@rongcloud/imlib-next';
import { SEARCH_ICON, CHECKED_ICON } from '../../../assets';
import { IRCKitCachedConversation } from '../../../modules/conversation/IRCKitCachedConversation';
import { $tt } from '../../i18n-vue';
import { conversationList } from '../context';

const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const search = ref<string>('');
const convCheckedList = ref<IRCKitCachedConversation[]>([]);
const convRenderList = ref<IRCKitCachedConversation[]>([]);

const titleMsg = $tt('dialog.forwarding.msg');
const cancelMsg = $tt('dialog.cancel.msg');
const confirmMsg = $tt('dialog.forwarding.confirm');
const searchMsg = $tt('input.placeholder.search');
let timer: any = null;

const getFilteredConversationList = () => conversationList.value.filter((item) => {
  const isSupportedConversation = [ConversationType.PRIVATE, ConversationType.GROUP].includes(item.conversationType);
  return isSupportedConversation && item.name.includes(search.value);
});

const handleInputChange = () => {
  if (!timer) {
    timer = setTimeout(() => {
      convRenderList.value = getFilteredConversationList();
      clearTimeout(timer);
      timer = null;
    }, 500);
  }
};

const handleCancel = (e: MouseEvent) => {
  emit('cancel');
};
const handleConfirm = (e: MouseEvent) => {
  if (convCheckedList.value.length === 0) {
    return;
  }
  emit('confirm', { list: convCheckedList.value });
};

const toggleConversation = (item: IRCKitCachedConversation) => {
  const index = convCheckedList.value.findIndex((checkedItem) => checkedItem.key === item.key);
  if (index > -1) {
    convCheckedList.value.splice(index, 1);
    return;
  }
  convCheckedList.value.push(item);
};

const isConversationChecked = (item: IRCKitCachedConversation) => convCheckedList.value.some((checkedItem) => checkedItem.key === item.key);

onMounted(() => {
  convRenderList.value.splice(0, convRenderList.value.length, ...getFilteredConversationList());
});

</script>
<style>
input {
  border: 0;
  padding: 0;
  outline: none;
}
/* 模态窗背景 */
.modal-forwarding-provider .rc-kit-modal-provider {
  background-color: #00000080;
}

/* 对话框容器 */
.modal-forwarding-provider .rc-kit-modal-dialog {
  width: 520px;
  height: 450px;
  display: flex;
  flex-direction: column;
  max-height: 450px;
  overflow: hidden;
}

/* H5 响应式 */
@media (max-width: 768px) {
  .modal-forwarding-provider .rc-kit-modal-dialog {
    height: 450px;
  }

  .search .search-input {
    width: 100%;
    max-width: 400px;
  }
}

.rc-kit-modal-dialog-header {
  font-size: 18px;
  padding: 40px 0 20px 0;
  line-height: 20px;
  text-align: center;
  width: 500px;
  margin: 0 auto;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .rc-kit-modal-dialog-header {
    width: 100% !important;
    box-sizing: border-box;
    padding-left: 20px;
    padding-right: 20px;
  }
}

.rc-kit-modal-dialog-content {
  padding: 0;
  flex: 1;
  /* display: flex; */
  flex-direction: column;
  overflow: hidden;
}

.rc-kit-modal-dialog-content .search {
  font-size: 14px;
  margin: 0 20px 16px 20px;
  position: relative;
  flex-shrink: 0;
}

.search .search-input {
  padding: 8px 28px 8px 30px;
  border: 0.5px solid #E4E7ED;
  background-color: #FFFFFF;
  width: 100%;
  box-sizing: border-box;
  border-radius: 30px;
  font-size: 14px;
  color: #41464F;
}

.search .search-input::placeholder {
  color: #41464F;
}

.search .search-icon {
  position: absolute;
  /* 行高随平台字体变化，top 写死会偏；相对输入框整体居中才能与文字中心重合 */
  top: 50%;
  transform: translateY(-50%);
  left: 10px;
}

.list {
  min-height: 0;
  padding: 0 20px;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: #FFFFFF;
  font-size: 12px;
  height: 214px;
}

.list-item {
  display: flex;
  align-items: center;
  border-radius: 8px;
  margin-bottom: 3px;
  cursor: pointer;
  padding: 6px 10px;
  background-color: transparent;
}

.list-item:hover {
  background-color: #f3f5fa;
}

.list-item.is-selected,
.list-item.is-selected:hover {
  background-color: #d2e1fe;
}

.list .conversation {
  display: flex;
  align-items: center;
  overflow: hidden;
  min-width: 0;
}

.list .conversation .profile {
  padding: 0 6px;
  flex-shrink: 0;
}

.list .conversation .name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: #41464F;
}

.list-item .checkbox {
  flex-shrink: 0;
}

.list-item .checkbox input[type="checkbox"] {
  display: none;
}

.list-item .checkbox .custom {
  display: flex;
  width: 14px;
  height: 14px;
  border: 1px solid #0000001A;
  border-radius: 50%;
  background-color: #FFFFFF;
  font-size: 0;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.list-item .checkbox input[type="checkbox"]:checked + .custom {
  background-color: #16D258;
  border-color: #16D258;
}

.list-item .checkbox input[type="checkbox"]:checked + .custom img {
  display: block;
  width: 11px;
}

.list-item .checkbox .custom img {
  display: none;
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
.rc-kit-modal-dialog-footer .confirm {
  color: #FFFFFF;
  background-color: #0047FF;
}
.rc-kit-modal-dialog-footer .confirm:disabled {
  color: #CCCCCC;
  background-color: #F3F5FA;
  cursor: not-allowed;
}
.cancel:hover {
  background-color: #E3E7EF;
}
.confirm:hover:not(:disabled) {
  background-color: #366EFF;
}
</style>
