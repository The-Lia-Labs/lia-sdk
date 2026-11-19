# @lia-labs/sdk-preact

Preact hooks for the Lia SDK, the same as `@lia-labs/sdk-react`. Re-exports all of `@lia-labs/sdk`.

```sh
npm install @lia-labs/sdk @lia-labs/sdk-preact
```

```tsx
import { useInit, useBackButton } from '@lia-labs/sdk-preact';

export function Detail({ onBack }: { onBack: () => void }) {
  useBackButton(onBack);
  return <p>Details</p>;
}
```


Full guide: https://docs.lialabs.org/packages/preact
