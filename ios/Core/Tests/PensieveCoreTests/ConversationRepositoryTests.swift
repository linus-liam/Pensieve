import XCTest
@testable import PensieveCore

final class ConversationRepositoryTests: XCTestCase {
    private func temporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    func testUserMessageSurvivesRelaunchBeforeAnyAIReply() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let firstBuild = try ConversationRepository(directory: directory)
        let id = try firstBuild.appendUser("A raw thought")

        let relaunchedBuild = try ConversationRepository(directory: directory)
        XCTAssertEqual(relaunchedBuild.conversation(id)?.messages.map(\.text), ["A raw thought"])

        try relaunchedBuild.appendAssistant("Tell me more", to: id)
        let laterBuild = try ConversationRepository(directory: directory)
        XCTAssertEqual(laterBuild.conversation(id)?.messages.map(\.text), ["A raw thought", "Tell me more"])
    }

    func testCorruptArchiveIsNeverSilentlyReset() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("conversations-v1.json")
        try Data("invalid".utf8).write(to: url)
        XCTAssertThrowsError(try ConversationRepository(directory: directory))
        XCTAssertEqual(try Data(contentsOf: url), Data("invalid".utf8))
    }

    func testFutureArchiveIsNeverOverwritten() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("conversations-v1.json")
        let future = Data("{\"schemaVersion\":2,\"conversations\":[]}".utf8)
        try future.write(to: url)
        XCTAssertThrowsError(try ConversationRepository(directory: directory))
        XCTAssertEqual(try Data(contentsOf: url), future)
    }

    func testVersionOneArchiveFixtureRemainsReadable() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let fixture = """
        {"schemaVersion":1,"conversations":[{"id":"00000000-0000-0000-0000-000000000001","createdAt":0,"updatedAt":0,"messages":[{"id":"00000000-0000-0000-0000-000000000002","role":"user","text":"from the first build","createdAt":0}]}]}
        """
        try Data(fixture.utf8).write(to: directory.appendingPathComponent("conversations-v1.json"))

        let laterBuild = try ConversationRepository(directory: directory)
        XCTAssertEqual(laterBuild.archive.conversations.first?.messages.first?.text, "from the first build")
    }

    func testDeletedConversationStaysDeletedAfterRelaunch() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let repository = try ConversationRepository(directory: directory)
        let deletedID = try repository.appendUser("Delete this conversation")
        let keptID = try repository.appendUser("Keep this conversation")

        try repository.deleteConversation(deletedID)

        let relaunched = try ConversationRepository(directory: directory)
        XCTAssertNil(relaunched.conversation(deletedID))
        XCTAssertEqual(relaunched.conversation(keptID)?.messages.map(\.text), ["Keep this conversation"])
    }

    func testDeletingMissingConversationDoesNotChangeArchive() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let repository = try ConversationRepository(directory: directory)
        let keptID = try repository.appendUser("Keep this conversation")
        let before = try Data(contentsOf: repository.fileURL)

        XCTAssertThrowsError(try repository.deleteConversation(UUID()))
        XCTAssertEqual(try Data(contentsOf: repository.fileURL), before)
        XCTAssertNotNil(repository.conversation(keptID))
    }

    func testPauseButtonRecordsIntentAndLocalReplyAtomically() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let repository = try ConversationRepository(directory: directory)
        let id = try repository.appendUser("I need to think about this")

        try repository.pauseConversation(id)

        let relaunched = try ConversationRepository(directory: directory)
        XCTAssertEqual(
            relaunched.conversation(id)?.messages.suffix(2).map(\.text),
            [ReflectionPolicy.pauseUserText, ReflectionPolicy.pauseReply]
        )
        XCTAssertEqual(
            relaunched.conversation(id)?.messages.suffix(2).map(\.role),
            [.user, .assistant]
        )
    }

    func testExplicitStopNeverNeedsModelQuestion() {
        XCTAssertNotNil(ReflectionPolicy.localStopReply(for: "Stop here."))
        XCTAssertNotNil(ReflectionPolicy.localStopReply(for: "聊到这里。"))
        XCTAssertNil(ReflectionPolicy.localStopReply(for: "I corrected that; I want to continue"))
        XCTAssertNil(ReflectionPolicy.localStopReply(for: "I don't know what to ask next"))
    }

    func testRequestContainsConversationAndDisablesServerStorage() throws {
        let messages = [ConversationMessage(role: .user, text: "hello")]
        let request = OpenAIRequest(model: "gpt-4o-mini", messages: messages)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any])
        XCTAssertEqual(object["store"] as? Bool, false)
        let input = try XCTUnwrap(object["input"] as? [[String: String]])
        XCTAssertEqual(input.first?["content"], "hello")
    }

    func testReflectionPromptCoversStoppingAndContinuing() {
        XCTAssertTrue(ReflectionPolicy.instructions.contains("If the user asks to stop"))
        XCTAssertTrue(ReflectionPolicy.instructions.contains("wants to continue"))
        XCTAssertTrue(ReflectionPolicy.instructions.contains("When further questions no longer add clarity"))
        XCTAssertTrue(ReflectionPolicy.instructions.contains("pause button"))
        XCTAssertTrue(ReflectionPolicy.instructions.contains("never ask whether they want to pause"))
        XCTAssertTrue(ReflectionPolicy.instructions.contains("The user decides"))
    }
}

private final class MockURLProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            let (response, data) = try Self.handler!(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }
    override func stopLoading() {}
}

final class OpenAIClientTests: XCTestCase {
    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    func testReplyParsesOutputAfterReasoningItem() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        let client = OpenAIClient(session: URLSession(configuration: config))
        MockURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://api.openai.com/v1/responses")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer synthetic-test-key")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            let data = Data("{\"output\":[{\"type\":\"reasoning\"},{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"That sounds important.\"}]}]}".utf8)
            return (response, data)
        }
        let reply = try await client.reply(
            to: [.init(role: .user, text: "hello")],
            key: "synthetic-test-key",
            model: "gpt-4o-mini"
        )
        XCTAssertEqual(reply, "That sounds important.")
    }

    func testFailedRequestDoesNotBecomeAnAssistantMessage() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!
            return (response, Data("{\"error\":{\"message\":\"Invalid API key\"}}".utf8))
        }
        let client = OpenAIClient(session: URLSession(configuration: config))
        do {
            _ = try await client.reply(to: [.init(role: .user, text: "hello")], key: "synthetic-test-key", model: "gpt-4o-mini")
            XCTFail("Expected a rejected request")
        } catch {
            XCTAssertTrue(error.localizedDescription.contains("Invalid API key"))
        }
    }
}
