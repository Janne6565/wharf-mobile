<!-- AUTO-SYNCED from agents KB: technologies/REACT.md @ e2916b0.
     Do NOT edit here — edit the source in ~/projects/agents and re-run scripts/sync-conventions.sh. -->

# React Rules

## Component Structure

**DO:**
- Split every non-trivial component into a thin JSX file and a co-located logic hook (`use<ComponentName>Logic.ts`).
- Keep the JSX file focused purely on rendering. Move all state, effects, selectors, callbacks, and navigation into the logic hook.
- Keep `useTranslation()` (for `t()`) in the component file, not in the logic hook — unless the hook needs to set translated error messages directly.
- Target ~100 lines per file. If a component grows beyond this, extract sub-components or split the hook.
- Limit JSX nesting to 3 levels deep. Extract banners, headers, and repeated sections as named sub-components.

  ```tsx
  // useDashboardLogic.ts — all non-JSX logic
  export function useDashboardLogic() {
    const dispatch = useAppDispatch();
    const items = useAppSelector(selectItems);
    const handleCreate = useCallback(() => { ... }, [dispatch]);
    return { items, handleCreate };
  }

  // index.tsx — thin JSX only
  export function DashboardPage() {
    const { t } = useTranslation();
    const { items, handleCreate } = useDashboardLogic();
    return (
      <main>
        <h1>{t("dashboard.title")}</h1>
        <ItemList items={items} onCreateNew={handleCreate} />
      </main>
    );
  }
  ```

**DON'T:**
- Put `useEffect`, `useCallback`, `useMemo`, API calls, or Redux selectors directly in the JSX component body.
- Let a single component file grow beyond ~100 lines without splitting it.
- Nest JSX more than 3 levels deep without extracting a named component.

---

## File & Folder Naming

**DO:**
- Name component files in `PascalCase.tsx` (e.g. `UserMenu.tsx`, `SettingsPanel.tsx`).
- Name logic hook files in `camelCase.ts` matching their export (e.g. `useDashboardLogic.ts`).
- Give every component folder a barrel `index.ts` that re-exports its public API.
- Use `index.tsx` as the entry point for page-level components.
- Name test files `<filename>.test.ts(x)`, co-located with the file they test.

**DON'T:**
- Mix casing conventions within the same category (e.g. kebab-case component files).
- Export multiple unrelated components from a single file.

---

## Imports & Exports

**DO:**
- Use the `@/` path alias for all cross-directory imports (e.g. `import { useAppSelector } from "@/store/hooks"`).
- Use relative imports only within the same component folder.
- Use `import type { Foo }` for all type-only imports (required when `verbatimModuleSyntax` is enabled).
- Re-export public APIs through the folder's `index.ts` barrel.

**DON'T:**
- Use deep relative paths like `../../../store/hooks` — use the path alias instead.
- Import types without the `type` keyword when `verbatimModuleSyntax` is enabled.

---

## State Management

State is split across two libraries by concern:

- **Redux Toolkit** owns client/UI state and any cached shared data that many
  views read (e.g. session/auth, cart, player, language, toast, and a `dataSlice`
  cache read through a `useDataLoading` hook).
- **React Query** (`@tanstack/react-query`) owns *dynamic server interactions*:
  (a) **async mutations** (any create/update/delete/upload/sign-in API call),
  and (b) **dynamic reads that need their own loading indicator** (admin lists,
  moderation queues, per-page panels that fetch on demand).

**DO:**
- Use typed `useAppDispatch` and `useAppSelector` hooks from a central
  `src/store/hooks.ts` — never the raw react-redux versions.
- Define Redux slices with `createSlice`; use `PayloadAction<T>` in reducers and
  union string literals `"idle" | "loading" | "failed"` for async status.
- Route the shared cached data reads through `useDataLoading`.
- For every async **mutation**, use `useMutation` inside the component's logic
  hook. Expose `mutation.isPending` (and `mutation.variables` for per-row
  actions) so buttons can show a pending state. On success, `invalidateQueries`
  the affected query key instead of a manual refetch; surface failures in
  `onError`.
- For **on-demand reads**, use `useQuery` with a stable `queryKey`; expose
  `isLoading`/`isError` so the view can render a loading/failed branch.
- Provide the `QueryClient` in the app entry (inside the Redux `<Provider>`) and
  in the test wrapper utility so hooks using React Query work under test.
