# @lia-labs/sdk-angular

Angular signals for the Lia SDK (Angular 17 and later). Re-exports all of `@lia-labs/sdk`.

```sh
npm install @lia-labs/sdk @lia-labs/sdk-angular
```

```ts
import { Component } from '@angular/core';
import { injectInit, injectLanguage, injectMainButton, pay } from '@lia-labs/sdk-angular';

@Component({
  selector: 'app-root',
  template: `@if (lia().status === 'ready') { <p>Hello ({{ language() }})</p> }`,
})
export class AppComponent {
  lia = injectInit();
  language = injectLanguage();
  button = injectMainButton({ text: 'Buy', onClick: () => pay('extra-lives') });
}
```


Full guide: https://docs.lialabs.org/packages/angular
