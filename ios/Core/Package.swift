// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "PensieveCore",
    platforms: [.macOS(.v13), .iOS(.v17)],
    products: [.library(name: "PensieveCore", targets: ["PensieveCore"])],
    targets: [
        .target(name: "PensieveCore"),
        .testTarget(name: "PensieveCoreTests", dependencies: ["PensieveCore"])
    ]
)
