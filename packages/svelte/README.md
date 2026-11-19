# @lia-labs/sdk-svelte

Svelte stores for the Lia SDK (Svelte 4 and 5). Re-exports all of `@lia-labs/sdk`.

```sh
npm install @lia-labs/sdk @lia-labs/sdk-svelte
```

```svelte
<script>
  import { initStore, stores, useMainButton, pay } from '@lia-labs/sdk-svelte';
  const lia = initStore();
  const { language } = stores;
  useMainButton({ text: 'Buy', onClick: () => pay('extra-lives') });
</script>

{#if $lia.status === 'ready'}<p>Hello, @{$lia.result.player.name} ({$language})</p>{/if}
```


Full guide: https://docs.lialabs.org/packages/svelte
