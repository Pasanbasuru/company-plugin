---
name: mobile-implementation-guard
description: Use when writing or reviewing React Native + Expo mobile code — screens, navigation, native module usage, OTA updates. Do NOT use for web React (use `frontend-implementation-guard`). Covers RN/Expo structure, navigation patterns, native module boundaries, EAS Build / EAS Update, platform-specific behaviour, offline UX.
---

# mobile-implementation-guard

**Purpose:** Keep the mobile app's structure predictable, native boundaries thin, and updates safe on both stores.

## Assumes `baseline-standards`. Adds:

React Native and Expo-specific implementation guards — managed vs bare workflow discipline, centralised navigation architecture, native module adapter pattern, offline UX requirements, and EAS Build/Update safety constraints.

---

## Core rules

1. **Use Expo managed workflow unless a specific native feature requires bare; document the reason if bare.**
   *Why:* Managed workflow gives free OTA updates, predictable SDK upgrades, and no Xcode/Android Studio maintenance. Dropping to bare for a feature that could be handled by an Expo SDK package adds permanent maintenance burden and breaks OTA for native-touching changes.

2. **Navigation (React Navigation v7) lives in a dedicated layer. Screens do not import each other directly — deep links and nav params only.**
   *Why:* Direct screen imports create circular dependency risks, make deep linking impossible without refactoring, and couple unrelated feature modules. A centralised navigator tree keeps every route auditable in one place.

3. **Native modules are wrapped by a single TypeScript adapter per module. Screens never call native APIs directly.**
   *Why:* Adapters are the only place where `import { NativeModules } from 'react-native'` or third-party native SDKs appear. This isolates platform surface area, enables mocking in tests, and means a native SDK swap touches one file not thirty screens.

4. **Platform-specific branches (`Platform.select`, `Platform.OS`) are rare and centralised in adapters, not scattered in screens.**
   *Why:* Unconstrained `Platform.OS` checks in UI components fork the mental model of every screen into two parallel versions. Centralising them in adapters and style utilities keeps screen code platform-agnostic and readable.

5. **Offline UX: every screen has a defined offline state — cached data shown, writes queued, a clear error message when neither is possible.**
   *Why:* Mobile networks are unreliable. Silently failing or showing a blank screen erodes trust quickly. TanStack Query offline persistence (MMKV or AsyncStorage persister) handles read-side caching; a write queue with optimistic updates and reconciliation on reconnect handles mutations.

6. **EAS Updates (OTA) respect store policy — JS-only changes only; any native code change requires a new EAS Build and store submission.**
   *Why:* Pushing a native change via OTA violates Apple App Store and Google Play policies and will cause runtime crashes on devices that received the update but have the old binary. EAS Update should be gated by a runtime-version check that blocks incompatible updates.

7. **Permissions prompts are requested at the moment of use, not on app start, and the UI explains why before the OS dialog appears.**
   *Why:* iOS and Android users are far more likely to grant a permission when they understand the immediate context. An upfront multi-permission splash on first launch maximises denial rates and cannot be undone without the user going to Settings manually.

---

## Red flags

| Signal | Risk |
|---|---|
| Screen component imports another screen component | Nav graph collapses; deep linking breaks; circular deps likely |
| `Platform.OS` checks inside JSX of a screen | Codebase silently forks; both paths need QA on every change |
| OTA update that touches a native module or `app.json` native config | Store policy violation; runtime crash on mismatched runtime version |

---

## Good vs Bad

### Single native adapter module vs screens calling native APIs directly

**Bad — camera called from two screens independently:**
```typescript
// screens/ProfileScreen.tsx
import * as ImagePicker from 'expo-image-picker';
const result = await ImagePicker.launchCameraAsync({ ... });

// screens/PostScreen.tsx
import * as ImagePicker from 'expo-image-picker';
const result = await ImagePicker.launchCameraAsync({ allowsEditing: true });
```

