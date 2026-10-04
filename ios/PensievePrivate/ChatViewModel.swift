import Foundation
import SwiftUI

@MainActor
final class ChatViewModel: ObservableObject {
    @Published private(set) var conversations: [Conversation] = []
    @Published private(set) var selectedID: UUID?
    @Published private(set) var isGenerating = false
    @Published var errorMessage: String?
    @Published var loadError: String?

    private var repository: ConversationRepository?
    private let client = OpenAIClient()

    init() {
        do {
            let base = try FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            ).appendingPathComponent("Pensieve", isDirectory: true)
            let loaded = try ConversationRepository(directory: base)
            repository = loaded
            refresh()
            selectedID = conversations.first?.id
        } catch {
            // Never create an empty replacement when existing data cannot be decoded.
            loadError = "Saved conversations could not be opened: \(error.localizedDescription)"
        }
    }

    var selectedConversation: Conversation? {
        conversations.first(where: { $0.id == selectedID })
    }

    var archiveURL: URL? { repository?.fileURL }

    var canRetryLastReply: Bool {
        selectedConversation?.messages.last?.role == .user &&
            !isGenerating &&
            UserDefaults.standard.bool(forKey: "aiEnabled") &&
            PrivateKeyStore.read() != nil
    }

    func select(_ id: UUID?) { selectedID = id; errorMessage = nil }

    @discardableResult
    func send(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isGenerating, let repository else { return false }
        do {
            // This write completes before any network request is constructed.
            let id = try repository.appendUser(trimmed, to: selectedID)
            selectedID = id
            refresh()
            errorMessage = nil

            if UserDefaults.standard.bool(forKey: "aiEnabled"),
               let localReply = ReflectionPolicy.localStopReply(for: trimmed) {
                do {
                    try repository.appendAssistant(localReply, to: id)
                    refresh()
                } catch {
                    errorMessage = "Your message is saved, but the reply could not be saved: \(error.localizedDescription)"
                }
            } else if UserDefaults.standard.bool(forKey: "aiEnabled"), let key = PrivateKeyStore.read() {
                generateReply(to: id, key: key)
            } else if UserDefaults.standard.bool(forKey: "aiEnabled") {
                errorMessage = "Your message is saved. Add an API key in Settings to receive an AI reply."
            }
            return true
        } catch {
            errorMessage = "Could not save this message: \(error.localizedDescription)"
            return false
        }
    }

    func retryLastReply() {
        guard canRetryLastReply,
              let conversation = selectedConversation,
              let key = PrivateKeyStore.read() else { return }
        generateReply(to: conversation.id, key: key)
    }

    @discardableResult
    func deleteConversation(_ id: UUID) -> Bool {
        guard !isGenerating, let repository else { return false }
        do {
            try repository.deleteConversation(id)
            refresh()
            if selectedID == id {
                selectedID = conversations.first?.id
            }
            errorMessage = nil
            return true
        } catch {
            errorMessage = "Could not delete this conversation: \(error.localizedDescription)"
            return false
        }
    }

    private func generateReply(to id: UUID, key: String) {
        guard let conversation = repository?.conversation(id) else { return }
        isGenerating = true
        let model = UserDefaults.standard.string(forKey: "aiModel")?.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                let reply = try await client.reply(
                    to: conversation.messages,
                    key: key,
                    model: (model?.isEmpty == false ? model! : "gpt-4o-mini")
                )
                try repository?.appendAssistant(reply, to: id)
                refresh()
                errorMessage = nil
            } catch {
                if selectedID == id {
                    errorMessage = "Your message is saved. \(error.localizedDescription)"
                }
            }
            isGenerating = false
        }
    }

    private func refresh() {
        conversations = (repository?.archive.conversations ?? []).sorted { $0.updatedAt > $1.updatedAt }
    }
}
