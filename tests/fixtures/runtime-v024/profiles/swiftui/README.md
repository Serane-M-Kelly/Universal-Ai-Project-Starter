# Profil SwiftUI Apple

Ce profil transforme le starter universel en cible de travail pour une application SwiftUI sur iOS, iPadOS, macOS, tvOS, watchOS ou visionOS. Il accepte un projet Xcode portant n'importe quel nom ainsi qu'un package Swift.

## Ce qu'il reconnaît

- un dossier `*.xcodeproj`, à la racine ou dans un sous-dossier borné ;
- un manifeste `Package.swift` ;
- au moins un fichier Swift qui importe réellement `SwiftUI` ;
- un point d'entrée natif `@main … : App`, traité comme un avertissement lorsqu'il est absent afin de permettre l'adoption incrémentale dans UIKit ou AppKit ;
- des fichiers de tests Swift usuels sans imposer Swift Testing ou XCTest.

Les répertoires générés comme `.build`, `build`, `DerivedData` et `Pods` ne constituent jamais une preuve. Les liens symboliques ne sont pas suivis.

## Pourquoi les commandes sont manuelles

Le profil ne peut pas déduire honnêtement une commande Xcode complète à partir du seul nom d'un fichier : il faut connaître le projet ou workspace, le scheme partagé, la configuration, la plateforme et la destination. `project-setup` doit inspecter ces éléments, choisir une destination reproductible, exécuter les commandes, puis inscrire uniquement celles qui fonctionnent dans `project.yaml`.

Pour un package Swift autonome, `swift package resolve`, `swift build` et `swift test` peuvent être retenues après vérification. Pour un projet Xcode, les commandes `xcodebuild` doivent identifier explicitement le projet ou workspace, le scheme et la destination.

## Sources de conception

- [SwiftUI](https://developer.apple.com/documentation/swiftui)
- [Le protocole App](https://developer.apple.com/documentation/swiftui/app)
- [Construire et exécuter une application](https://developer.apple.com/documentation/xcode/building-and-running-an-app)
- [Tests dans Xcode](https://developer.apple.com/documentation/xcode/testing)
- [Accessibilité SwiftUI](https://developer.apple.com/documentation/swiftui/accessibility-fundamentals)
- [Protection de la vie privée](https://developer.apple.com/documentation/uikit/protecting-the-user-s-privacy)
- [Commande swift test](https://docs.swift.org/swiftpm/documentation/packagemanagerdocs/swifttest/)