- Derive store types with `ReturnType<typeof store.getState>` and
  `AppDispatch = typeof store.dispatch`.

  ```ts
  // inside a logic hook
  const qc = useQueryClient();
  const listQuery = useQuery({ queryKey: ["orders"], queryFn: () => listOrders() });
  const remove = useMutation({
    mutationFn: (o: Order) => deleteOrder(o.id),
    onSuccess: () => { dispatch(showToast("Deleted")); void qc.invalidateQueries({ queryKey: ["orders"] }); },
    onError: () => dispatch(showToast("Delete failed")),
  });
  return { orders: listQuery.data ?? [], loading: listQuery.isLoading, deletingBusy: remove.isPending };
  ```

**DON'T:**
- Call API functions directly from JSX files, or fetch with bare
  `useState + useEffect` when the read needs a loading indicator — use `useQuery`.
- Hand-roll `busy`/`saving`/`placing` booleans for a request — derive them from
  `useMutation().isPending`.
- Use raw `useDispatch` or `useSelector` from react-redux — always use the typed
  wrappers.

---

## Loading States & Buttons

Every control that triggers an async request must give clear pending feedback:
the control disables and shows a spinner until the request settles.

**DO:**
- Render request-triggering buttons with a shared `<Button>` that takes a
  `loading` prop and pass `loading={mutation.isPending}`. It disables the button
  and renders an inline spinner while pending.
- For destructive confirms and shared editor/modal components, thread a
  `busy`/`saving` prop through to the same `<Button>`.
- For per-row/per-item actions, gate `loading` on the acted-on id (e.g.
  `loading={approvingId === row.id}`) using the mutation's `variables`, so only
  the clicked control spins.
- Give every `useQuery`-backed list/panel a visible `isLoading` branch
  (a loading label or skeleton) and an `isError` branch.

**DON'T:**
- Leave a raw `<button>` firing an async handler with no disabled/spinner state.
- Show an empty list while a fetch is in flight — render the loading branch.

---

## Disabled / Gated Buttons

A submit or primary-action button must be **disabled until the action is actually
possible**. An always-pressable button that only reveals, on click, that a required
field is empty is a dead end — gate it up front instead.

Gate on **completeness, not full validity**. Disable while a *required* input is
still missing — an empty text field, an unticked mandatory acknowledgement checkbox,
an unselected required option, or (for multi-step flows) a prerequisite step not yet
cleared. Do **not** disable for *format* errors (bad email shape, password too short,
password mismatch): let the user submit and surface those as validation messages, so
the reason for rejection is explicit rather than a silently-dead button.

Derive the gate in the logic hook and expose it as a boolean (`canSubmit`), keeping
the JSX thin:

```ts
// use<Page>Logic.ts — with react-hook-form + zod in `mode: "onSubmit"`
const email = form.watch("email");
const password = form.watch("password");
const understand = form.watch("understand");
// completeness only — zod still validates email/password *format* on submit
const canSubmit = email.trim().length > 0 && password.length > 0 && understand;
return { form, onSubmit, canSubmit, isSubmitting: mutation.isPending };
```

```tsx
// index.tsx
<Button type="submit" loading={isSubmitting} disabled={!canSubmit}>
  {t("signin.submit")}
</Button>
```

`disabled` and `loading` compose: the shared `<Button>` treats either as disabled, so
the button is unpressable while the form is incomplete *and* while the request is in
flight.

**DO:**
- Disable action buttons until every required field is filled / required checkbox is
  ticked / prerequisite step is done, via a `canSubmit`-style boolean from the hook.
- Keep the enable/disable derivation in the logic hook — not inline in the JSX.
- Still run format validation on submit and show the messages; don't fold format
  rules into the disable gate.

**DON'T:**
- Ship an always-pressable submit button whose only feedback is a post-click error
  that a field is empty.
- Disable the button on *format* errors — that hides why submit is blocked.
- Recompute the gate in the component body — derive it in the hook.

---

## Pure Utilities & `lib.ts`

**DO:**
- Extract pure functions, types, and constants that don't need React into a co-located `lib.ts`.
- Place all field validation functions in a single `src/lib/validators.ts` — never inline validation in components or hooks.
- Use named constants for all validation rules (min/max lengths, regex patterns).

  ```ts
  // src/lib/validators.ts
  export const USERNAME_MIN = 3;
  export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  export function isValidEmail(value: string): boolean { ... }
  ```

**DON'T:**
- Create `lib.ts` for trivial 1–2 line helpers that don't warrant their own file.
- Allow React imports inside `lib.ts` — keep it framework-agnostic.
- Duplicate validation logic across multiple components or hooks.

---

## Forms & Inputs

**DO:**
- Use a shared `<FormField>` component for all form inputs — never raw `<input>` + `<label>` pairs.
- Drive validation from `src/lib/validators.ts` functions.
- Display validation errors via the `FormField` component's error prop.

