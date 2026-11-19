# __APP_NAME__

A clean __FRAMEWORK__ app with `__BINDING__` installed and initialized. The opening page displays your app name; theme and safe areas follow Lia.

## Start building

```sh
npm install
npm run dev
```

Use your chosen package manager instead of npm if applicable. Edit the main component in `src/` to replace the welcome page. The app name and public app ID (`__APP_ID__`) are in `src/config.ts`. `src/starter.ts` contains connection feedback and the documentation link; `src/styles.css` contains the page styles.

The local browser preview uses a simulated SDK, enabled only in development. Production builds exclude the mock. Test hardware features and permissions inside Lia.

## Preview inside Lia

Register the app through the CLI or https://developers.lialabs.org, then run:

```sh
npx @lia-labs/create-app@latest dev
```

Approve local preview access if asked, then open your app in Lia under **Apps → Testing**. Edits appear live while the command runs. Add permanent HTTPS hosting before submitting for review. You can add up to five other testers, archive your app, or delete it if it has never been live.

For a feature catalogue with runnable examples, generate another project with `--template demo`.

## Server-side features

Never place app server keys or webhook secrets in client code. When adding purchases or rewards, verify the session and the transaction on your server and fulfill each purchase only once. Local simulation is not proof of real payment.

- Quickstart: https://docs.lialabs.org/quickstart
- SDK packages: https://docs.lialabs.org/packages
- Verification: https://docs.lialabs.org/guides/verify-on-your-server

MIT licensed.

## Languages

The page follows the language selected in Lia. Browser previews detect the browser language; use `?lang=ar` (or another supported language code) to preview a translation. English is the fallback. Arabic uses right-to-left layout. All 13 Lia languages are included in `src/i18n.ts`. Extend its catalogue when you add your own UI. Code examples, app names and API response data are kept unchanged.
