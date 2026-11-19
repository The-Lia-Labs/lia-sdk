import { useEffect, useState } from 'react';
import { isLia, mockLia, pay, ready, session, useBackButton, useClosingConfirmation, useInit, useLanguage, useMainButton } from '@lia-labs/sdk-react';

// Outside Lia (your desktop browser while you build), a pretend Lia answers.
if (!isLia()) mockLia();

const WORDS = { en: 'Hello', es: 'Hola', fr: 'Bonjour', ar: 'مرحبًا' } as Record<string, string>;

export function App() {
  const lia = useInit();
  const language = useLanguage();
  const [screen, setScreen] = useState<'home' | 'detail' | 'game'>('home');

  useEffect(() => {
    if (lia.status === 'ready') ready();
  }, [lia.status]);

  // Lia's main button, only on the home screen.
  useMainButton(screen === 'home' && { text: 'Buy extra lives', onClick: buy });
  // Lia's back button, only one screen in.
  useBackButton(screen !== 'home' && (() => setScreen('home')));
  // Ask before closing while a game runs.
  useClosingConfirmation(screen === 'game');

  if (lia.status === 'loading') return null;
  if (lia.status === 'error') return <p>Open this app inside Lia.</p>;
  return (
    <main>
      <h1>{WORDS[language] ?? WORDS.en}, @{lia.result.player.name}</h1>
      {screen === 'home' && <button onClick={() => setScreen('game')}>Play</button>}
      {screen === 'game' && <p>Playing…</p>}
    </main>
  );
}

async function buy() {
  try {
    const { chargeId } = await pay('extra-lives');
    const { session: token } = await session();
    await fetch('/api/deliver', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: token, chargeId }) });
  } catch (error) {
    if ((error as { code?: string }).code !== 'cancelled') throw error;
  }
}