**DON'T:**
- Inline validation logic inside form components.
- Use raw HTML form elements without the shared wrapper.

---

## Styling

**DO:**
- Use Tailwind utility classes as the primary styling approach.
- Use the `cn()` helper (clsx + tailwind-merge) for conditional or merged class names.
- Use named design tokens defined as Tailwind utilities (e.g. `bg-background`, `text-foreground`, `rounded-radius-sm`).
- Restrict `style={{}}` to values Tailwind cannot express: gradients, `textShadow`, dynamic runtime values, fractional `gridTemplateColumns`.

  ```tsx
  import { cn } from "@/lib/utils";

  <div className={cn("rounded-radius border-foreground", isActive && "bg-accent")} />
  ```

**DON'T:**
- Use `[var(--x)]` arbitrary CSS variable syntax — always use the named token class.
- Write inline styles for values that Tailwind can express with a utility class.

---

## Icons

Use **`lucide-react`** icon components for every UI icon — arrows, checks,
crosses, chevrons, spinners, close/menu affordances, etc. Never render an
ASCII/UTF glyph (`←`, `→`, `↑`, `↓`, `✓`, `✗`, `▸`, `×`, …) as an icon: they
render inconsistently across platforms/fonts, don't scale with `size`, and
can't be recoloured cleanly.

**DO:**
- Import the specific icon: `import { ArrowLeft, Check, X } from "lucide-react"`.
- Size with the `size` prop (px) and control weight with `strokeWidth`; colour
  via `text-*` tokens on the icon (or a wrapper), never a hardcoded hex.
- Mark decorative icons `aria-hidden` and keep the adjacent text label as the
  accessible name (e.g. a "back" link is `<ArrowLeft aria-hidden /> back`).
- Keep the icon glyph out of i18n strings — the translation is the word only
  (`back`, not `← back`); the icon is rendered by the component.

**DON'T:**
- Hand-roll an arrow/check with a text glyph, an SVG literal, or a CSS
  triangle when a Lucide icon exists.
- Bake an icon character into a translation resource or a shared constant.

**Deliberate exceptions (not icons):** brand marks (e.g. a logo glyph),
faithful **terminal/TUI simulations** where ASCII is the point (a mock prompt,
a `▸` selection caret in a rendered "terminal"), placeholder masks
(`····-····`), and ordinary prose punctuation (a `·` separator, an in-sentence
`→`). These stay as text.

---

## TypeScript

**DO:**
- Enable strict mode. Treat all `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` violations as errors.
- Define component props as `interface FooProps` with `readonly` on all fields.
- Prefix floating promises with `void`: `void navigate(...)`, `void (async () => { ... })()`.
- Use `globalThis` instead of `window` for browser globals.
- Use `as const` on static lookup objects to get literal types.

**DON'T:**
- Use `any` — use `unknown` and narrow the type explicitly.
- Suppress TypeScript errors with `// @ts-ignore` without a documented reason.
- Use non-null assertion (`!`) without a comment explaining why it is safe.

---

## Routing

**DO:**
- Define one route file per route in `src/routes/`.
- Use route-level `beforeLoad` guards (e.g. `requireFullAuth()`) for access control.
- Let the router plugin auto-generate the route tree — never edit the generated file manually.

**DON'T:**
- Implement access control inside page components — do it in `beforeLoad`.
- Manually edit auto-generated route tree files.

---

## Internationalisation (i18n)

Reference implementation: `cosy-domain-provider-frontend/src/i18n/` (`resources.ts`,
`config.ts`, `i18next.d.ts`). Translations are plain TypeScript objects — **no JSON
files** — so every key is compile-time checked and missing/mistyped keys fail the
build.

**Structure — one `resources.ts` per app:**
- Write the base language (`en`) as a single object literal ending in `as const`
  (e.g. `const enCommon = { ... } as const`). This object is the source of truth
  for the key shape.
- Derive a schema type from it and type every other language against that schema, so
  a translator cannot omit, add, or mistype a key:

  ```ts
  // src/i18n/resources.ts
  const enCommon = {
    login: { title: "Welcome back", submit: "Log in" },
    verify: { inputDescription: "We sent a code to {{email}}." },
  } as const;

  // maps every leaf to `string` while preserving the nested shape
  type DeepStringSchema<T> = {
    [K in keyof T]: T[K] extends string ? string : DeepStringSchema<T[K]>;
  };
  type CommonSchema = DeepStringSchema<typeof enCommon>;

  const deCommon: CommonSchema = { login: { title: "Willkommen zurück", submit: "Anmelden" },
    verify: { inputDescription: "Wir haben einen Code an {{email}} gesendet." } };

  export const defaultNS = "common";
  export const resources = { en: { common: enCommon }, de: { common: deCommon } } as const;
  export type AppLanguage = keyof typeof resources;
  ```

