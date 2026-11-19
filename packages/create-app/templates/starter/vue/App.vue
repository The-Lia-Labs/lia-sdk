<script setup lang="ts">
import { watch } from 'vue';
import { ready, useInit } from './lia';
import { APP_NAME } from './config';
import { appTitle, connectionMessage, GUIDE_URL, openGuide } from './starter';
const { status, error } = useInit();
watch(status, value => { if (value === 'ready') ready(); }, { immediate: true });
</script>

<template>
  <main>
    <span class="mark" aria-hidden="true">✦</span>
    <h1>{{ appTitle(APP_NAME) }}</h1>
    <p role="status">{{ connectionMessage({ status, error }) }}</p>
    <a :href="GUIDE_URL" target="_blank" rel="noreferrer" @click="openGuide">Start building →</a>
  </main>
</template>