**Good — single adapter, screens import the adapter:**
```typescript
// adapters/cameraAdapter.ts
import * as ImagePicker from 'expo-image-picker';

export async function capturePhoto(options?: ImagePicker.ImagePickerOptions) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('camera-denied');
  return ImagePicker.launchCameraAsync({ quality: 0.8, ...options });
}

// screens/ProfileScreen.tsx
import { capturePhoto } from '@/adapters/cameraAdapter';
const result = await capturePhoto();
```

The adapter owns the permission request, default quality settings, and the single import of `expo-image-picker`. Swapping to a different image picker library touches one file.

---

### Just-in-time permission prompt with explanation vs on-startup prompt

**Bad — request on mount, no context:**
```typescript
useEffect(() => {
  Notifications.requestPermissionsAsync(); // cold launch, no explanation
}, []);
```

**Good — request when the user triggers the feature, preceded by an explanation sheet:**
```typescript
async function enablePushNotifications() {
  // Show your own explanation modal first
  const confirmed = await showPermissionRationale({
    title: 'Stay updated on your orders',
    body: 'We send a notification when your order ships.',
  });
  if (!confirmed) return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    // Guide user to Settings; do not re-prompt
    await Linking.openSettings();
  }
}
```

iOS never shows the OS dialog a second time if the user previously denied. The in-app rationale sheet is the only chance to set context before that permanent decision.

---

### Offline write queue reconciled on reconnect vs no offline UX

**Bad — mutation fires immediately, fails silently offline:**
```typescript
const { mutate } = useMutation({ mutationFn: api.submitForm });
// If offline: unhandled network error, data lost
submitButton.onPress(() => mutate(formData));
```

**Good — TanStack Query with offline mutation queue:**
```typescript
// query-client.ts
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      networkMode: 'offlineFirst', // queue when offline, replay on reconnect
    },
  },
});

// In screen — optimistic update + queue
const { mutate, isPaused } = useMutation({
  mutationFn: api.submitForm,
  onMutate: async (variables) => {
    // optimistic local update
    queryClient.setQueryData(['draft'], variables);
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(['draft'], context?.previous);
  },
});

// UI communicates queued state
{isPaused && <OfflineBanner message="Will submit when back online" />}
```

---

## Expo managed vs bare

Expo managed workflow is the default choice. The SDK (53+) bundles camera, notifications, location, secure store, and file system modules that cover the vast majority of production use cases without ejecting. The workflow enables OTA updates for all JS/TS and asset changes, and the `app.json` / `app.config.ts` surface is the only native configuration file you need to touch.

Bare workflow is justified when the app requires a native SDK that has no Expo module equivalent, when a custom Gradle/Xcode build phase is mandatory, or when the team already owns iOS/Android engineers who maintain the native layer. When bare is chosen, the decision must be documented in `ARCHITECTURE.md` with the specific justification. All other guidance in this skill still applies; the adapter pattern becomes more important, not less, because the native surface is now larger and riskier.

Continuous Native Generation (CNG) — where `android/` and `ios/` directories are generated from config plugins and deleted from version control — is the recommended approach for new bare projects. It keeps native directories reproducible and makes Expo SDK upgrades low-friction.

---

## Navigation architecture

React Navigation v7 is the standard. The navigator tree lives in `src/navigation/` and is the only place where `<Stack.Navigator>`, `<Tab.Navigator>`, and `<Drawer.Navigator>` appear. Screens are registered by name and receive typed params via the `RootStackParamList` type exported from `src/navigation/types.ts`.

Never import a screen component from another screen. Cross-screen transitions go through `navigation.navigate('ScreenName', params)` or `navigation.push(...)`. This is not a style rule — it is what makes deep links, notification tap handlers, and universal links work without rewriting the navigation layer.

Typed navigation hooks (`useNavigation<StackNavigationProp<RootStackParamList>>()`) catch param mismatches at compile time. Every route that accepts params must have its type in `RootStackParamList`.

