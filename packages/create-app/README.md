# Create a Lia app

```sh
npm create @lia-labs/app@latest
```

Lia Developer Studio uses responsive framework cards, a staged setup, inline validation and compact progress. Set `NO_COLOR=1`, `LIA_NO_MOTION=1` or `ACCESSIBLE=1` for your terminal preferences. Choose a directory, framework and starter or SDK playground, then accept **Recommended** settings to preview locally and install with your detected package manager. Choose **Customize** to edit the public app ID, package manager, local simulation and installation preference. Install progress stays compact; failures show the reason and commands to retry. Ctrl+C cancels setup cleanly.

It supports plain TypeScript, React, Preact, Vue, Svelte, Solid, Angular, web components and the low-level bridge. Server keys belong in your backend; setup only accepts a public app ID.

```sh
npm create @lia-labs/app@latest my-game -- --framework react --template demo
pnpm create @lia-labs/app my-game --framework vue --template demo
yarn create @lia-labs/app my-game --framework svelte
bun create @lia-labs/app my-game --framework solid
```

For CI, use `--yes --no-install` (or `--install`) and the options printed by `--help`. Existing nonempty directories and symlink destinations are rejected; files are never overwritten. Dependencies are installed only after your selection, using an allowlisted package manager without interpolating project input into a shell command.

Framework projects use their own hooks, composables, stores or signals for initialization, player identity, language and native controls. Demo templates include typed feature examples with source code, loading states, cancellation and unsupported-device feedback. The advanced bridge template demonstrates the typed raw protocol; web components include `<lia-app>` and `<lia-main-button>`.

Local development uses `mockLia()` only outside Lia. Production builds remove the simulation (Angular uses a production file replacement). Permissions, hardware, real session verification and server-side delivery must be tested in Lia. Client examples do not grant balances or deliver purchases. Valuable operations require server verification and durable duplicate protection.

Choose **Connect & register** after setup to sign in through your browser and create a private test listing automatically. Compare the code in your terminal before approving. Hosting can be configured later; until then the listing opens a setup placeholder. Keep building locally with `--local`.

```sh
npx @lia-labs/create-app@latest login
npx @lia-labs/create-app@latest whoami
npx @lia-labs/create-app@latest apps
# Inside a generated project:
npx @lia-labs/create-app@latest register --name "My game" --kind game
npx @lia-labs/create-app@latest logout
```

Use `--register` during creation to connect immediately, and `--url https://your-app.example` if hosting is ready. Reusing an app ID you own links the project without editing the listing. Registration stores only public metadata in `lia.config.json`. Credentials are private files outside your project, scoped to the API origin, and expire after 30 days. Revoke them from **Connected terminals** in the developer dashboard. Terminal access only lists apps and creates test listings; it cannot publish, read server keys or make payouts. `login --no-browser` prints the approval link without opening it. Browser requests expire in 10 minutes.

Manage your listing at https://developers.lialabs.org. Test apps appear under **Apps → Testing** for you and your selected testers. Publication requires review. Open developer access is planned for Q1 2027.

Use a supported Node LTS version (Node 22.12+ or 24+ recommended). The CLI pins compatible SDK package versions and framework majors; Preact 10 and Solid 1 match the current Lia bindings. Angular uses its standalone application builder and TypeScript 5.9. The other projects use Vite.

Documentation: https://docs.lialabs.org/packages/starters
