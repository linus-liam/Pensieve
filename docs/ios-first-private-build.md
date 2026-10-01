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
5. Every user message and the complete raw conversation are stored locally before or independently of successful AI processing.
6. Closing and reopening the app restores the conversation.
7. Installing a later development build preserves or deliberately migrates the existing local data so product iteration does not erase the material gathered through daily use.

## Scope

- iOS and iPhone first.
- One chat surface using the current workflow and visual design; visual redesign is not required.
- Local retention of the complete raw conversation and the data needed to resume it.
- No cross-device sync.
- No account system or login.
- Private AI configuration supplied by Linus and Liam.
- Small, reversible increments shaped by Linus's actual daily use.

## Acceptance

- The build runs on a real iPhone independently of the development Mac after installation.
- A new user message is committed to local storage before an AI failure can lose it.
- A complete synthetic conversation survives app termination and relaunch.
- An upgrade or migration check demonstrates that a later build can read the earlier build's local data.
- Credentials, personal conversations and local app data are excluded from Git and test fixtures.
- Linus can complete the first real daily-use conversation and report the largest workflow friction.

Use temporary storage and synthetic conversations for engineering tests. Do not read Linus's personal Pensieve data as test input.

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

Liam agreed to convert the current implementation to iOS, said local storage was straightforward, accepted that the first build is only for the two founders, and distinguished it from a public release that will require stronger security.

## Related context

- [Existing iPhone web preview](mobile-preview.md)
- [Local reflection behavior](local-reflection.md)
- [Shared decision](https://github.com/linus-liam/shared-context/blob/main/decisions/2026-10-01-product-roles-and-current-priority.md)
