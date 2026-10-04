# Version 0.25.0 — Revalidations proportionnées et README public adaptable

Base : 0.24.0. Réglages et agents Codex/Claude générés inchangés ; les neuf skills actifs sont
conservés, quatre sont complétés et changent de version. Aucun nouveau skill, service ou serveur MCP.

## Diagnostic de la 0.24

- Chaque preuve porte `code` = SHA-256 de l'inventaire complet du dossier applicatif (chemins et
  contenus, hors `.git`, `node_modules`, sorties de build). `phaseStatus` ne compte une preuve que si
  ce `code` est identique à l'arbre actuel. Une modification de `README.md` périme donc tous les
  contrôles, la revue **et les essais humains** : la tâche humaine redevient « à faire ».
- Le moteur ne gardait que l'empreinte globale : il ne pouvait pas savoir ce qui avait changé.
- `reopen` et une nouvelle approbation du brief incrémentent `iteration`, qui fait partie du contrat :
  les essais sont aussi invalidés par ce chemin. Après acceptation, `prepare-commit` exige une revue
  sur la révision exacte ; une retouche du README impose donc une réouverture, puis un nouvel essai.

## Changements

- **Inventaire de la révision observée.** `workflow observe` enregistre, en plus de l'empreinte,
  l'inventaire exact `chemin → sha256` dans `reports/trees/<empreinte>.json`. Son intégrité se
  vérifie par l'empreinte elle-même ; un inventaire modifié est refusé.
- **Continuité d'un essai humain (`workflow carry`).** `--dry-run` calcule le diff entre la révision
  observée et l'actuelle, le classe et liste les événements depuis l'essai (réouverture, plan, brief).
  L'enregistrement exige que chaque chemin changé soit déclaré (`--path`) et que les critères
  concernés, la justification, les contrôles effectués et les limites soient renseignés. Il ajoute à
  `workflow.json` une preuve `kind: "continuity"` liée à l'observation d'origine (`origin`), avec un
  rapport : preuve d'origine, révisions comparées, changements, critères, justification, contrôles
  déclarés et enregistrés sur la révision, limites, revue la plus récente, signaux examinés.
- **Ce qui reste exact.** Contrôles automatiques, revue indépendante, acceptation, `prepare-commit`
  et `verify-commit` restent liés à la révision exacte. La continuité ne crée ni observation ni revue,
  ne rend pas une acceptation à la nouvelle révision et n'efface pas une revue négative.
- **Vue et lecture compacte.** BACKLOG.md signale « essai antérieur conservé après examen des
  changements » ; `context --compact` garde l'observation d'origine visible (`continuity_origins`).
