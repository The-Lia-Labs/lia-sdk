import { useEffect } from 'react';
import { ready, useInit } from './lia';
import { APP_NAME } from './config';
import { appTitle, connectionMessage, GUIDE_URL, openGuide } from './starter';

export function App() {
  const lia = useInit();
  useEffect(() => { if (lia.status === 'ready') ready(); }, [lia.status]);
  return <main>
    <span className="mark" aria-hidden="true">✦</span>
    <h1>{appTitle(APP_NAME)}</h1>
    <p role="status">{connectionMessage(lia)}</p>
    <a href={GUIDE_URL} target="_blank" rel="noreferrer" onClick={openGuide}>Start building →</a>
  </main>;
}
