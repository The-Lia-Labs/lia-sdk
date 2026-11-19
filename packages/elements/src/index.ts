import {
  backButton,
  controlBottomButton,
  controlHeaderButton,
  holdBanner,
  holdClosingConfirmation,
  holdVerticalSwipesOff,
  init,
  mainButton,
  ready,
  secondaryButton,
  settingsButton,
  type BottomButton,
  type BottomButtonOptions,
  type ButtonPosition,
  type Control,
} from '@lia-labs/sdk';

// @lia-labs/elements: the Lia SDK as custom elements, for any page and any framework. Each element is
// invisible and does its job while it's on the page:
//
//   <lia-app auto-ready></lia-app>                 init(), then ready() (events: lia-ready, lia-error)
//   <lia-main-button text="Buy for 5 LIA"></lia-main-button>      Lia's main button (event: lia-click)
//   <lia-secondary-button text="Skip" position="left"></lia-secondary-button>
//   <lia-back-button></lia-back-button>            the header's back button (event: lia-click)
//   <lia-settings-button></lia-settings-button>    Settings in the ⋯ menu (event: lia-click)
//   <lia-closing-confirmation></lia-closing-confirmation>   ask before closing
//   <lia-swipe-lock></lia-swipe-lock>              a swipe down won't close the sheet
//   <lia-banner position="bottom"></lia-banner>    a banner Lia docks at the edge (the page gets smaller to fit)
//
// Call defineLiaElements() once (the script build does it for you).

export const ELEMENT_NAMES = ['lia-app', 'lia-main-button', 'lia-secondary-button', 'lia-back-button', 'lia-settings-button', 'lia-closing-confirmation', 'lia-swipe-lock', 'lia-banner'] as const;

const BUTTON_ATTRIBUTES = ['text', 'color', 'text-color', 'disabled', 'progress', 'shine', 'position'];

/** Registers every element (safe to call twice). */
export function defineLiaElements(registry: CustomElementRegistry = customElements): void {
  if (typeof HTMLElement === 'undefined') return;

  const press = (el: HTMLElement) => () => el.dispatchEvent(new CustomEvent('lia-click', { bubbles: true }));
  const hidden = (el: HTMLElement) => {
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
  };

  class LiaApp extends HTMLElement {
    connectedCallback() {
      hidden(this);
      init({ cssVars: !this.hasAttribute('no-css-vars') }).then(
        (result) => {
          this.setAttribute('ready', '');
          this.dispatchEvent(new CustomEvent('lia-ready', { detail: result, bubbles: true }));
          if (this.hasAttribute('auto-ready')) requestAnimationFrame(() => ready());
        },
        (error) => {
          this.setAttribute('error', error?.code ?? 'failed');
          this.dispatchEvent(new CustomEvent('lia-error', { detail: error, bubbles: true }));
        },
      );
    }
  }

  const bottom = (button: BottomButton) =>
    class extends HTMLElement {
      static observedAttributes = BUTTON_ATTRIBUTES;
      private control: Control<BottomButtonOptions> | null = null;
      private options(): BottomButtonOptions {
        const options: BottomButtonOptions = {
          text: this.getAttribute('text') || undefined,
          color: this.getAttribute('color') || null,
          textColor: this.getAttribute('text-color') || null,
          isActive: !this.hasAttribute('disabled'),
          isProgressVisible: this.hasAttribute('progress'),
          hasShineEffect: this.hasAttribute('shine'),
          onClick: press(this),
        };
        const position = this.getAttribute('position');
        if (position) options.position = position as ButtonPosition;
        return options;
      }
      connectedCallback() {
        hidden(this);
        this.control = controlBottomButton(button, this.options());
      }
      attributeChangedCallback() {
        this.control?.update(this.options());
      }
      disconnectedCallback() {
        this.control?.dispose();
        this.control = null;
      }
    };

  const header = (button: typeof backButton) =>
    class extends HTMLElement {
      private control: Control<() => void> | null = null;
      connectedCallback() {
        hidden(this);
        this.control = controlHeaderButton(button, press(this));
      }
      disconnectedCallback() {
        this.control?.dispose();
        this.control = null;
      }
    };

  const hold = (take: () => () => void) =>
    class extends HTMLElement {
      private release: (() => void) | null = null;
      connectedCallback() {
        hidden(this);
        this.release = take();
      }
      disconnectedCallback() {
        this.release?.();
        this.release = null;
      }
    };

  // <lia-banner position="top">: a banner docked by Lia while it's on the page (Lia makes the page smaller to fit it).
  class LiaBanner extends HTMLElement {
    static observedAttributes = ['position'];
    private release: (() => void) | null = null;
    private take() {
      this.release?.();
      this.release = holdBanner(this.getAttribute('position') === 'top' ? 'top' : 'bottom');
    }
    connectedCallback() {
      hidden(this);
      this.take();
    }
    attributeChangedCallback() {
      if (this.release) this.take();
    }
    disconnectedCallback() {
      this.release?.();
      this.release = null;
    }
  }

  const classes: Record<(typeof ELEMENT_NAMES)[number], CustomElementConstructor> = {
    'lia-app': LiaApp,
    'lia-main-button': bottom(mainButton),
    'lia-secondary-button': bottom(secondaryButton),
    'lia-back-button': header(backButton),
    'lia-settings-button': header(settingsButton),
    'lia-closing-confirmation': hold(holdClosingConfirmation),
    'lia-swipe-lock': hold(holdVerticalSwipesOff),
    'lia-banner': LiaBanner,
  };
  for (const name of ELEMENT_NAMES) if (!registry.get(name)) registry.define(name, classes[name]);
}

export * from '@lia-labs/sdk';
