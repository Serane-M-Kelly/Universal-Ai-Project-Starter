# Démarrer avec le starter 0.25.0

La distribution contient les sources, le programme compilé, les dépendances et les neuf skills.
Node.js 22 ou supérieur suffit. Aucun RTK externe ni nouvelle installation globale.

## Premier essai dans un nouveau projet

Depuis le dossier décompressé du starter, choisis une destination qui n’existe pas encore :

```bash
node dist/index.js workflow init ../pilote-contexte-v024 --name "Pilote contexte" --owner "Kelly"
cd ../pilote-contexte-v024/ai-workspace
codex
```

Avec Claude Code, ou les deux assistants sur le même workspace :

```bash
node dist/index.js workflow init ../pilote-claude-v024 --name "Pilote Claude" --owner "Kelly" --adapter codex,claude-code
cd ../pilote-claude-v024/ai-workspace
claude
```

À la première ouverture, Claude Code présente le dossier applicatif ajouté et les réglages du projet :
vérifier que le chemin est bien `../app` (ou ta copie), accepter, puis taper `/project-start`.
`/agents` doit lister planner, builder, reviewer, implementer et reader ; `/model` montre le modèle
de la session.

Dans Codex, donne une demande ordinaire :

```text
$project-start
Je veux une liste de tâches locale : ajouter, cocher, supprimer et conserver après rechargement.
Sans compte, serveur ou déploiement. Prépare le projet et propose un plan simple à valider.
```

Laisse Start retrouver ce qui manque, puis valide les vrais choix qu’il présente. Next recommande
la suite, Phase réalise la phase choisie, Review vérifie et organise les corrections. Donne ton
essai réel quand l’agent le demande. Ferme la session, ouvre-en une nouvelle et appelle Start :
il doit retrouver les acquis et le mandat. Tu n’as aucune nouvelle syntaxe de pilotage à apprendre.

Pour voir la différence, tu peux demander à l’agent : « Compare la taille de la vue compacte et
de l’original pour le rapport de tests que tu viens d’enregistrer. Montre aussi ce qui a été masqué. »
S’il n’existe que peu de tests ou d’historique, un gain nul est normal.

## Vérification reproductible du module

Dans un autre Terminal, depuis le dossier du starter :

```bash
npm run validate
node scripts/benchmark-context.mjs
```

La seconde commande utilise un projet temporaire synthétique qu’elle supprime ensuite. Elle ne
modifie pas ton pilote. Elle mesure le volume de lecture et son surcoût lorsque tous les détails
sont ensuite ouverts ; elle ne mesure pas ta facture.

## Corriger un README après tes essais (0.25)

Dans un projet créé avec cette version, si tu demandes « Corrige le README sans me refaire tester »,
l'agent examine les changements avec `workflow carry --dry-run`. Si seuls des documents non utilisés
par le produit ont changé, ton essai précédent est conservé (tes mots et sa date restent intacts) ;
sinon il te dit précisément quoi revérifier. La revue et ton acceptation restent demandées.
Pour un README de produit, l'agent suit le [guide README](core/contracts/product-readme.md).

## Ton workspace 0.24 existant

Son runtime embarqué reste en 0.24 : il garde le comportement prudent (nouvel essai après toute
modification). Cette distribution peut contrôler un README de n'importe quel dépôt, en lecture seule :

```bash
node dist/index.js workflow readme-check --code-root "/chemin/du/depot" --previous-ref HEAD
```