Modals and bottom sheets that are not full screens should not be registered as stack routes unless they need a URL. Use a local state flag or a lightweight modal manager instead.

For tab-level deep links (e.g., a push notification that opens a specific tab and then pushes a screen), use `NavigationContainerRef` combined with `navigation.navigate` from outside the component tree, not `Linking.openURL` with a custom scheme unless universal links are also set up.

---

## Native module adapter pattern

Every third-party native SDK and every `react-native` core module that crosses into native land gets a TypeScript adapter file in `src/adapters/`. The adapter file:

- Is the **only** file that imports the native module directly.
- Exports plain async functions or typed event emitters — no React hooks, no component code.
- Declares a mock in `src/adapters/__mocks__/` so unit tests never hit native code.
- Handles permissions where the native module requires them (camera, location, notifications).

This pattern means that if `expo-camera` is replaced with `react-native-vision-camera`, the change is entirely contained to `src/adapters/cameraAdapter.ts`. Screens, tests, and the rest of the codebase are unaffected.

`Platform.select` may appear inside adapters when the native API behaves differently per platform (e.g., Android requires `WRITE_EXTERNAL_STORAGE` for certain operations; iOS does not). It should not appear in the adapter's exported interface — callers receive a unified API.

---

## Platform-specific behaviour (iOS/Android)

Use `Platform.select({ ios: ..., android: ... })` inside adapters and style utilities. Never use it directly in JSX screen components.

For styles, centralise platform variants in a `platformStyles.ts` utility:

```typescript
import { Platform, StyleSheet } from 'react-native';

export const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  android: { elevation: 4 },
});
```

