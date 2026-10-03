import SwiftUI

struct ContentView: View {
    @ObservedObject var model: ChatViewModel
    @State private var draft = ""
    @State private var showingHistory = false
    @State private var showingSettings = false
    @FocusState private var composerFocused: Bool

    private var hasUnsentDraft: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if let loadError = model.loadError {
                    ContentUnavailableView(
                        "Conversations unavailable",
                        systemImage: "externaldrive.badge.exclamationmark",
                        description: Text(loadError)
                    )
                } else {
                    conversationBody
                    composer
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Pensieve")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showingHistory = true } label: {
                        Label("Past conversations", systemImage: "clock.arrow.circlepath")
                    }
                    .disabled(hasUnsentDraft || model.isGenerating)
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { newConversation() } label: {
                        Label("New conversation", systemImage: "square.and.pencil")
                    }
                    .disabled(hasUnsentDraft || model.isGenerating)
                    Button { showingSettings = true } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                }
            }
            .sheet(isPresented: $showingHistory) { historySheet }
            .sheet(isPresented: $showingSettings) { SettingsView(archiveURL: model.archiveURL) }
        }
    }

    private var conversationBody: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let conversation = model.selectedConversation, !conversation.messages.isEmpty {
                        Text("聊一会儿")
                            .font(.title2.weight(.semibold))
                            .padding(.top, 16)
                        ForEach(conversation.messages) { message in
                            messageRow(message)
                                .id(message.id)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("今天，想聊些什么？")
                                .font(.title2.weight(.semibold))
                            Text("从一句话开始就好。")
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 80)
                    }
                    if model.isGenerating {
                        ProgressView("正在思考…")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if let error = model.errorMessage {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(error).foregroundStyle(.red)
                        }
                        .font(.footnote)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.white, in: RoundedRectangle(cornerRadius: 14))
                    }
                    if model.selectedConversation?.messages.last?.role == .user {
                        Button("生成 / 重试 AI 回复") { model.retryLastReply() }
                            .disabled(!model.canRetryLastReply)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 20)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .onChange(of: model.selectedConversation?.messages.count) { _, _ in
                if let last = model.selectedConversation?.messages.last?.id {
                    withAnimation { proxy.scrollTo(last, anchor: .bottom) }
                }
            }
            .task(id: model.selectedID) {
                await Task.yield()
                if let last = model.selectedConversation?.messages.last?.id {
                    proxy.scrollTo(last, anchor: .bottom)
                }
            }
        }
    }

    private func messageRow(_ message: ConversationMessage) -> some View {
        HStack {
            if message.role == .user { Spacer(minLength: 36) }
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(message.role == .user ? "你" : "Pensieve")
                    Spacer()
                    Text(message.createdAt, style: .time)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                Text(message.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
            .padding(message.role == .user ? 16 : 8)
            .background(
                message.role == .user ? Color(uiColor: .secondarySystemGroupedBackground) : .clear,
                in: RoundedRectangle(cornerRadius: 20)
            )
            if message.role == .assistant { Spacer(minLength: 16) }
        }
        .accessibilityElement(children: .combine)
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextEditor(text: $draft)
                .focused($composerFocused)
                .frame(minHeight: 76, maxHeight: 130)
                .scrollContentBackground(.hidden)
                .accessibilityLabel("此刻想说的话")
                .overlay(alignment: .topLeading) {
                    if draft.isEmpty {
                        Text("此刻想说的话…")
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 5)
                            .allowsHitTesting(false)
                    }
                }
            HStack {
                Text("原文先保存到设备")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("发送") {
                    if model.send(draft) {
                        draft = ""
                        composerFocused = false
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isGenerating)
            }
        }
        .padding(14)
        .background(.white, in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color(uiColor: .separator)))
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
    }

    private var historySheet: some View {
        NavigationStack {
            List {
                Button("新聊天") {
                    newConversation()
                    showingHistory = false
                }
                ForEach(model.conversations) { conversation in
                    Button {
                        model.select(conversation.id)
                        draft = ""
                        showingHistory = false
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(conversation.title).foregroundStyle(.primary)
                            Text(conversation.updatedAt, style: .date)
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("过去的聊天")
            .toolbar { Button("完成") { showingHistory = false } }
        }
    }

    private func newConversation() {
        guard !hasUnsentDraft, !model.isGenerating else { return }
        model.select(nil)
        draft = ""
        composerFocused = true
    }
}
