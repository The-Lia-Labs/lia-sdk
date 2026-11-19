# @lia-labs/elements

The Lia SDK as custom elements, for any page and any framework.

```sh
npm install @lia-labs/elements
```

```html
<script src="https://unpkg.com/@lia-labs/elements/dist/auto.global.js"></script>

<lia-app auto-ready></lia-app>
<lia-main-button text="Buy for 5 LIA"></lia-main-button>
<lia-back-button></lia-back-button>

<script>
  document.querySelector('lia-main-button').addEventListener('lia-click', () => liaElements.pay('extra-lives'));
</script>
```

With a bundler: `import { defineLiaElements } from '@lia-labs/elements'; defineLiaElements();`


Full guide: https://docs.lialabs.org/packages/elements
