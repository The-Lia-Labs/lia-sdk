# @lia-labs/sdk-vue

Vue 3 composables for the Lia SDK. Re-exports all of `@lia-labs/sdk`.

```sh
npm install @lia-labs/sdk @lia-labs/sdk-vue
```

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useInit, useLanguage, useMainButton } from '@lia-labs/sdk-vue';

const lia = useInit();
const language = useLanguage();
const count = ref(0);
useMainButton(() => ({ text: `Tapped ${count.value}`, onClick: () => count.value++ }));
</script>

<template>
  <p v-if="lia.status.value === 'ready'">Hello, @{{ lia.result.value?.player.name }} ({{ language }})</p>
</template>
```


Full guide: https://docs.lialabs.org/packages/vue
