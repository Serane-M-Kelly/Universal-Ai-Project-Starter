# Version 0.25.1 — Migration du runtime des projets existants

Base : 0.25.0 validée (lot 1, archive SHA-256 `1ca1a5d8…`, inchangée). Seul ajout fonctionnel : la
mise à niveau en place du runtime embarqué d'un workspace 0.24.0 ou 0.25.0, et son annulation.
Aucun projet réel n'a été migré pendant ce lot : la migration pilote reste une décision distincte.

## Pourquoi

Chaque workspace exécute sa propre copie du moteur (`.starter/runtime`). Une nouvelle distribution
ne la met pas à jour. Un runtime 0.24 refuse un `workflow.json` contenant une continuité 0.25 : sans
migration, les projets existants ne peuvent pas utiliser `workflow carry` ni les skills 0.25.

## Utilisation

Depuis le dossier de la distribution 0.25.1, dans un Terminal, **Codex et Claude Code fermés** :

```bash
node dist/index.js workflow runtime-upgrade --workspace "/chemin/ai-workspace" --dry-run
node dist/index.js workflow runtime-upgrade --workspace "/chemin/ai-workspace" --plan EMPREINTE --by "Kelly" --request "Migrer ce projet vers 0.25.1"
```

L'aperçu ne modifie rien. Il liste les fichiers remplacés (runtime, `.starter/WORKFLOW.md`, skills
setup/phase/review/ship et leurs copies Codex/Claude, `project.yaml`), les fichiers jamais écrits,
les personnalisations et incompatibilités, et donne l'empreinte du plan. L'application recalcule le
plan : si un fichier, l'état du suivi, l'historique ou la distribution a changé, elle refuse sans écrire.

Annuler (ou restaurer après une interruption) :

```bash
node dist/index.js workflow runtime-rollback --workspace "/chemin/ai-workspace" --dry-run
node dist/index.js workflow runtime-rollback --workspace "/chemin/ai-workspace" --by "Kelly" --request "Annuler la migration"
```

## Garanties et leur vérification

