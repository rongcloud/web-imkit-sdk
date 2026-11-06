<template>
  <div class="rc-icon-notification">
    <img :src="TOP_ICON" alt="icon-notification">
  </div>
</template>

<script setup lang="ts">
import { TOP_ICON } from '../../assets';
</script>
<style>
.rc-icon-notification {
  margin-left: 5px;
  display: flex;
  align-items: center;
}
</style>
