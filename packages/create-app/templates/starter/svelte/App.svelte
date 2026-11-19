<script lang="ts">
  import { initStore, ready } from './lia';
  import { APP_NAME } from './config';
  import { appTitle, connectionMessage, GUIDE_URL, openGuide } from './starter';
  const lia = initStore();
  let announced = false;
  $: if ($lia.status === 'ready' && !announced) { announced = true; requestAnimationFrame(() => ready()); }
</script>

<main>
  <span class="mark" aria-hidden="true">✦</span>
  <h1>{appTitle(APP_NAME)}</h1>
  <p role="status">{connectionMessage($lia)}</p>
  <a href={GUIDE_URL} target="_blank" rel="noreferrer" onclick={openGuide}>Start building →</a>
</main>