| Garantie | Mécanisme | Test |
|---|---|---|
| Seuls les fichiers annoncés sont écrits | Tous les autres fichiers du workspace (dont `workflow.json`, `.starter/history`, `BACKLOG.md`, rapports, modèles, réglages et agents natifs) sont relevés par empreinte dans le plan et revérifiés ; tout écart annule la migration | Workspace complet comparé fichier par fichier, avant/après |
| Aperçu exact | L'empreinte du plan couvre ces relevés, les fichiers remplacés, les deux runtimes et le comportement ; elle est exigée à l'application | Suivi ou `PROJECT_STATE.md` modifiés après l'aperçu → refus sans écriture |
| Même comportement | Statut et contexte de chaque phase lus par l'ancien runtime puis par le nouveau : identiques, sinon annulation | Vrai workspace 0.24 (phase acceptée, phase active, essais humains) |
| Diagnostic | Aucun nouveau blocage de `doctor` (le verrou de la migration est exclu de la comparaison) | Avant/après consignés dans le journal |
| Personnalisations | Skill, copie native, `WORKFLOW.md` ou `run.mjs` modifiés, lien symbolique sur un chemin touché → refus, rien n'est écrit. Les commentaires de `project.yaml` sont conservés | Copie retouchée, contrat modifié, liens symboliques, commentaires |
| Jamais de copie partielle | Chaque contenu est préparé et vérifié dans `.starter/migrations/<id>/`, l'ancien est mis de côté, puis le nouveau est renommé en place | Arrêt brutal pendant une mise en place |
| Sauvegarde vérifiée | Vérifiée à la prise, puis de nouveau avant toute restauration ; un fichier déjà dans son état d'origine n'est pas réécrit | Arrêt brutal pendant la sauvegarde : workspace intact, migration abandonnée |
| Jamais un mélange utilisable | Marqueur `.starter/MIGRATION-IN-PROGRESS.json` : le nouveau runtime refuse toute commande ordinaire et `doctor` bloque tant que la migration ou l'annulation n'est ni terminée ni défaite ; entre les deux renommages du runtime, aucun runtime n'existe. Avant le marqueur, l'ancien runtime reste intact et cohérent | Arrêt brutal à sept étapes et par SIGKILL à dix instants arbitraires : retour à l'identique à chaque fois |
| Annulation sans mélange utilisable | Tous les fichiers sont restaurés pendant que le nouveau runtime (qui respecte le marqueur) est en place ; l'ancien runtime, qui ignore le marqueur, ne revient qu'en dernier, sur un état entièrement ancien | Annulation interrompue à cinq étapes, verrou orphelin repris, tentative d'écriture : refusée, ou possible seulement sur l'état entièrement restauré |
| Nettoyage final | Un échec après la vérification finale ne touche ni la sauvegarde ni le journal (« applied ») ; `runtime-upgrade --finish` termine, `runtime-rollback` annule ; seule une opération qui n'a rien appliqué peut être abandonnée | Échec simulé du nettoyage, suivi des deux issues |
| Récupération | Échec → annulation automatique ; arrêt brutal → `runtime-rollback` (abandon si rien n'a été appliqué, restauration sinon), qui reprend aussi une annulation interrompue ; un fichier modifié après l'interruption n'est jamais écrasé ; un verrou orphelin d'une migration arrêtée est repris de façon atomique | Tests dédiés, dont trois récupérations simultanées : une seule agit |
| Retour arrière prudent | Bloqué dès qu'un fichier du workspace a changé depuis la migration, ou qu'un fichier migré a changé. `--accept-state-changes` ne l'autorise que si le suivi actuel est validé par le schéma du runtime précédent (sauvegardé) | Blocage, acceptation explicite d'un état compatible, refus d'un état contenant une continuité |

Les arrêts et échecs sont simulés par des variables d'environnement réservées aux tests
(`STARTER_TEST_INTERRUPT_RUNTIME_UPGRADE`, `STARTER_TEST_FAIL_RUNTIME_UPGRADE`), sans effet en usage
normal. Les lectures de vérification pendant une migration utilisent un nonce aléatoire écrit dans
le marqueur : c'est une protection contre l'usage accidentel, pas un contrôle d'accès.

## Revue adverse (sous-agent Claude, contexte séparé)

Un sous-agent chargé de casser l'outil (même famille de modèle, pas une revue indépendante humaine)
a reproduit trois défauts bloquants, tous corrigés et testés : une récupération après un arrêt
pendant la sauvegarde partait d'une sauvegarde partielle et supprimait de bons fichiers ; une
annulation tuée en pleine copie ne pouvait pas reprendre ; toute migration depuis 0.25.0 échouait.
Également corrigés : liens symboliques non détectés, commentaires de `project.yaml` perdus,
récupérations concurrentes, contournement du marqueur par l'identifiant de migration, empreinte du
plan incomplète. Ses scripts de reproduction, rejoués sur la version corrigée, ramènent tous le
workspace à l'identique.

## Revue ChatGPT (premier passage du lot 2)

Deux défauts bloquants reproduits et corrigés : un échec du nettoyage final passait par l'abandon,
qui supprimait la sauvegarde d'une migration appliquée ; une annulation interrompue réinstallait
l'ancien runtime avant les autres fichiers, laissant une écriture possible sur un mélange de versions.
Tests de non-régression : échec du nettoyage avec ses deux issues, annulation interrompue à cinq
étapes avec tentative d'écriture.

## Ce que la migration ne fait pas

- Elle ne requalifie aucune preuve. Les observations enregistrées par un runtime 0.24 n'ont pas
  l'inventaire nécessaire à `workflow carry` et ne seront jamais conservées par continuité ; celles
  enregistrées par un runtime 0.25.0 en ont un et restent utilisables après migration.
- Elle ne fusionne pas les personnalisations : elles doivent être reportées ou retirées avant.
- Elle ne prend en charge que les runtimes 0.24.0 et 0.25.0 ; un 0.23 est refusé. Le cas 0.25.0 est
  testé avec un runtime 0.25.1 réétiqueté 0.25.0 et, par le relecteur, avec une vraie 0.25.0.
- Elle ne nettoie pas `.starter/migrations/` (journal et sauvegarde, environ la taille du runtime,
  33 Mo avec les dépendances de développement) : à conserver jusqu'à validation du projet migré.
- Elle ne vérifie pas que les assistants sont fermés : c'est à faire avant. Une commande en cours
  est détectée par le verrou d'écriture.
- Comme `workflow init`, elle copie toutes les dépendances de la distribution, y compris celles de
  développement (TypeScript) : environ 33 Mo par runtime.
- Après un arrêt ou un échec juste après la vérification finale (journal « applied », marqueur encore
  présent), le workspace reste inutilisable jusqu'à `runtime-upgrade --finish` ou `runtime-rollback`.

## Procédure pilote proposée

1. Choisir un projet ; sauvegarder le dossier `ai-workspace` (copie privée).
2. `doctor` et `workflow status` avec le runtime actuel ; noter le résultat.
3. `runtime-upgrade --dry-run` ; examiner l'aperçu ; régler les personnalisations éventuelles.
4. Appliquer avec l'empreinte ; relire le résultat (`doctor` avant/après, comportement identique).
5. Ouvrir l'assistant, `project-start` ; vérifier la reprise réelle.
6. En cas de doute : `runtime-rollback --dry-run`, puis annulation.

## Limites

- Les tests utilisent le runtime 0.24.0 d'origine (fixture) pour créer de vrais workspaces, avec Codex
  et Claude Code installés ; aucun projet réel de Kelly n'a été migré, aucune session d'assistant lancée.
- La comparaison de comportement porte sur `status` et `context` de chaque phase ; d'autres sorties
  (rapports compacts, vues) ne sont pas comparées une à une.
- `.starter/history` et `workflow.json` ne sont pas infalsifiables ; la migration vérifie qu'elle ne
  les modifie pas, pas qu'ils n'ont jamais été modifiés.
