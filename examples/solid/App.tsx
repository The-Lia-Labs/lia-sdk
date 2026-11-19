import { createEffect, createSignal, Show } from 'solid-js';
import { createBackButton, createInit, createMainButton, isLia, mockLia, pay, ready, useLanguage } from '@lia-labs/sdk-solid';

if (!isLia()) mockLia();

const WORDS: Record<string, string> = { en: 'Hello', es: 'Hola', fr: 'Bonjour', ar: 'مرحبًا' };

function Game(props: { onBack: () => void }) {
  createBackButton(props.onBack); // shown while this component lives
  return <p>Playing…</p>;
}

export function App() {
  const lia = createInit();
  const language = useLanguage();
  const [playing, setPlaying] = createSignal(false);

  createEffect(() => lia().status === 'ready' && ready());
  createMainButton(() => !playing() && { text: 'Buy extra lives', onClick: () => pay('extra-lives').catch(() => {}) });

  return (
    <Show when={lia().status === 'ready'} fallback={<p>Opening…</p>}>
      <h1>{WORDS[language()] ?? WORDS.en}</h1>
      <Show when={playing()} fallback={<button onClick={() => setPlaying(true)}>Play</button>}>
        <Game onBack={() => setPlaying(false)} />
      </Show>
    </Show>
  );
}
