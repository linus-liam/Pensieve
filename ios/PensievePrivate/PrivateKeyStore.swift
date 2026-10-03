import Foundation
import Security

enum PrivateKeyStore {
#if targetEnvironment(simulator)
    // Simulator installs made with simctl have no app identifier entitlement.
    // Keep a test key in memory so it is never written to an unprotected file.
    private static var simulatorKey: String?

    static func read() -> String? { simulatorKey }
    static func save(_ key: String) throws { simulatorKey = key }
    static func delete() { simulatorKey = nil }
#else
    private static let service = "com.linusliam.pensieve.private-ai"
    private static let account = "openai-api-key"

    static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func save(_ key: String) throws {
        let data = Data(key.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var add = query
            attributes.forEach { add[$0.key] = $0.value }
            let addStatus = SecItemAdd(add as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw KeyStoreError.saveFailed(addStatus)
            }
        } else if status != errSecSuccess {
            throw KeyStoreError.saveFailed(status)
        }
    }

    static func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
#endif
}

enum KeyStoreError: LocalizedError {
    case saveFailed(OSStatus)
    var errorDescription: String? {
        switch self {
        case .saveFailed(let status):
#if DEBUG
            return "The API key could not be saved on this device (Keychain status \(status))."
#else
            return "The API key could not be saved on this device."
#endif
        }
    }
}
