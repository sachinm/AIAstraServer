---
name: Speech-to-text in ChatSection
overview: "Add Web Speech API-based voice input to the chat input area: microphone button to start listening, \"Listening...\" indicator, stop button at bottom-right of the textarea, permission handling across browsers, auto-stop after 1–3 seconds of silence, and iOS-focused workarounds. Graceful degradation when permission is denied; stop button only when listening; re-enable mic when user grants permission later; unit tests and a dedicated hook/component with try/catch."
todos: []
isProject: false
---

# Speech-to-text in Chat Input

## Approach

Use the **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`). Encapsulate all speech logic in a **custom hook** (e.g. `useSpeechRecognition`) so it can be unit-tested in isolation and wrapped in try/catch. [ChatSection.tsx](frontend/src/pages/chat-interface/ChatSection.tsx) will consume this hook and keep the textarea and Send button unchanged. No new npm dependencies; add `Mic` and `Square` or `StopCircle` from `lucide-react`.

## Graceful degradation (deny permission / unsupported)

- **Textarea and Send button**: Always remain present and fully functional. Denying the microphone must not affect typing or sending.
- **Microphone button**: Always **visible**; when the user denies permission or the browser does not support speech recognition, the mic button is **disabled** (not hidden). Use tooltip/aria-label when disabled (e.g. "Microphone unavailable").
- **Errors**: Wrap speech API and permission logic in try/catch so failures only disable the mic and optionally set a UX message—never break the input area.

## Stop button visibility

- The **stop microphone** button is shown **only when the microphone is active and listening** (`isListening === true`). When not listening, do not render it.

## Permission re-check (user enables later in browser settings)

- If the user initially denies access but later enables the microphone in browser/site settings, the feature should become active again and the mic button enabled and clickable.
- **Re-try on click**: When the mic is disabled due to permission denied, keep the button clickable so that a click attempts `recognition.start()` again; if the user has since granted permission, start will succeed and the feature re-enables.
- **Optional**: Use `navigator.permissions.query({ name: 'microphone' })` and the `change` event where supported to update state when permission becomes "granted". Safari has limited support; re-try on click is the primary recovery path.
- **Optional**: On `visibilitychange` or window focus, re-query permission to enable the mic without requiring a click.

## Browser support and permission

- **Chrome, Edge, Safari (desktop/iOS), Android Chrome**: Supported. Use `window.SpeechRecognition || window.webkitSpeechRecognition`.
- **Firefox**: Limited/experimental (flag or limited support). Feature-detect and **disable** the mic button when unsupported; keep it visible (do not hide); show a short “Voice input not supported in this browser” if needed.
- **Permission**: The browser prompts for microphone access when `recognition.start()` is first called. To maximize iOS reliability, **start recognition only from a direct user gesture** (the mic button `onClick`). Do not await async work before calling `recognition.start()`—call it synchronously inside the click handler (or in the first `.then()` of a minimal `getUserMedia` if you pre-request mic).

## iOS-specific behavior and fixes

- **User gesture**: Call `recognition.start()` directly in the mic button’s `onClick` handler. Avoid `setTimeout` or multi-step async before `start()` so the gesture is still considered “direct” by Safari.
- **Optional pre-request (if needed)**: If testing shows iOS still blocks, try requesting the microphone in the same click via `navigator.mediaDevices.getUserMedia({ audio: true })` and, in that callback, call `recognition.start()`. This can add ~1–2 s on first run but may improve reliability.
- **Safari “mic stays on” bug**: After the user stops (or auto-stop), call a small helper that on Apple devices does `try { recognition.start(); } catch {}` then `recognition.stop()` so the OS releases the microphone.
- **Continuous results on iOS**: Safari can stop firing `onresult` after the first result. Keep `continuous: true` and `interimResults: true`; if you need a fallback, you can restart recognition once after a final result (with a short delay), though the primary stop should remain user stop or silence timeout.

## UI changes in [ChatSection.tsx](frontend/src/pages/chat-interface/ChatSection.tsx)

1. **Microphone button**
  - Add a **Mic** icon button (e.g. left of the textarea, or between textarea and Send).  
  - When unsupported or permission denied: **disable** the button but keep it visible; use aria-label/tooltip (e.g. "Microphone unavailable").  
  - On click: request permission (if needed) then start recognition (see above).  
  - While listening, the mic button can show a “listening” state (e.g. different icon or pulse) and be disabled or act as “stop” depending on design.
2. **“Listening...” indicator**
  - When `isListening` is true, show a small **“Listening...”** label/indicator near the textarea (e.g. above the input row, or below the textarea inside the input container). Style to match the existing “Powered by Vedic AI” area (e.g. small, muted text or a pill).
3. **Stop button**
  - **Only when `isListening` is true**: show a **stop** button (e.g. **Square** or **StopCircle** from lucide-react) at the **bottom-right of the textarea** (absolute positioning inside the `relative` wrapper that already contains the textarea).  
  - Clicking it calls `recognition.stop()` and clears the silence timer.
4. **Layout**
  - Keep the existing `relative` wrapper around the textarea so the Star icon and the new stop button can be absolutely positioned (e.g. Star stays top-right; stop button bottom-right).  
  - Ensure the stop button doesn’t overlap the Send button; place it inside the textarea container (right bottom of the textarea only).

## Logic to add

- **State**: `isListening` (boolean), optional `permissionDenied` or `speechError` for UX (e.g. “Microphone access denied”).
- **Refs**: `recognitionRef` (SpeechRecognition instance), `silenceTimeoutRef` (return type of `setTimeout`).
- **Recognition setup** (once, in a ref or effect):
  - Use `SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition`, create instance, set `continuous: true`, `interimResults: true`, `lang` (e.g. from document or default `"en-US"`).
  - **Result handler**: On each `result` event, concatenate final and interim transcripts into the current phrase and call `setInputText` with the accumulated text (append to existing or replace based on UX choice; typically append to existing input). Reset the silence timer (e.g. 1.5–2.5 s) on any result.
  - **Silence auto-stop**: When no result for N seconds (configurable 1–3 s, e.g. 2 s), clear `silenceTimeoutRef` and call `recognition.stop()`, then clear `isListening`.
  - **End/error**: On `end`, set `isListening` to false and clear the silence timer. On `error`, set `isListening` to false, handle `not-allowed` for permission denied, and optionally show a short message.
- **Start**: In mic button `onClick`, set `isListening` true, (optionally) get media then call `recognition.start()` in the same gesture chain, and set the initial silence timer.
- **Stop**: On stop button click (and when auto-stopping), clear the silence timer, call the Safari workaround (start then stop), then set `isListening` false.
- **Cleanup**: On unmount, clear the silence timer and call `recognition.abort()` or the Safari stop workaround so the mic is released.

## Silence detection (1–3 seconds)

- **Approach**: Reset a timer on every `result` event (or on every interim/final transcript update). If the timer fires (no result for 1.5–2.5 s), treat as “user paused” and stop recognition.
- **Implementation**: `silenceTimeoutRef` = `setTimeout(() => { /* stop recognition, clear isListening */ }, 2000)` (or 1500/2500). On each `onresult`, clear the previous timeout and set a new one. When stopping, clear the timeout.

## Encapsulation: hook and try/catch

- **Custom hook** (e.g. `useSpeechRecognition`): Implement in [frontend/src/pages/chat-interface/useSpeechRecognition.ts](frontend/src/pages/chat-interface/useSpeechRecognition.ts). The hook should return `isListening`, `isSupported`, `permissionDenied`, `startListening`, `stopListening`, and a way to feed transcript into the input (e.g. callback or controlled value). Wrap `recognition.start()`, `recognition.stop()`, and any permission logic in **try/catch**; on catch, set error/permission-denied state and never throw. Clean up on unmount (clear timer, Safari stop workaround).
- **ChatSection** uses the hook and renders the mic button (disabled when unsupported or permission denied), "Listening..." indicator, and stop button only when `isListening`. Textarea and Send remain unchanged.

## Unit tests

- **Hook tests** ([frontend/src/pages/chat-interface/useSpeechRecognition.test.ts](frontend/src/pages/chat-interface/useSpeechRecognition.test.ts)): Mock `window.SpeechRecognition` / `window.webkitSpeechRecognition`. Test: unsupported browser returns `isSupported: false` and does not throw; when supported, `startListening()` calls `recognition.start()`, `stopListening()` calls `recognition.stop()`; `onresult` updates transcript; `onerror` with `not-allowed` sets permission-denied; silence timeout stops listening (use `vi.useFakeTimers()`).
- **ChatSection tests** (extend [frontend/src/pages/chat-interface/ChatSection.test.tsx](frontend/src/pages/chat-interface/ChatSection.test.tsx)): Mock the speech hook or global SpeechRecognition. Assert textarea and Send are always present; mic button is present but disabled when unsupported/denied; stop button is not rendered when not listening; when listening, "Listening..." and stop button are visible. Use existing Vitest + React Testing Library setup.

## File and code touchpoints

- **New**: [frontend/src/pages/chat-interface/useSpeechRecognition.ts](frontend/src/pages/chat-interface/useSpeechRecognition.ts) — all speech logic and try/catch in the hook.
- **New**: [frontend/src/pages/chat-interface/useSpeechRecognition.test.ts](frontend/src/pages/chat-interface/useSpeechRecognition.test.ts) — unit tests for the hook (mocked SpeechRecognition).
- **Update**: [frontend/src/pages/chat-interface/ChatSection.tsx](frontend/src/pages/chat-interface/ChatSection.tsx) — use the hook; add `Mic`, `Square`/`StopCircle`; mic button (disabled when `!isSupported || permissionDenied`); Listening... when `isListening`; stop button only when `isListening` (absolute, bottom-right of textarea); textarea and Send unchanged; `startListening` invoked directly from `onClick`.
- **Update**: [frontend/src/pages/chat-interface/ChatSection.test.tsx](frontend/src/pages/chat-interface/ChatSection.test.tsx) — add tests for mic visibility/disabled state and stop button only when listening. the “Listening...”

## Optional: TypeScript types

The Web Speech API is not in all TS libs. Add a small declaration (e.g. in a `speech.d.ts` or at top of the component) for `webkitSpeechRecognition` and `SpeechRecognition` so TypeScript compiles without errors.

## Summary

- **New hook** and **hook tests**; **updates** to ChatSection and ChatSection tests.
- Graceful degradation: textarea and Send always work; mic button always visible but disabled when unsupported or permission denied; stop button only when listening. Re-enable mic when user grants permission later (re-try on click; optional Permissions API). All speech logic in a hook with try/catch; unit tests for hook and ChatSection verify microphone and speech-to-text behavior.