- **README public du produit.** Guide conditionnel `core/contracts/product-readme.md` (socle en sept
  blocs adaptable, extensions conditionnelles, règles, procédure pour un nouveau projet et reprise
  conservatrice d'un README existant). Raccordé à Setup, Phase, Review et Ship, sans relecture à chaque
  retouche. `workflow readme-check` signale en lecture seule liens/ancres absents, commandes absentes de
  la configuration (scripts, verrou, Makefile, Composer…), variables d'exemple, secrets probables,
  vocabulaire de pilotage, affirmations sans trace ou contredites, licences divergentes, attributions
  non référencées et, avec `--previous-ref`/`--previous`, informations retirées. Code de sortie 0.
- Skills : project-setup v7, project-phase v5, project-review v5, project-ship v5, runtime minimal 0.25.0.

## Règles de continuité appliquées par le moteur

| Refusé (contrôle requis présenté) | Motif |
|---|---|
| Code, configuration, dépendances, verrous, assets visuels, styles, polices | Changement susceptible d'affecter l'essai : relancer les contrôles et refaire l'essai. |
| Licences et mentions (LICENSE, NOTICE, CREDITS, confidentialité, RGPD, cookies, conditions… partout dans le nom) | Obligations à vérifier ; aucune continuité automatique. |
| Document supprimé ou déplacé | Contenu d'origine non inspectable. |
| Markdown avec frontmatter, ou sous `src/`, `lib/`, `public/`, `static/`, `content/`, `pages/`, `app/`, `blog/`, `assets/`, `templates/`, `prompts/`, `help/`, `data/`… | Page ou contenu probablement publié ou lu par le produit. |
| Fichier du produit (code, configuration, scripts de build de package.json) mentionnant l'extension (`*.md`, `` `${nom}.md` ``, `/\.md$/`…), le chemin, le nom du document ou son dossier | Lecture ou copie possible par le produit. Sont seuls ignorés : les fichiers de réglage des formateurs/linters ; un script `package.json` réduit à une seule commande de formateur au nom exact (prettier, eslint, markdownlint, cspell, vale, textlint, stylelint, lint-staged), sans sortie `-o`/`--output`, chaînage, redirection ni substitution ; les commentaires occupant des lignes entières en JavaScript/TypeScript (hors JSX), Python et shell, reconnus par un analyseur qui suit chaînes, gabarits et expressions régulières, et sans marqueur de directive (`@`, `webpack`, `vite`, `import`, `glob`, `go:`, `#`, `$(`…). Restent toujours analysés : toute ligne contenant aussi du code, les autres langages (Go, PHP, Ruby, Makefile, JSX/Vue/Svelte/Astro, YAML, TOML, HTML…), les heredocs, les constructions non terminées et les fichiers aux fins de ligne inhabituelles (`\r` seul, U+2028/2029). Le champ `files` de package.json est analysé. |
| Générateur ou publication de site détecté à toute profondeur (`_config.yml`, Eleventy, VitePress, VuePress, Hugo, mdBook, Sphinx, Antora, `.nojekyll`, `CNAME`, Docsify) pour son dossier ; `mkdocs.yml`/Docusaurus pour ses `docs/` et `blog/` | Les Markdown peuvent être des pages publiées. |
| Tâche, objectif, critère ou observation d'origine portant sur la documentation (README, installation, guide, notice, nom du document modifié…) | L'essai vérifiait ce document : nouvel essai. |
| Réouverture ou réinitialisation depuis l'essai sans acceptation retrouvée de **cette phase à cette itération** dans les instantanés de l'état (`.starter/history`), avec une revue indépendante couvrant la révision observée et identique dans l'état actuel ; dépendance acceptée de nouveau après l'essai | Le motif de réouverture peut concerner l'essai ; il est cité dans le refus. Un `accept` d'une autre phase ne suffit jamais ; l'historique de l'instantané doit être un préfixe de l'historique actuel. |
| Restauration d'état (`restore-state`) depuis l'essai ; motif de réouverture mentionnant l'essai, un test, un défaut ou « à refaire » | Un essai échoué ou une acceptation annulée ont pu être effacés ; le motif met en cause le résultat. |
| Critères, tâches, dépendances ou sources épinglées modifiés ; brief réapprouvé après l'essai ; référence épinglée changée | Le contrat de l'essai a changé. |
| Observation plus récente sur la même tâche (y compris un échec) ; observation non réussie ; rapport modifié ; inventaire absent ou modifié | Rien à conserver de façon sûre. |

Seuls restent conservables les documents `.md`, `.markdown`, `.rst`, `.adoc` modifiés ou ajoutés sans
ces signaux. La continuité ne traverse une réouverture que si les critères sont identiques (contrat
recalculé aux itérations précédentes) et si l'acceptation de cette phase à cette itération, appuyée
sur une revue indépendante de la révision observée, est retrouvée dans les instantanés de l'état :
cas d'une correction du README après acceptation, nécessaire pour préparer le commit. Le chemin de
l'instantané figure dans l'aperçu et le rapport (`acceptance_snapshot`). Les
événements depuis l'essai et leurs motifs figurent dans l'aperçu, le rapport et tout refus.

## Revue distincte

Revue réalisée par un sous-agent Claude (même famille de modèle, contexte séparé, lecture seule) :
ce n'est pas une revue indépendante humaine. Un défaut bloquant a été confirmé et corrigé : des
Markdown lus dynamiquement par le produit (gabarit `${nom}.md`, f-string Python, filtre `/\.md$/`,
copie par un script de build) étaient classés conservables. Corrigés également : générateurs dans un
sous-dossier, réouverture non acceptée franchie, essai portant sur la documentation, `readme-check`
interrompu par un encodage `%` invalide, licence « This package is released under… » ignorée, noms
de mentions légales, message après réouverture, identifiant d'origine absent de la vue compacte.
Chaque point a un test de non-régression. Ajustement ensuite vérifié sur Calepio : ses commentaires
`docs/calcul.md` ne bloquent plus la continuité.

## Revue finale ChatGPT (premier passage)

Trois contournements reproduits par ChatGPT, tous bloquants et corrigés :
1. Le filtre de commentaires retirait toute ligne *commençant* par un commentaire, y compris
   `/* affichage */ console.log(fs.readFileSync('docs/value.md'))`. Remplacé par un analyseur par
   langage qui ne retire que des commentaires occupant des lignes entières (`comment-lines.ts`).
2. Un script commençant par un formateur (`prettier --check . && cp docs/value.md dist/`) était
   ignoré en entier. Seule une commande de formateur isolée l'est désormais.
3. L'acceptation d'une autre phase satisfaisait la condition de réouverture (les événements ne
   portent pas l'identité de la phase). L'acceptation est désormais recherchée dans les instantanés
   de l'état pour cette phase, cette itération et la révision observée.

Tests de non-régression : les scénarios de ChatGPT et quatre variantes trouvées en corrigeant
(gabarit multiligne commençant par `//`, chaîne Python triple, heredoc shell, code après la fin d'un
bloc de commentaire) échouaient tous sur la livraison précédente et sont refusés désormais.
`readme-check` précise en tête de ses limites que l'absence d'avertissement ne prouve pas que le
README est exact ou complet.

## Revue adverse des corrections (sous-agent Claude, contexte séparé)

Ces corrections ont été relues par un nouveau sous-agent Claude chargé de les contourner (même
famille de modèle, pas une revue indépendante humaine). Il a reproduit, parfois en exécutant `node`,
`python3` ou `ruby`, 14 classements à tort et un contournement par restauration d'état. Tous sont
corrigés en restreignant le filtrage plutôt qu'en ajoutant des exceptions :
- commentaires exécutés ou lus par un outil : `//go:embed`, annotations PHP, commentaires magiques
  webpack, texte JSX `//{…}` ; interpolation Ruby `#{…}` en heredoc `<<~` ou `%()`, heredoc shell
  `<<\EOF` ; fins de ligne `\r` seul et U+2028 → filtrage limité à JS/TS sans JSX, Python et shell,
  sans marqueur de directive ni fin de ligne inhabituelle ;
- scripts `remark … -o`, `prettier-copy …`, `eslint … -o` et champ `files` de package.json ;
- restauration d'état effaçant un essai échoué ou une acceptation (instantané d'une chronologie
  annulée) ; réouverture motivée par un essai faux.
Les 14 cas étaient conservés à tort par la première livraison ; tous sont refusés et testés.
Calepio reste conservable pour une réorganisation du README. Risque résiduel jugé acceptable par le
relecteur : une réouverture d'une phase acceptée sans motif explicite, puisque la revue indépendante
et une nouvelle acceptation restent exigées.

## Utilisation

```bash
node .starter/run.mjs workflow carry 1 --proof e-5 --dry-run
node .starter/run.mjs workflow check 1 --task t-2 --by builder --request "Contrôles après correction du README" -- npm test
node .starter/run.mjs workflow carry 1 --proof e-5 --path README.md --path docs/architecture.md \
  --criteria "Essai réel du simulateur : répartition affichée" \
  --reason "Réorganisation du README et nouvelle page d'architecture, non lues ni rendues par le site" \
  --checks "readme-check sans erreur ; npm test relancé" --limits "Réglages d'hébergement non visibles dans le dépôt" \
  --by coordinateur --request "Corrige le README sans me refaire tester"
```

Puis revue distincte du changement et de la continuité, et acceptation. Essai sur une copie de
Calepio (lecture seule) : README et `docs/architecture.md` modifiés sont conservables ; une retouche
de `src/data/landing.ts` est refusée.

## Compatibilité et mise à niveau

- **Nouveaux projets** : `workflow init` avec cette distribution ; tout est actif.
- **Workspaces existants** : la mise à jour de la distribution ne change pas leur runtime embarqué
  (`.starter/runtime`), qui valide `workflow.json` avec son propre schéma. La 0.25 lit leur état sans
  le modifier ni requalifier leurs preuves. `carry` y est refusé sans rien écrire tant que le runtime
  embarqué est antérieur à 0.25.0, car la 0.24 ne saurait plus relire l'état. Une observation
  enregistrée avec le CLI 0.25 (`--workspace`) y garde un état lisible par la 0.24 (testé) et dispose
  d'un inventaire. Les observations antérieures n'en ont pas : elles ne sont jamais conservées. La
  mise à niveau des skills modifiés y est refusée par le mécanisme existant (`phase_runtime_min`).
  Ce lot ne fournit pas de mise à jour en place du runtime embarqué : c'est une décision à prendre.
  Une fois un état 0.25 avec continuité créé, ne plus utiliser un CLI 0.24 dessus : il le jugerait
  invalide et conseillerait une restauration qui ferait perdre des preuves valides.
- **README d'un produit existant** : `node /chemin/distribution-0.25/dist/index.js workflow readme-check
  --code-root /chemin/du/depot --previous-ref HEAD` fonctionne sur tout dépôt, en lecture seule. La
  reprise suit la procédure du guide, dépôt par dépôt, avec aperçu avant écriture.

## Limites

- Le moteur vérifie fichiers, empreintes et signaux détectables dans le dépôt ; il ne comprend pas
  l'effet métier. Les réglages extérieurs au dépôt (hébergeur, CMS, GitHub Pages configuré dans
  l'interface) et les lectures dynamiques sans chemin explicite ne sont pas visibles : la justification
  et la revue restent nécessaires, et le doute impose un nouvel essai.
- Les heuristiques sont prudentes : une mention de `.md`, du nom ou du dossier d'un document dans une
  ligne de code, un script ou un workflow CI suffit à refuser (refus possibles à tort). À l'inverse,
  une lecture construite sans aucune de ces mentions (extension calculée, liste téléchargée) n'est pas
  détectable : la justification et la revue restent nécessaires.
- Un ajout de tâche (`task-add`) modifie le contrat : les essais de la phase ne sont pas conservés.
- Les instantanés `.starter/history` servent de preuve d'acceptation après réouverture : comme
  `workflow.json`, ils ne sont pas infalsifiables. Les supprimer ne peut que provoquer un refus.
- `readme-check` : l'absence d'avertissement ne prouve pas que le README est exact ou complet.
- `readme-check` n'exécute pas les commandes, n'ouvre pas les liens externes et repère licences et
  affirmations par motifs. Il ne vaut pas preuve. Les commandes de test des fixtures `npm test` et
  `pnpm test` ont été exécutées ; Composer/PHPUnit n'étaient pas installés pour la fixture WordPress.
- Aucune session Codex ou Claude Code n'a été lancée : l'usage réel de `carry` et du guide par les
  skills reste à observer.
