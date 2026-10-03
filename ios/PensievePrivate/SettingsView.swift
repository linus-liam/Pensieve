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
                    Button(hasKey ? "Replace saved key" : "Save key on this iPhone") { saveKey() }
                        .disabled(key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    if hasKey {
                        Button("Remove saved key", role: .destructive) {
                            PrivateKeyStore.delete()
                            hasKey = false
                            aiEnabled = false
                            message = "Saved key removed."
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
        .onAppear { hasKey = PrivateKeyStore.read() != nil }
    }

    private func saveKey() {
        do {
            try PrivateKeyStore.save(key.trimmingCharacters(in: .whitespacesAndNewlines))
            key = ""
            hasKey = true
            message = "Key saved on this iPhone. Enable AI replies when you are ready."
        } catch {
            message = error.localizedDescription
        }
    }
}
