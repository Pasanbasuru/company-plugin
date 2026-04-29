---
name: frontend-implementation-guard
description: Use when writing or reviewing React components, hooks, component-level state, or data-fetching at the component layer. Do NOT use for Next.js routing/rendering structure (use `nextjs-app-structure-guard`), accessibility (use `accessibility-guard`), or bundle/runtime perf (use `performance-budget-guard`). Covers component structure, state placement, data flow, hook discipline, composition.
allowed-tools: Read, Grep, Glob, Bash
---

# Frontend implementation guard

## Purpose & scope

Keep the React layer clean: components are focused, state lives at the right level, hooks follow the rules, and composition beats inheritance of concerns. This skill applies whenever you write or review React components, custom hooks, component-level state, or client-side data-fetching.

## Core rules

1. **A component does one thing. Split when it exceeds ~150 lines or handles unrelated concerns.** — *Why:* a component that mixes data-fetching, business logic, and layout is hard to test, reuse, and comprehend in isolation; focused components compose cleanly.
2. **Business logic lives in hooks or services, not in JSX render bodies.** — *Why:* logic inline in JSX cannot be unit-tested without mounting the component; extracting it into a hook or function makes it testable in isolation and reusable by other components.
3. **State lives at the lowest common ancestor (LCA) that needs it. Lifted further only for a concrete reason.** — *Why:* unnecessary state elevation creates implicit coupling and causes components that do not consume the state to re-render when it changes.
4. **Server state (data from the API) is owned by TanStack Query, not by `useState` or Context.** — *Why:* TanStack Query provides caching, background refetching, deduplication, and stale-while-revalidate semantics that are fragile and verbose to replicate by hand.
5. **Context is for truly app-wide, low-churn values (theme, auth token). Not for frequently-updated data.** — *Why:* every consumer of a Context re-renders when its value changes; putting high-frequency state in Context (e.g., a search query, a form field) causes whole-tree thrashing.
6. **Hook rules are enforced with `eslint-plugin-react-hooks`; warnings block merge.** — *Why:* hooks called conditionally or inside loops produce subtle, hard-to-reproduce bugs in React's reconciler — the linter catches them before they reach production.
7. **Prop shapes are typed; no `...props: any`. Prefer discriminated props over boolean flags when a component renders differently per variant.** — *Why:* parallel boolean props (`isLoading`, `isError`, `isEmpty`) allow impossible combinations; a discriminated `status` prop makes invalid states unrepresentable at the type level.

## Red flags

| Thought | Reality |
|---|---|
| "I'll use Context for this list that updates every keystroke" | Every consumer re-renders on each update. Use local state or a specialized store. |
| "useEffect to sync server state into useState" | TanStack Query owns that. Delete the effect and the state; replace with `useQuery`. |
| "Boolean flag for the 'error' variant AND the 'loading' variant" | Parallel booleans allow `isLoading && isError` — a state that should not exist. Use a discriminated union. |

## Good vs bad

### TanStack Query for server state vs `useEffect` + `useState`

Bad:
```tsx
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchUser(userId)
      .then(setUser)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (error)   return <Alert message={error} />;
  return <div>{user?.name}</div>;
}
// No caching. Races possible (old response arriving after a newer one).
// Loading/error state manually juggled. Re-fetching on focus? Manual.
```

Good:
```tsx
import { useQuery } from '@tanstack/react-query';

function UserProfile({ userId }: { userId: string }) {
  const { data: user, isPending, isError, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 60_000,
  });

  if (isPending) return <Spinner />;
  if (isError)   return <Alert message={error.message} />;
  return <div>{user.name}</div>;
}
// Cached, deduplicated, background-refreshed. No manual cleanup.
// Race conditions handled by TanStack Query's cancel-on-unmount semantics.
```

### Discriminated variant prop vs parallel booleans

Bad:
```tsx
interface ButtonProps {
  isLoading?: boolean;
  isDisabled?: boolean;
  isDestructive?: boolean;
  label: string;
}

function Button({ isLoading, isDisabled, isDestructive, label }: ButtonProps) {
  // What does isLoading && isDestructive mean? Undefined territory.
  const cls = isDestructive ? 'btn-danger' : 'btn-primary';
  return (
    <button disabled={isLoading || isDisabled} className={cls}>
      {isLoading ? <Spinner /> : label}
    </button>
  );
}
```

