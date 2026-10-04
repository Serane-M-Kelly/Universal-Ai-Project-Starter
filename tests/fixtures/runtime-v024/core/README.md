# Core

Ce dossier contient les schémas, modèles, contrats et règles indépendants des assistants et des stacks.

Rien dans `core/` ne doit dépendre directement de Claude Code, Codex, Next.js, SwiftUI ou WordPress.

## Structure

- `contracts/` : propriété, autorité et relations entre les éléments ;
- `agents/` : agents universels optionnels et catalogue versionné ;
- `schemas/` : données validables par le CLI ;
- `skills/` : procédures universelles et catalogue versionné ;
- `templates/` : fichiers initiaux d'un workspace.

Le contrat `contracts/product-package.md` et son schéma définissent la frontière versionnée entre Project Architect et le starter. Le cœur conserve le package comme preuve source ; aucun adaptateur ou profil ne peut l'approuver ou le réécrire.
