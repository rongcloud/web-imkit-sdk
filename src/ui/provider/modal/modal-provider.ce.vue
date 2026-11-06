<template>
  <div class="rc-kit-modal-provider">
    <slot></slot>
  </div>
</template>
<script setup lang="ts">

</script>
<style>
.rc-kit-modal-provider {
  background-color: rgba(0, 0, 0, .5);
  position: absolute;
  inset: 0px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000000;
  overflow: hidden;
}

</style>
