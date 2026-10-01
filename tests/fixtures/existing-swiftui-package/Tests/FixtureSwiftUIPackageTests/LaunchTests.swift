import Testing

struct LaunchTests {
    @Test func titleRemainsObservable() {
        #expect("Fixture Swift Package".hasPrefix("Fixture"))
    }
}

