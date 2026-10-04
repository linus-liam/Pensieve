import Foundation

public enum ConversationStoreError: LocalizedError {
    case unsupportedVersion(Int)
    case conversationMissing

    public var errorDescription: String? {
        switch self {
        case .unsupportedVersion(let version):
            return "This conversation archive uses unsupported format version \(version). No data was changed."
        case .conversationMissing:
            return "The conversation could not be found."
        }
    }
}

/// A single versioned file in Application Support. Mutations are written atomically
/// before the in-memory copy changes or a caller may start an AI request.
public final class ConversationRepository {
    public let fileURL: URL
    public private(set) var archive: ConversationArchive

    public init(directory: URL, fileManager: FileManager = .default) throws {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("conversations-v1.json")
        if fileManager.fileExists(atPath: fileURL.path) {
            let saved = try Data(contentsOf: fileURL)
            let decoded = try JSONDecoder().decode(ConversationArchive.self, from: saved)
            guard decoded.schemaVersion == 1 else {
                throw ConversationStoreError.unsupportedVersion(decoded.schemaVersion)
            }
            archive = decoded
        } else {
            archive = ConversationArchive()
        }
    }

    @discardableResult
    public func appendUser(_ text: String, to id: UUID? = nil, at date: Date = Date()) throws -> UUID {
        var next = archive
        let conversationID: UUID
        if let id {
            guard let index = next.conversations.firstIndex(where: { $0.id == id }) else {
                throw ConversationStoreError.conversationMissing
            }
            next.conversations[index].messages.append(.init(role: .user, text: text, createdAt: date))
            next.conversations[index].updatedAt = date
            conversationID = id
        } else {
            var conversation = Conversation(createdAt: date)
            conversation.messages.append(.init(role: .user, text: text, createdAt: date))
            next.conversations.append(conversation)
            conversationID = conversation.id
        }
        try commit(next)
        return conversationID
    }

    public func appendAssistant(_ text: String, to id: UUID, at date: Date = Date()) throws {
        var next = archive
        guard let index = next.conversations.firstIndex(where: { $0.id == id }) else {
            throw ConversationStoreError.conversationMissing
        }
        next.conversations[index].messages.append(.init(role: .assistant, text: text, createdAt: date))
        next.conversations[index].updatedAt = date
        try commit(next)
    }

    public func conversation(_ id: UUID?) -> Conversation? {
        guard let id else { return nil }
        return archive.conversations.first(where: { $0.id == id })
    }

    public func deleteConversation(_ id: UUID) throws {
        var next = archive
        guard let index = next.conversations.firstIndex(where: { $0.id == id }) else {
            throw ConversationStoreError.conversationMissing
        }
        next.conversations.remove(at: index)
        try commit(next)
    }

    private func commit(_ candidate: ConversationArchive) throws {
        let data = try JSONEncoder().encode(candidate)
        try data.write(to: fileURL, options: .atomic)
#if os(iOS)
        // The atomic write has already committed. A protection-setting failure
        // must not tell the UI that the message was lost and invite a duplicate.
        try? FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: fileURL.path
        )
#endif
        archive = candidate
    }
}
