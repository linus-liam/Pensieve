# iOS-first private build

> Agreed by Linus and Liam on 2026-10-01. Linus owns the product outcome; Liam owns the technical route and engineering delivery.

## Outcome

Ship an iOS version that Linus can start using on his iPhone every day. This is a private development build for Linus and Liam. It is the next product-learning surface, not a public App Store release.

The existing mobile web preview remains a record of the previous implementation. The current delivery priority is the iOS build described here.

## First usable path

1. Linus installs or opens Pensieve on his iPhone without depending on his Mac.
2. The app opens without account registration or login.
3. Linus enters the private API configuration required for AI replies.
4. He starts one chat and pours out his thoughts using the current Pensieve workflow.
5. The AI responds naturally, asks useful follow-up questions and recognizes when further questioning is no longer useful.
6. Every user message and the complete raw conversation are stored locally before or independently of successful AI processing.
7. Closing and reopening the app restores the conversation.
8. Installing a later development build preserves or deliberately migrates the existing local data so product iteration does not erase the material gathered through daily use.

## Scope

- iOS and iPhone first.
- One chat surface using the current workflow and visual design; visual redesign is not required.
- Local retention of the complete raw conversation and the data needed to resume it.
- No cross-device sync.
- No account system or login.
- Private AI configuration supplied by Linus and Liam.
- Natural AI response and useful follow-up questions.
- Evidence-informed stopping behavior drawing on psychology and cognitive science; the detailed behavior still needs product definition and evaluation.
- At a likely stopping point, stop introducing new questions and respond naturally. If it remains unclear whether the user wants to continue, gently ask whether to pause. Never close the session automatically.
- Complete conversation retention is required; generating a formal review or confirmed summary at the end is not required in this phase.
- Small, reversible increments shaped by Linus's actual daily use.

## Acceptance

### Engineering handoff

- The build runs on a real iPhone independently of the development Mac after installation.
- A new user message is committed to local storage before an AI failure can lose it.
- A complete synthetic conversation survives app termination and relaunch.
- An upgrade or migration check demonstrates that a later build can read the earlier build's local data.
- Synthetic conversation checks cover at least an explicit request to stop, a user who still wants to continue, and a conversation where further questions no longer add clarity. The AI must not keep asking after an explicit stop, must not end merely because the user corrected its understanding, and must leave the final stop decision to the user.
- Credentials, personal conversations and local app data are excluded from Git and test fixtures.
- Linus can complete the first real daily-use conversation and report the largest workflow friction.

Use temporary storage and synthetic conversations for engineering tests. Do not read Linus's personal Pensieve data as test input.

### Product validation and cycle completion

Meeting the engineering conditions means the build is ready for Linus; it does not complete the product cycle. Linus then uses the iPhone build in real situations for one week. During that period, product feedback should come from actual use rather than added speculative scope.

The cycle completes after Linus and Liam review that week of use, identify the largest observed friction and choose the next small increment. No external test user is required for this cycle.

## Deferred until an external test user

- Public App Store release readiness.
- Production account, authentication and multi-user infrastructure.
- Cross-device synchronization.
- Security design for distributing shared service credentials to outside users.
- iPadOS and macOS delivery sequencing.
- Visual redesign and broad feature expansion.

The private build may deliberately lower infrastructure complexity, but it must not commit secrets or personal data, silently lose raw text, or claim public-release security.

## Product reasoning captured from the discussion

Linus's exact words:

> Bro could you make the app be able to use in iPhone first and figure out a way to store raw data locally

> Then I’ll start to use pensieve everyday

> The look doesn’t matter

> Use current one should be fine

> One chat board

> And could capture raw data of convo

> No need to login

> And I input our api

> The data will be save locally and when we iterate it we could still use those data

> Do simple increment two ppl team we could change a lot

When asked for the minimum AI behavior in the first build, Linus answered:

> A，以及最好能根据心理学和认知科学里面的一些内容决定什么时候该停

Linus accepted the combined stopping behavior: stop asking and respond naturally first; gently ask whether to pause only when needed.

When asked what completes the first iOS cycle, Linus selected the option requiring the engineering handoff followed by one week of real use.

Liam agreed to convert the current implementation to iOS, said local storage was straightforward, accepted that the first build is only for the two founders, and distinguished it from a public release that will require stronger security.

## Engineering progress — 2026-10-03

An initial native SwiftUI project is now in [`../ios/`](../ios/README.md). It implements one chat surface, history, local raw-message storage before AI requests, a device-Keychain API key, direct AI replies, a local response to unambiguous stop requests, retry after AI failure, and archive export. The archive uses a stable bundle ID and versioned local format; a decoding failure stops writes rather than silently resetting conversations.

The core tests cover save/reopen, unreadable and future-format archives, request shape, mocked success/failure responses, and explicit stopping. On 2026-10-03 the native app launched in an iPhone 17 Pro simulator; a synthetic user message survived force quit and relaunch, then remained visible after installing build 2 over build 1 with the same bundle ID. A signed development build also installed and launched on Liam's iPhone 13 Pro after he trusted the developer profile. Liam confirmed that a synthetic conversation survived force quit and relaunch on that phone, and its earlier message remained visible after build 2 was installed over build 1. While unplugged from the Mac, he received a live AI reply, verified that an offline message remained saved and retried successfully after reconnecting, and confirmed that an explicit stop received no further question. The first AI reply asked several questions despite the intended single follow-up limit; build 3 tightens that instruction and is undergoing device checks. **This is engineering progress, not the agreed handoff:** broader stopping behavior and Linus's installation remain to be confirmed. Liam has only a Personal Team; its current provisioning profile expires on 2026-10-10, so Linus's one-week use needs a fresh signed install at handoff or longer-lived provisioning.

The earlier mobile web preview has separate browser storage and is not automatically migrated into this native app.

## Related context

- [Existing iPhone web preview](mobile-preview.md)
- [Local reflection behavior](local-reflection.md)
- [Shared decision](https://github.com/linus-liam/shared-context/blob/main/decisions/2026-10-01-product-roles-and-current-priority.md)
