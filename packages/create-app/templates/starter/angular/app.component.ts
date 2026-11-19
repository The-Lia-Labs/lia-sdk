import { Component, effect } from '@angular/core';
import { injectInit, ready } from './lia';
import { APP_NAME } from './config';
import { appTitle, connectionMessage, GUIDE_URL, openGuide } from './starter';

@Component({ selector: 'app-root', standalone: true, template: `
  <main>
    <span class="mark" aria-hidden="true">✦</span>
    <h1>{{ title }}</h1>
    <p role="status">{{ message(lia()) }}</p>
    <a [href]="guide" target="_blank" rel="noreferrer" (click)="openGuide($event)">Start building →</a>
  </main>
` })
export class AppComponent {
  readonly lia = injectInit();
  readonly title = appTitle(APP_NAME);
  readonly guide = GUIDE_URL;
  readonly message = connectionMessage;
  readonly openGuide = openGuide;
  constructor() { effect(() => { if (this.lia().status === 'ready') requestAnimationFrame(() => ready()); }); }
}
