import Foundation

public enum ReflectionPolicy {
    /// Only unambiguous, whole-message stop requests are handled locally.
    /// Other intent remains with the model and the user always controls the session.
    public static func localStopReply(for text: String) -> String? {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .trimmingCharacters(in: CharacterSet(charactersIn: ".!?。！？，,"))
        let english = ["stop", "let's stop", "lets stop", "stop here", "pause here", "end here"]
        let chinese = ["停", "先停", "先停一下", "聊到这里", "今天先到这里", "不想继续聊了"]
        if english.contains(normalized) { return "We can stop here. Your words are saved, and you can come back whenever you want." }
        if chinese.contains(normalized) { return "好，我们先停在这里。你的原话已保存，想继续时随时回来。" }
        return nil
    }

    public static let instructions = """
    You are Pensieve, a thoughtful reflection companion. Reply in the user's language.
    Help the user express and understand a concrete experience. Do not diagnose, make unsupported interpretations, or mechanically agree. Ask at most one useful follow-up question only when it would genuinely help.
    If the user asks to stop, do not ask another question; acknowledge naturally and leave the conversation open for a later return. If the user corrects your understanding or wants to continue, follow their lead rather than ending. When further questions no longer add clarity, respond naturally without a new question. If it is unclear whether they want to continue, gently ask whether to pause here.
    The user decides whether the conversation ends. Do not claim a clinical conclusion or force a formal summary.
    """
}

public struct OpenAIRequest: Encodable {
    public struct Input: Encodable {
        public let role: String
        public let content: String
    }

    public let model: String
    public let instructions: String
    public let input: [Input]
    public let store: Bool

    public init(model: String, messages: [ConversationMessage]) {
        self.model = model
        self.instructions = ReflectionPolicy.instructions
        self.input = messages.map { Input(role: $0.role.rawValue, content: $0.text) }
        self.store = false
    }
}
