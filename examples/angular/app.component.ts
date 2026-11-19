import { Component, effect } from '@angular/core';
import { injectInit, injectLanguage, injectMainButton, isLia, mockLia, pay, ready } from '@lia-labs/sdk-angular';

if (!isLia()) mockLia();

const WORDS: Record<string, string> = { en: 'Hello', es: 'Hola', fr: 'Bonjour', ar: 'مرحبًا' };

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    @if (lia().status === 'ready') {
      <h1>{{ hello() }}, &#64;{{ lia().result?.player?.name }}</h1>
    } @else if (lia().status === 'error') {
      <p>Open this app inside Lia.</p>
    }
  `,
})
export class AppComponent {
  lia = injectInit();
  language = injectLanguage();
  hello = () => WORDS[this.language()] ?? WORDS['en'];
  // Lia's main button for this component's life.
  mainButton = injectMainButton({ text: 'Buy extra lives', onClick: () => pay('extra-lives').catch(() => {}) });

  constructor() {
    effect(() => {
      if (this.lia().status === 'ready') ready();
    });
  }
}
