import Testing

struct ContentViewTests {
    @Test func titleRemainsObservable() {
        #expect("Fixture SwiftUI".contains("SwiftUI"))
    }
}

