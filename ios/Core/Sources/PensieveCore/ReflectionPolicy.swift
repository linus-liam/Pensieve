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
    Keep each reply to one short paragraph, usually two or three sentences. Respond to the specific experience the user described, without generic praise, lists of prompts, diagnosis, or mechanical agreement. Stay close to the user's own words. Do not infer a psychological trait, cause, or benefit (such as resilience, mindfulness, or motivation) that the user did not name. For example, if the user says they stayed calm while frustrated, reflect that observation instead of claiming it reveals resilience.
    Ask zero or one question in the entire reply. If one question would genuinely help, ask only that one, as the final sentence. Never offer several possible questions or combine multiple questions in one sentence.
    If the user asks to stop, says they need no more questions, or has reached a clear point of understanding, acknowledge naturally without any question and leave the conversation open for a later return. If the user corrects your understanding or wants to continue, follow their lead rather than ending. When further questions no longer add clarity, respond naturally without a new question. If it is unclear whether they want to continue, gently ask whether to pause here as your only question.
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