Good:
```tsx
type ButtonVariant = 'primary' | 'destructive';

type ButtonProps =
  | { status: 'idle';    variant: ButtonVariant; label: string; onClick: () => void }
  | { status: 'loading'; variant: ButtonVariant; label: string }
  | { status: 'disabled'; variant: ButtonVariant; label: string };

function Button(props: ButtonProps) {
  const cls = props.variant === 'destructive' ? 'btn-danger' : 'btn-primary';
  return (
    <button
      disabled={props.status !== 'idle'}
      className={cls}
      onClick={props.status === 'idle' ? props.onClick : undefined}
    >
      {props.status === 'loading' ? <Spinner /> : props.label}
    </button>
  );
}
// Compiler rejects { status: 'idle' } without onClick.
// No invalid combinations.
```

### State at LCA vs global Context misuse

Bad:
```tsx
// contexts/SearchContext.tsx
const SearchContext = createContext('');
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('');
  return (
    <SearchContext.Provider value={query}>
      {/* Every consumer re-renders on each keystroke */}
      {children}
    </SearchContext.Provider>
  );
}

// Used in app root — the entire tree is now coupled to keystrokes
export default function RootLayout({ children }) {
  return <SearchProvider>{children}</SearchProvider>;
}
```

Good:
```tsx
// The search query only affects SearchBar and ResultsList.
// Keep it in the shared parent — the nearest common ancestor.
function SearchSection() {
  const [query, setQuery] = useState('');
  return (
    <>
      <SearchBar query={query} onChange={setQuery} />
      <ResultsList query={query} />
    </>
  );
}
// Only SearchBar and ResultsList re-render on keystroke.
// Everything else in the tree is untouched.
```

## Component decomposition heuristics

A component has grown too large when it satisfies any of these conditions: the file exceeds roughly 150 lines, the component has more than four `useState` calls, it fetches data AND manages layout AND handles user events, or reading it requires scrolling past multiple unrelated concerns.

When deciding how to split, follow the single-responsibility principle at the UI layer. A component should answer one of these questions: "what does this data look like?" (presentational), "where does this data come from?" (container/data), or "how does this interaction work?" (controlled widget).

Prefer composition over prop drilling for deeply nested variants. If a parent passes more than three props through an intermediate component that does not itself consume those props, the intermediate is just a conduit — consider either colocating the consumer with its data source or using a well-scoped render prop / children pattern.

Name components after what they represent, not how they are implemented. `<UserCard>` communicates intent; `<BoxWithAvatarAndTextOnTheRight>` communicates layout.

## State placement

The decision tree for where to place state is straightforward: start at the component that directly uses the state. If a sibling also needs it, lift to their nearest common ancestor. Stop lifting there. Only lift higher if a genuinely unrelated subtree in a different branch of the component tree also requires access — and even then, ask whether a URL parameter, a custom hook with a stable reference, or a lightweight store is a better fit than lifting further.

Derived state is not state. If a value can be computed from existing state or props synchronously, compute it in the render body rather than caching it in `useState`. A `fullName` derived from `firstName` and `lastName` should be `const fullName = \`${firstName} ${lastName}\`` — not a separate `useState` that is kept in sync with an effect. Use `useMemo` only when the derivation is genuinely expensive (benchmarked, not assumed) and the component re-renders frequently.

Form state has its own rules. Uncontrolled inputs via `useRef` are appropriate for simple, infrequent reads (e.g., a search box read on submit). Controlled inputs via `useState` are appropriate when the UI reacts live to the value (e.g., character count, inline validation). For complex, multi-field forms with cross-field validation and submission state, use a form library (React Hook Form is the canonical choice) rather than building that machinery yourself.

## Server state vs client state

Server state lives on a remote server (user profiles, configs, etc.) — has source-of-truth elsewhere. Client state lives in the browser session — the source-of-truth IS the local state.

Server state belongs to TanStack Query (v5). Do not reach for `useState` + `useEffect` to fetch, cache, or synchronise remote data. `useQuery` handles the full lifecycle — loading, success, error, background refresh, deduplication of concurrent requests for the same key, and automatic retry on network error. `useMutation` handles writes with optimistic updates and cache invalidation via `queryClient.invalidateQueries`. The query key is the cache key: be intentional about its shape. A query for a specific resource should include all variables that affect the response in the key array (e.g., `['orders', { userId, status }]`).

Do not use TanStack Query for client state. A modal's open/close, a multi-step wizard's current step, and a filter panel's expanded/collapsed state are not server state — they belong in `useState` or a small local state machine.

