// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FixtureSwiftUIPackage",
    platforms: [.macOS(.v15)],
    products: [
        .executable(name: "FixtureSwiftUIPackage", targets: ["FixtureSwiftUIPackage"]),
    ],
    targets: [
        .executableTarget(name: "FixtureSwiftUIPackage"),
        .testTarget(
            name: "FixtureSwiftUIPackageTests",
            dependencies: ["FixtureSwiftUIPackage"]
        ),
    ]
)

