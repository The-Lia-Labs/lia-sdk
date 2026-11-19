# @lia-labs/sdk-react

React hooks for the Lia SDK. Re-exports all of `@lia-labs/sdk`.

```sh
npm install @lia-labs/sdk @lia-labs/sdk-react
```

```tsx
import { useEffect } from 'react';
import { pay, ready, useInit, useLanguage, useMainButton } from '@lia-labs/sdk-react';

export function App() {
  const lia = useInit();
  const language = useLanguage();
  useEffect(() => { if (lia.status === 'ready') ready(); }, [lia.status]);
  useMainButton(lia.status === 'ready' && { text: 'Buy', onClick: () => pay('extra-lives') });
  if (lia.status !== 'ready') return null;
  return <h1>Hello, @{lia.result.player.name} ({language})</h1>;
}
```


Full guide: https://docs.lialabs.org/packages/react