When a mutation changes data covered by an existing query, invalidate that query immediately after the mutation succeeds:

```tsx
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (input: UpdateUserInput) => updateUser(input),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['user', userId] });
  },
});
```

For optimistic updates (the UI reflects the change before the server confirms), use `onMutate` to snapshot and update the cache, `onError` to roll back, and `onSettled` to refetch.

## Context: when it's right

React Context is the right tool for values that are: (1) genuinely needed by many components at different nesting levels, (2) change infrequently relative to render frequency, and (3) not server state. Canonical examples: the authenticated user object read after login, the active theme/color scheme, the i18n locale, and feature flags that change on deployment rather than on user interaction.

A well-structured Context module has three parts: the type of the value, the context itself with a sensible default, and a custom hook that wraps `useContext` and throws a descriptive error when used outside the provider. This prevents the silent `undefined` that results from forgetting to add the provider:

```tsx
interface AuthContextValue {
  user: User;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(/* ... */);
  const signOut = useCallback(() => { /* ... */ }, []);
  return (
    <AuthContext.Provider value={{ user, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

Split contexts by concern rather than bundling everything into one `AppContext`. A single monolithic context object means any update to any field — even one irrelevant to a given consumer — triggers a re-render. Separate `AuthContext`, `ThemeContext`, and `FeatureFlagContext`.

## Hook rules and custom hook design

The two hook rules are invariants, not guidelines: only call hooks at the top level of a React function (never inside conditions, loops, or nested functions), and only call hooks from React functions or custom hooks (never from plain utilities). `eslint-plugin-react-hooks` enforces both.

Custom hooks are the primary mechanism for extracting stateful logic out of components. A custom hook is appropriate when the same combination of `useState`, `useEffect`, `useCallback`, or `useRef` appears in more than one component, or when the logic is complex enough that it obscures the component's rendering intent. Prefix custom hooks with `use`.

Design custom hooks around behaviours, not data shapes. `useFormSubmit`, `useIntersectionObserver`, and `useLocalStorage` are behaviour-first names. `useUserData` that simply re-exports a `useQuery` call adds a layer without adding meaning — prefer calling `useQuery` directly with a well-named query function.

Keep effects focused. An effect that does multiple unrelated things should be two separate effects. Each effect should have a clear purpose readable from its code alone. Cleanup functions are mandatory whenever the effect sets up a subscription, a timer, or an event listener — missing cleanup causes memory leaks and stale-closure bugs on component unmount and re-render.

`useCallback` and `useMemo` are optimisation tools, not default tools. Wrap a function in `useCallback` when it is passed as a prop to a memoised child component or when it is listed as a dependency of another hook. Wrap a computation in `useMemo` when it is measurably expensive and the component re-renders frequently. Do not wrap everything by default — the wrapper has overhead.

## Interactions with other skills

- **Owns:** React component structure, state placement, client data flow, hook discipline, composition patterns.
- **Hands off to:** `nextjs-app-structure-guard` for server/client boundary decisions; `accessibility-guard` for a11y; `performance-budget-guard` for memoization decisions and bundle impact; `state-integrity-check` for cache invalidation correctness; `typescript-rigor` for prop typing and discriminated unions at the type-system level.
- **Does not duplicate:** any rendering-strategy concerns (RSC vs client) or accessibility requirements.

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: GREEN / YELLOW / RED.
2. **Findings** — per issue: *File:line, severity (blocking | concern | info), category, what's wrong, recommended fix*. Flag every component over 150 lines, every `useEffect` that fetches or syncs server data, and every Context used for high-frequency state with exact file:line.
3. **Safer alternative** — if an anti-pattern is widespread (e.g., `useEffect`+`useState` for data fetching throughout the codebase), prescribe the migration path for the whole codebase, not just the single file.
4. **Checklist coverage** — for each rule below, mark PASS / CONCERN / NOT APPLICABLE:
   - Rule 1: Components are focused; none exceed ~150 lines or mix unrelated concerns.
   - Rule 2: Business logic is in hooks or services, not inline in JSX.
   - Rule 3: State is at the lowest common ancestor; no unnecessary lifting.
   - Rule 4: Server state is owned by TanStack Query; no `useEffect`+`useState` for API data.
   - Rule 5: Context is low-churn and app-wide; not used for frequently-updated data.
   - Rule 6: `eslint-plugin-react-hooks` is enabled; no suppressed warnings.
   - Rule 7: Prop shapes are typed; discriminated unions used for variant components.