For permissions, the native manifest entries must match code requests:
- **iOS:** `Info.plist` keys (`NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, etc.) must be set via Expo config plugin or directly in the bare `ios/` directory. Expo SDK 53 managed workflow sets these automatically when you add the relevant package and configure it in `app.config.ts`.
- **Android:** `AndroidManifest.xml` permissions (`CAMERA`, `ACCESS_FINE_LOCATION`, `POST_NOTIFICATIONS`, etc.) must be listed. Android 13+ requires `POST_NOTIFICATIONS` to be requested at runtime; it is not granted automatically.

Haptic feedback, share sheets, and status bar behaviour differ between platforms. Wrap each in an adapter. Do not assume iOS behaviour is the baseline.

---

## Offline UX

Offline UX is not optional for a production mobile app. The baseline expectation:

1. **Reads:** TanStack Query with a persister (`@tanstack/query-async-storage-persister` backed by MMKV or AsyncStorage) keeps the last successful response in local storage. Users see stale data, clearly labelled, rather than a blank screen.
2. **Writes:** Mutations use `networkMode: 'offlineFirst'`. TanStack Query queues them and replays on reconnect. The screen shows an `isPaused` indicator ("Will submit when online").
3. **Conflict resolution:** When a queued write finally reaches the server and conflicts with a newer server state, the app must have a defined policy (last-write-wins, user prompt, or discard). Document the policy per mutation type.
4. **Network status:** Use `@react-native-community/netinfo` to detect connectivity. Show a persistent banner when offline; dismiss it automatically on reconnect.

`expo-secure-store` (SecureStore) is for sensitive tokens and credentials — not for general offline data caching. For bulk offline data, use MMKV via `react-native-mmkv` or SQLite via `expo-sqlite`. Choose the right storage layer for each use case.

---

## EAS Build and EAS Update

EAS Build compiles the native binary (`.ipa` / `.aab`). EAS Update pushes a new JS bundle and assets to devices that already have the binary installed.

The critical constraint: an EAS Update can only be applied to a binary that shares the same `runtimeVersion`. The runtime version must be bumped whenever:
- A new native module is added or removed.
- The Expo SDK version changes.
- Any `app.config.ts` change that modifies native code (permissions, entitlements, splash screen, icon).

Set `runtimeVersion` policy to `"appVersion"` (ties it to the `app.json` version field) or `"nativeVersion"` (ties it to the native code hash). Do not use `"exposdkVersion"` in production — it updates too broadly.

Channels (`production`, `staging`, `preview`) map to EAS Update channels in `eas.json`. A staging binary should point to the `staging` channel; a production binary to `production`. Never point a production binary at `staging`.

JS-only changes (logic fixes, copy updates, style tweaks, new React components with no new native imports) are safe for OTA. Any change that causes a new native module to be required at runtime is not safe for OTA and will crash on devices with the old binary.

---

## Permissions flow

The correct flow for any OS permission:

1. **Gate by feature, not by lifecycle hook.** Request the permission inside the handler that needs it, not in `useEffect` on mount.
2. **Check current status first.** If `status === 'granted'`, proceed directly. If `status === 'undetermined'`, show your rationale UI then request. If `status === 'denied'`, guide to Settings via `Linking.openSettings()` — do not re-request.
3. **Show your own rationale before the OS dialog.** One sentence explaining the benefit to the user is enough. This is the only opportunity before iOS makes the denial permanent.
4. **Handle denial gracefully.** The feature should degrade, not crash. Show a clear message and a "Go to Settings" button.

For `expo-notifications`, the `POST_NOTIFICATIONS` runtime permission on Android 13+ must be requested explicitly in code in addition to being declared in the manifest. Use the `Notifications.requestPermissionsAsync()` API from the adapter layer.

For location, prefer `requestForegroundPermissionsAsync()` unless background location is genuinely required by the product. Background location triggers additional App Store review scrutiny and should be documented in the privacy manifest.

iOS info.plist usage description strings must be accurate and specific. Apple rejects apps where the description does not match actual usage. These strings are set in `app.config.ts` via the `ios.infoPlist` field in managed workflow.

---

## Review checklist

### Summary
One-line verdict on the mobile implementation's structural health — managed workflow discipline, navigation centralisation, adapter boundaries, offline UX, and OTA safety.

### Findings
List each concern as `file:line, severity, category, fix`. Severity is `blocker | major | minor`. Category is one of `workflow | navigation | adapter | platform | offline | eas-update | permissions`. Fix is a one-line actionable remediation.

Example: `src/screens/ProfileScreen.tsx:42, blocker, adapter, move expo-image-picker call into src/adapters/cameraAdapter.ts and import the adapter instead`.

List every direct screen-to-screen import found. List every native API call that appears outside an adapter. These are blocking concerns.

### Safer alternative
Prefer Expo managed workflow over bare for apps without hard native dependencies — it preserves OTA for JS-only fixes and eliminates Xcode/Gradle maintenance. For bug fixes that do not touch native modules, prefer EAS Update over a binary-store release where acceptable, so users receive the fix within minutes instead of store-review days. If a native module seems required, check for an Expo SDK equivalent (camera, notifications, location, secure store, file system, sqlite, haptics, sharing) before ejecting to bare or adding a custom native module.

### Checklist coverage

For each rule, mark **PASS**, **CONCERN**, or **NOT APPLICABLE**.

- [ ] Expo managed workflow in use, or bare workflow justified and documented
- [ ] Navigation tree lives in `src/navigation/`; no screen imports another screen
- [ ] Every native module call is inside an adapter in `src/adapters/`
- [ ] `Platform.OS` / `Platform.select` only appears in adapters and style utilities
- [ ] Every screen has a documented offline state (cached read, queued write, or explicit error)
- [ ] EAS Update runtime version policy defined; no native changes shipped via OTA
- [ ] Permissions requested at point of use with rationale UI preceding the OS dialog

## Interactions with other skills

- **REQUIRED BACKGROUND:** `templates/baseline-standards.md` — structural expectations shared with all domain skills.
- **Hands off to:** `state-integrity-check` — offline sync conflict resolution logic.
- **Hands off to:** `integration-contract-safety` — API contract changes affecting mobile payloads.
- **Hands off to:** `accessibility-guard` — TalkBack / VoiceOver / dynamic type concerns.
