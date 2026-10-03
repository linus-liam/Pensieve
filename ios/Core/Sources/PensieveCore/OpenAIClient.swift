import Foundation

enum AIClientError: LocalizedError {
    case badResponse
    case rejected(String)
    case emptyReply

    var errorDescription: String? {
        switch self {
        case .badResponse: return "The AI service returned an unreadable response. Your message is still saved."
        case .rejected(let message): return "AI request failed: \(message). Your message is still saved."
        case .emptyReply: return "The AI service did not return a reply. Your message is still saved."
        }
    }
}

struct OpenAIClient {
    let session: URLSession
    init(session: URLSession = .shared) { self.session = session }

    func reply(to messages: [ConversationMessage], key: String, model: String) async throws -> String {
        var request = URLRequest(url: URL(string: "https://api.openai.com/v1/responses")!)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(OpenAIRequest(model: model, messages: messages))

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AIClientError.badResponse }
        guard (200..<300).contains(http.statusCode) else {
            let body = try? JSONDecoder().decode(APIErrorEnvelope.self, from: data)
            let reason = body?.error.message ?? "HTTP \(http.statusCode)"
            throw AIClientError.rejected(String(reason.prefix(180)))
        }
        let result = try JSONDecoder().decode(APIResponse.self, from: data)
        let text = result.output.flatMap { $0.content ?? [] }.compactMap { $0.text }.joined(separator: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw AIClientError.emptyReply }
        return text
    }
}

private struct APIResponse: Decodable {
    struct Output: Decodable {
        struct Content: Decodable { let text: String? }
        let content: [Content]?
    }
    let output: [Output]
}

private struct APIErrorEnvelope: Decodable {
    struct Detail: Decodable { let message: String }
    let error: Detail
}
