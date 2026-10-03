# Pensieve private iPhone build

This is the first native iPhone development build for Linus and Liam. It uses one chat surface, stores complete raw conversations in the app's Application Support directory, and can request AI replies directly from OpenAI with a key entered on the device. The key is stored in this device's Keychain and is never checked into Git.

## Build and run

1. Open `ios/PensievePrivate.xcodeproj` in Xcode 26.5 or newer.
2. Select the `PensievePrivate` scheme and an iPhone simulator or connected iPhone.
3. For a physical iPhone, set a development team in **Signing & Capabilities**. Keep the bundle identifier `com.linusliam.pensieve.private` unchanged across later builds so iOS keeps this app's data container.
4. Run the app. It opens without registration or login. It saves raw messages even when AI is off.
5. On the device, open **Settings**, enter an OpenAI API key and enable AI replies. The current conversation is sent directly from this iPhone to OpenAI when generating a reply. Other conversations are not sent automatically. No key is bundled into the app.

The app uses `gpt-4o-mini` by default; the model can be changed in Settings. Network access is required for AI replies. An explicit whole-message stop request is acknowledged locally without another model question. The app never automatically closes a conversation.

## Engineering checks

```sh
swift test --package-path ios/Core
xcodebuild -project ios/PensievePrivate.xcodeproj -scheme PensievePrivate \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Before handing the build to Linus, check on a real iPhone:

1. Install and open without the development Mac; no login is needed.
2. Send a synthetic message with AI disabled, force quit, relaunch, and verify the exact text is still present.
3. Enter a private key on the device, enable AI, send a synthetic message, and verify an AI reply. Do not put the key or personal conversation in logs, fixtures or Git.
4. Test a failed AI request, then retry. The original user message must remain visible and saved.
5. Test explicit stopping, correction with continued discussion, and a conversation where further questions stop adding clarity. The user must always control whether the chat continues.
6. Install a later build with the same bundle ID over the first. Verify earlier messages still open, and export the archive from Settings as a separate backup.

The repository's earlier mobile web preview uses separate browser storage. This native app does not automatically import its IndexedDB data. Export any existing web-preview content before removing that preview.

The app's archive format is versioned (`conversations-v1.json`). If a future app cannot decode it, launch shows an error instead of replacing it with an empty archive. Files are atomically written, and iOS data protection is requested after each write. Exported archives contain personal conversations and should be handled accordingly.

## Current limits

- This is a private development build, not an App Store release.
- On 2026-10-03, a synthetic message survived simulator relaunch and installing simulator build 2 over build 1 with the same bundle ID.
- A signed build installed and launched on Liam's iPhone 13 Pro. Liam confirmed that the exact synthetic message survived force quit and relaunch on that phone, and remained visible after build 2 installed over build 1 with the same bundle ID.
- Liam received a live AI reply while the phone was unplugged, confirmed that an offline message stayed saved and retried after reconnection, and saw no new question after an explicit stop. The first AI reply asked too many questions; build 3 refines the prompt and is being checked for the correction and natural stopping cases.
- The current personal-team provisioning profile expires on 2026-10-10. Refresh signing at handoff or use longer-lived provisioning before Linus starts his one-week use.
- iPadOS, macOS, cross-device sync and account login are outside this first result.
- The exact evidence-informed stopping behavior still needs evaluation with synthetic conversations and feedback from real use.