**Type-safe `t()` — augment the i18next module:**
- Add `src/i18n/i18next.d.ts` so `t("key")` autocompletes and rejects unknown keys:

  ```ts
  import "i18next";
  import { defaultNS, resources } from "@/i18n/resources";
  declare module "i18next" {
    interface CustomTypeOptions {
      defaultNS: typeof defaultNS;
      resources: (typeof resources)["en"];
    }
  }
  ```

**Init & language persistence (`config.ts`):**
- Initialise once with `i18n.use(initReactI18next).init({ resources, defaultNS,
  fallbackLng: "en", interpolation: { escapeValue: false } })`.
- Persist the choice in `localStorage` under a stable, app-prefixed key
  (e.g. `"cosy-language"`); read it back through `globalThis` guards for SSR/test
  safety and validate it against `resources` before use, falling back to `"en"`.
- Expose a small `useLanguageChange` hook for switching + persisting the language.

**DO:**
- Read every UI string through `t("dot.path.key")` — never a bare string literal.
- Add each new key to `enCommon` first (the schema), then to every other language
  in the **same commit** — a missing key is a type error, not a runtime surprise.
- Use i18next interpolation (`{{email}}`, `{{count}}`) for dynamic values rather
  than string concatenation.
- Keep an `src/i18n/resources.test.ts` asserting all languages share the same key
  set, and a `config.test.ts` for the init/persistence logic.

**DON'T:**
- Add JSON translation files or fetch translations over HTTP — keep them in typed TS.
- Add a key to one language object without adding it to all others (it won't compile).
- Put `useTranslation()` in a logic hook — keep `t()` in the component file (see
  Component Structure), unless the hook must produce translated error strings itself.

---

## Testing

**DO:**
- Co-locate test files with the files they test, named `<filename>.test.ts(x)`.
  **Exception (expo-router):** never place test files inside the route directory
  (`app/`) — the typed-routes generator scans `app/` in Node *without* Metro's
  blockList, and a co-located `_layout.test.tsx` is misread as a group layout,
  silently collapsing that group's routes out of `.expo/types/router.d.ts`
  (typecheck then fails on every `/(group)/...` path). Put route-screen tests in
  `src/` next to the feature they exercise (e.g. `src/features/hosts/
  HostsScreen.test.tsx` importing the screen from `app/` relatively).
- Use `renderHook()` from `@testing-library/react` for testing logic hooks.
- Wrap Redux-connected hooks with a store provider utility (e.g. `makeWrapper(preloadedState)`).
- Use `vi.mock(...)` for module mocking and `vi.fn()` / `vi.mocked()` for mock functions.
- Call `vi.clearAllMocks()` in `beforeEach` to ensure test isolation.
- Add `data-testid` attributes to interactive elements for E2E test selectors.
- Test Redux slice reducers as pure unit tests — no React needed.

**DON'T:**
- Test implementation details — test observable behaviour.
- Skip testing error paths and boundary conditions.
- Use `data-testid` as a substitute for semantic HTML attributes where they exist.

---

## API Generation with Orval

Orval reads an OpenAPI spec from the running backend and generates a fully-typed TypeScript client into `src/api/generated/`. The generated output includes one function per endpoint and a matching set of request/response types in `src/api/generated/model/`.

A shared `customInstance` function (defined in `src/api/axios-instance.ts`) is injected into every generated call, so authentication headers, base URL, and error handling are configured once and applied automatically.

**DO:**
- Run `bun gen:api` (with the backend running) to fetch the latest OpenAPI spec and regenerate the client.
- Treat `src/api/generated/` as a build artefact — commit the output so the build never depends on a running backend in CI.
- Use the generated functions through the data layer — `useDataLoading` for the shared cache, or a `useQuery`/`useMutation` inside a logic hook — never call them directly from JSX components.
- For endpoints not covered by the OpenAPI spec, add manual API calls in a separate file (e.g. `src/api/billing-api.ts`) using the same `customInstance`.

**DON'T:**
- Edit any file inside `src/api/generated/` manually — changes will be overwritten on the next generation run.
- Duplicate API call logic that already exists in the generated client.

---

## Code Generation (Routes)

**DO:**
- Regenerate the route tree by running the dev server after adding or renaming route files.

**DON'T:**
- Edit `src/routeTree.gen.ts` manually — it is auto-generated by the router plugin.
