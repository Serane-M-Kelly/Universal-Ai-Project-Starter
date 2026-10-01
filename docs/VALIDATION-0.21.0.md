# Vérification de la distribution 0.21.0

Exécutée le 15 septembre 2026 sous Linux avec Node.js 24.19.0.

`npm run validate` : code de sortie 0.
- Compilation TypeScript stricte sans émission : réussie.
- Compilation et suite de tests : **207 réussis, 0 échec**, aucun ignoré.
- Contenu du paquet npm : vérifié, version 0.21.0.

Les dix nouveaux tests du module vérifient les lectures déterministes, la conservation des
avertissements et formats inconnus, les contrôles échoués et les sources modifiées pendant un
contrôle, les rapports altérés/manquants/liés symboliquement, la restitution Unicode complète par
extraits, les observations humaines, les revues négatives, les preuves historiques, les empreintes
du brief et les mesures de volume. Les contrôles historiques du starter restent dans la suite.

Le benchmark a réellement exécuté 400 tests simples dans une fixture temporaire. Il mesure du texte,
pas l’utilité du produit ni les tokens d’une séance avec un modèle. Résultats : CONTEXT-BENCHMARK.json.

Cette validation n’a pas lancé Codex ou Claude Code sur le Mac de Kelly, ni les applications iOS/macOS.
Le prochain essai utilisateur reste nécessaire pour vérifier que l’agent utilise bien ces vues et
que la reprise reste aussi compréhensible. Aucun runtime de ses projets existants n’a été remplacé.
