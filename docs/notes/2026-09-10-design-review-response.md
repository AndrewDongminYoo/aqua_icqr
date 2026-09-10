# Design review response (2026-09-10)

An external design review compared a-que-ar with tree.icqr.com and reported one P0, three P1, three P2, and one P3 finding.
This note records what the review observed, what the reproduction showed, and which findings were adopted, declined, or deferred.

## Reproduction

The review captured the page in a Chromium automation tab.
The same signature reproduced in a Chrome tab driven by the Claude in Chrome extension against the hosted site: `document.visibilityState` was `hidden`, `requestAnimationFrame` delivered 0 callbacks in 500 ms, the scene canvas bitmap stayed at 300 by 150, and `Show QR` left the page at `data-reveal-phase="scattering"` and `data-view="reef"` after 4 seconds.
Playwright captures of the same build in a visible page at 1440 by 900 and 390 by 844 showed the reef diorama from the idle screen onward and a completed QR reveal.

Three findings therefore shared one cause: the app advanced the reveal timeline only inside animation frames, and it skipped the redraw after a resize while the document was hidden, which left the resized canvas blank.

## Adopted

| Finding | Change |
| --- | --- |
| P0 reef to QR transition never completes | `beginTransition` now arms a `setTimeout` at the reveal duration, so the transition completes without an animation frame. `clearTransition` cancels it wherever the transition is dropped. |
| P1 stage renders blank | `updateLayout` redraws after every resize regardless of `document.hidden`, the first layout runs synchronously at boot, and a shared link activates without waiting for a frame. |
| P2 post-creation action hierarchy | `Show QR` is the only coral action. `Open destination` is the outlined secondary. `Share experience` and `Replay` are underlined text actions. The dock's `Create reef` uses the secondary tokens. |
| P2 depth marker had no meaning | The `SURFACE / SEABED` gauge spans the stage band and its needle follows the camera lift (`--depth` from the reveal frame). The gauge layout was also repaired: the container's `writing-mode` had laid its three children side by side. |
| P3 action buttons were 42 px | Every action is at least 44 px tall. |

A Playwright test (`draws the reef and finishes the QR reveal in a background tab that never delivers animation frames`) reproduces the hidden-tab environment and decodes the final QR from a full-page screenshot.
It failed on the previous code with the same attributes the review reported and passes after the fix.

## Declined

- P1 "the initial screen is only texture" and the "ocean seed" suggestion: the idle screen already renders the decorative reef in a visible page. The empty stage was the hidden-tab symptom above.
- P1 "no recovery path after a timeout": the timer makes completion unconditional, so a "taking longer than expected" state would never be reachable.
- P2 "secondary buttons look disabled": in the review's captures every action was disabled, because the transition had not completed. The enabled tiers are now visually distinct anyway.

## Deferred

The review's originality verdict was "clear with moderate structural similarities" and suggested reinterpreting the QR reveal ritual (for example, water draining to expose a code in the seabed).
This change set keeps the current ritual; a reinterpretation is a separate brainstorming and planning task, not a follow-up patch.
No project precedent existed for the ritual or for the action hierarchy before this note.