`carry` y est refusé sans rien écrire : voir [les notes 0.25](docs/RELEASE-0.25.0.md#compatibilité-et-mise-à-niveau).

## Changer d'assistant en cours de projet

Dans un Terminal, aucune session ouverte, depuis `ai-workspace` :

```bash
node .starter/run.mjs workflow adapter-add claude-code --dry-run
node .starter/run.mjs workflow adapter-add claude-code
node .starter/run.mjs doctor . --compact
claude
```

Puis `/project-start`. Pour revenir à Codex : `codex` puis `$project-start` (après
`workflow adapter-add codex` si Codex n'était pas installé). Le plan, la phase active, son mandat et
ses preuves sont partagés ; seule la conversation repart de zéro. Ne jamais ouvrir les deux en même temps.

## Ton workspace 0.23 où les skills Claude manquent

Le runtime 0.23 copié dans ce workspace ne connaît pas la réparation : utiliser ce starter 0.24 en
lui indiquant le workspace (adapter les chemins). L'aperçu ne modifie rien.

```bash
node dist/index.js workflow adapter-add claude-code --workspace "/chemin/ai-workspace" --dry-run
node dist/index.js workflow adapter-add claude-code --workspace "/chemin/ai-workspace"
```

Si un conflit est listé, rien n'a été écrit : reporter la personnalisation (voir
[les notes 0.24](docs/RELEASE-0.24.0.md)), puis relancer.

## Ton workspace actuel 0.20.x, 0.21.x ou 0.22.x

Tu peux essayer les vues avec le CLI de cette distribution et `--workspace`, sans modifier ton
installation existante. Voir [les commandes et limites](docs/CONTEXT-0.21.0.md).
Les [notes 0.23](docs/RELEASE-0.23.0.md) précisent les références PA/AD et les restrictions de mise à niveau.
**N’exécute pas une migration legacy sur le workspace v3 que tu viens de tester.**
La nouvelle archive ne met pas à jour automatiquement les runtimes déjà copiés dans tes projets.

## Anciens pilotes seulement (Python v0.1.1 ou backlog historique v2)

La procédure ci-dessous concerne uniquement ces formats anciens.

## Reprendre ton pilote Télécommande

Décompresse l’archive. Dans Terminal, ouvre le dossier décompressé du starter. Ferme la session
de l’ancien pilote. Adapte les deux chemins ci-dessous si tes dossiers sont ailleurs.

```bash
node dist/index.js workflow migrate --source "../telecommande-pilote-v011/ai-workspace" --target "../telecommande-v020" --dry-run
```

Cette commande décrit la conversion. Si les chemins affichés correspondent à ton pilote :

```bash
node dist/index.js workflow migrate --source "../telecommande-pilote-v011/ai-workspace" --target "../telecommande-v020"
cd ../telecommande-v020/ai-workspace
codex
```

La migration crée un nouveau workspace et archive le précédent. Elle conserve le chemin du code
utilisé par le pilote : **elle ne copie pas l’application**. Pour tester sur une autre copie, crée
cette copie avant de travailler, puis demande à l’agent de mettre le chemin à jour avec relocate.

Dans Codex :

```text
$project-start
```

Le premier Start doit examiner le plan importé et les anciens résultats, puis te présenter les
seuls écarts utiles. Les anciennes preuves restent historiques : l’agent doit examiner ce qu’elles
couvrent aujourd’hui. Tu n’as ni fichier JSON ni backlog à modifier toi-même.

## Ton essai en cinq gestes

1. **Start** : vérifier que le résultat acquis et la prochaine action sont compréhensibles.
2. **Next** : obtenir la phase recommandée, son résultat attendu et le spécialiste utile.
3. **Phase** : lancer le numéro proposé ; laisser l’agent implémenter, tester et corriger dans ce périmètre.
4. **Review** : obtenir la revue distincte et les corrections nécessaires. Si un test sur appareil est requis, donner ton observation réelle.
5. **Reprise** : fermer la session, en ouvrir une nouvelle dans le même ai-workspace et appeler Start. Il doit retrouver le mandat et les résultats.

Pour ajouter une idée : « Ajoute le contrôle du volume pour la suite. » L’agent adapte le plan.
Si cet ajout est indépendant, la phase actuelle conserve son autorisation. S’il change l’objectif
actif, l’agent explique ce qu’il faut arbitrer.

Si tu acceptes le résultat, dis-le simplement. Pour le commit, appelle Project Ship ou dis :
« Prépare le commit de cette phase. » Il fournit les commandes exactes ; tu les exécutes toi-même.
Il vérifie ensuite le commit réel. L’acceptation n’est pas un commit, et un commit n’est pas un push.

## Démarrer un autre produit

Depuis le starter décompressé :

```bash
node dist/index.js workflow init ../mon-projet --name "Mon produit" --owner "Kelly"
cd ../mon-projet/ai-workspace
codex
```

Fournis le dossier Project Architect puis appelle Start. Discover, Handoff, Setup et Plan servent
à compléter la préparation ; les acquis suffisants peuvent être réutilisés dans la même demande.
Le [README](README.md) décrit les profils, les modèles, les limites et les autres modes d’entrée.

## Pour un site public

À Start, fournir les décisions PA/AD déjà disponibles et préciser les pages publiques, langues
et éventuels changements de domaine ou d’URL. Le starter complète les seuls manques utiles.
Le [parcours SEO](docs/SEO-WORKFLOW.md) explique les contrôles de réalisation, de publication
et le suivi. Un essai privé de liste de tâches n’a pas besoin de ce parcours.
