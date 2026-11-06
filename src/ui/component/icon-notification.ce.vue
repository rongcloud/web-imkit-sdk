<template>
  <div class="rc-icon-notification">
    <img :src="NOTIFICATION_SVG" alt="icon-notification">
  </div>
</template>

<script setup lang="ts">
import { NOTIFICATION_SVG } from '../../assets';
</script>
<style>
.rc-icon-notification {
  margin-left: 5px;
  display: flex;
  align-items: center;
}
</style>
