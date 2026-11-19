# @lia-labs/sdk-solid

Solid primitives for the Lia SDK. Re-exports all of `@lia-labs/sdk`.

```sh
npm install @lia-labs/sdk @lia-labs/sdk-solid
```

```tsx
import { createSignal } from 'solid-js';
import { createInit, createMainButton, useLanguage } from '@lia-labs/sdk-solid';

export function App() {
  const lia = createInit();
  const language = useLanguage();
  const [count, setCount] = createSignal(0);
  createMainButton(() => ({ text: `Tapped ${count()}`, onClick: () => setCount(count() + 1) }));
  return <p>{lia().status === 'ready' && `Hello (${language()})`}</p>;
}
```


Full guide: https://docs.lialabs.org/packages/solid
