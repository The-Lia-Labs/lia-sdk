<script lang="ts">
  import { isLia, mockLia, initStore, pay, ready, stores, useMainButton, useBackButton, useClosingConfirmation } from '@lia-labs/sdk-svelte';

  if (!isLia()) mockLia();

  const WORDS: Record<string, string> = { en: 'Hello', es: 'Hola', fr: 'Bonjour', ar: 'مرحبًا' };
  const lia = initStore();
  const { language } = stores;
  let playing = false;

  $: if ($lia.status === 'ready') ready();
  // The main button for this component's life.
  useMainButton({ text: 'Buy extra lives', onClick: () => pay('extra-lives').catch(() => {}) });

  let back: { dispose(): void } | null = null;
  let release: (() => void) | null = null;
  function play() {
    playing = true;
    back = useBackButton(stop);
    release = useClosingConfirmation();
  }
  function stop() {
    playing = false;
    back?.dispose();
    release?.();
  }
</script>

{#if $lia.status === 'ready'}
  <h1>{WORDS[$language] ?? WORDS.en}, @{$lia.result.player.name}</h1>
  {#if playing}<p>Playing…</p>{:else}<button on:click={play}>Play</button>{/if}
{:else if $lia.status === 'error'}
  <p>Open this app inside Lia.</p>
{/if}
