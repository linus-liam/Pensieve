import SwiftUI

struct ContentView: View {
    @ObservedObject var model: ChatViewModel
    @State private var draft = ""
    @State private var showingHistory = false
    @State private var showingSettings = false
    @State private var pendingDeletion: Conversation?
    @FocusState private var composerFocused: Bool

    private var hasUnsentDraft: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            Group {
                if let loadError = model.loadError {
                    ContentUnavailableView(
                        "Conversations unavailable",
                        systemImage: "externaldrive.badge.exclamationmark",
                        description: Text(loadError)
                    )
                } else {
                    conversationBody
                        .safeAreaInset(edge: .bottom, spacing: 0) {
                            composer
                        }
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
                        .background(
                            Color(uiColor: .secondarySystemGroupedBackground),
                            in: RoundedRectangle(cornerRadius: 14)
                        )
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
            .scrollDismissesKeyboard(.interactively)
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
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .bottom, spacing: 8) {
                TextField("此刻想说的话…", text: $draft, axis: .vertical)
                    .lineLimit(1...4)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(
                        Color(uiColor: .secondarySystemGroupedBackground),
                        in: RoundedRectangle(cornerRadius: 18)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 18)
                            .stroke(Color(uiColor: .separator), lineWidth: 0.5)
                    }
                    .focused($composerFocused)
                    .accessibilityLabel("此刻想说的话")

                Button("发送") {
                    if model.send(draft) {
                        draft = ""
                        composerFocused = false
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.regular)
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isGenerating)
            }

            Text("原文先保存到设备")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .padding(.leading, 12)
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(.bar)
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
                .onDelete { offsets in
                    guard let index = offsets.first else { return }
                    pendingDeletion = model.conversations[index]
                }
            }
            .navigationTitle("过去的聊天")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { EditButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { showingHistory = false }
                }
            }
            .alert(
                "删除这段聊天？",
                isPresented: Binding(
                    get: { pendingDeletion != nil },
                    set: { if !$0 { pendingDeletion = nil } }
                ),
                presenting: pendingDeletion
            ) { conversation in
                Button("删除", role: .destructive) {
                    if model.deleteConversation(conversation.id) {
                        pendingDeletion = nil
                    }
                }
                Button("取消", role: .cancel) { pendingDeletion = nil }
            } message: { conversation in
                Text("“\(conversation.title)”会从这台 iPhone 永久删除。")
            }
        }
    }

    private func newConversation() {
        guard !hasUnsentDraft, !model.isGenerating else { return }
        model.select(nil)
        draft = ""
        composerFocused = true
    }
}
