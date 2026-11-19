<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { isLia, mockLia, pay, ready, useBackButton, useClosingConfirmation, useInit, useLanguage, useMainButton } from '@lia-labs/sdk-vue';

if (!isLia()) mockLia();

const WORDS: Record<string, string> = { en: 'Hello', es: 'Hola', fr: 'Bonjour', ar: 'مرحبًا' };
const lia = useInit();
const language = useLanguage();
const screen = ref<'home' | 'detail' | 'game'>('home');

watch(lia.status, (status) => status === 'ready' && ready());
useMainButton(() => screen.value === 'home' && { text: 'Buy extra lives', onClick: () => pay('extra-lives').catch(() => {}) });
const back = computed(() => (screen.value === 'home' ? null : () => (screen.value = 'home')));
useBackButton(back);
useClosingConfirmation(() => screen.value === 'game');
</script>

<template>
  <main v-if="lia.status.value === 'ready'">
    <h1>{{ WORDS[language] ?? WORDS.en }}, @{{ lia.result.value?.player.name }}</h1>
    <button v-if="screen === 'home'" @click="screen = 'game'">Play</button>
    <p v-if="screen === 'game'">Playing…</p>
  </main>
  <p v-else-if="lia.status.value === 'error'">Open this app inside Lia.</p>
</template>
