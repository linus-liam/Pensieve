import SwiftUI

struct SettingsView: View {
    let archiveURL: URL?
    @Environment(\.dismiss) private var dismiss
    @AppStorage("aiEnabled") private var aiEnabled = false
    @AppStorage("aiModel") private var model = "gpt-4o-mini"
    @State private var key = ""
    @State private var hasKey = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("AI") {
                    Text("When enabled, messages in the current conversation are sent directly from this iPhone to OpenAI for a reply. Other conversations are not sent automatically.")
                        .font(.footnote)
                    SecureField("OpenAI API key", text: $key)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
#if targetEnvironment(simulator)
                    Text("Simulator test keys stay in app memory and disappear when the app closes.")
                        .font(.footnote)
#endif
                    Button(saveKeyLabel) { saveKey() }
                        .disabled(key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    if hasKey {
                        Button(removeKeyLabel, role: .destructive) {
                            PrivateKeyStore.delete()
                            hasKey = false
                            aiEnabled = false
                            message = "Key removed."
                        }
                    }
                    TextField("Model", text: $model)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Toggle("Enable AI replies", isOn: $aiEnabled)
                        .disabled(!hasKey)
                }
                Section("Local data") {
                    Text("The full raw conversation stays in this app's local storage. Keep the same bundle ID when installing later development builds.")
                        .font(.footnote)
                    if let archiveURL, FileManager.default.fileExists(atPath: archiveURL.path) {
                        ShareLink(item: archiveURL) {
                            Label("Export conversation archive", systemImage: "square.and.arrow.up")
                        }
                    }
                }
                if let message {
                    Section { Text(message).foregroundStyle(.secondary) }
                }
            }
            .navigationTitle("设置")
            .toolbar { Button("完成") { dismiss() } }
        }
        .onAppear {
            hasKey = PrivateKeyStore.read() != nil
#if targetEnvironment(simulator)
            if !hasKey { aiEnabled = false }
#endif
        }
    }

    private var saveKeyLabel: String {
#if targetEnvironment(simulator)
        return hasKey ? "Replace session key" : "Use key for this simulator session"
#else
        return hasKey ? "Replace saved key" : "Save key on this iPhone"
#endif
    }

    private var removeKeyLabel: String {
#if targetEnvironment(simulator)
        return "Clear session key"
#else
        return "Remove saved key"
#endif
    }

    private func saveKey() {
        do {
            try PrivateKeyStore.save(key.trimmingCharacters(in: .whitespacesAndNewlines))
            key = ""
            hasKey = true
#if targetEnvironment(simulator)
            message = "Key available for this simulator session. Enable AI replies when you are ready."
#else
            message = "Key saved on this iPhone. Enable AI replies when you are ready."
#endif
        } catch {
            message = error.localizedDescription
        }
    }
}
