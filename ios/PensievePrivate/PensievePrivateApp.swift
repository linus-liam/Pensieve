import SwiftUI

@main
struct PensievePrivateApp: App {
    @StateObject private var model = ChatViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
        }
    }
}
