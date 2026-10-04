import Foundation

public struct ConversationMessage: Codable, Equatable, Identifiable, Sendable {
    public enum Role: String, Codable, Sendable {
        case user
        case assistant
    }

    public let id: UUID
    public let role: Role
    public let text: String
    public let createdAt: Date

    public init(id: UUID = UUID(), role: Role, text: String, createdAt: Date = Date()) {
        self.id = id
        self.role = role
        self.text = text
        self.createdAt = createdAt
    }
}

public struct Conversation: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public let createdAt: Date
    public var updatedAt: Date
    public var messages: [ConversationMessage]

    public init(id: UUID = UUID(), createdAt: Date = Date(), messages: [ConversationMessage] = []) {
        self.id = id
        self.createdAt = createdAt
        self.updatedAt = createdAt
        self.messages = messages
    }

    public var title: String {
        let first = messages.first(where: { $0.role == .user })?.text ?? "新聊天"
        let singleLine = first.replacingOccurrences(of: "\n", with: " ")
        return String(singleLine.prefix(50))
    }
}

public struct ConversationArchive: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public var conversations: [Conversation]

    public init(conversations: [Conversation] = []) {
        self.schemaVersion = 1
        self.conversations = conversations
    }
}
