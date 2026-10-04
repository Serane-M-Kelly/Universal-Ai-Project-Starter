# Portes d'une livraison

Appliquer les portes communes, puis celles correspondant à la cible. Une porte non applicable exige une justification ; une porte non exécutée n'est pas réussie.

## Machine d'état

| État | Signification | Autorité de transition |
|---|---|---|
| `proposed` | périmètre et cible en préparation | assistant ou personne |
| `candidate` | source figée, candidat non qualifié | exécutant |
| `ready_to_ship` | contrôles obligatoires réussis | exécutant ou reviewer |
| `approved` | action et cible exactes autorisées | personne humaine |
| `shipped` | résultat externe réussi et vérifié | observation reproductible |
| `partially_shipped` | état externe incomplet ou divergent | observation reproductible |
| `blocked` | prochaine action sûre impossible | exécutant ou reviewer |
| `rolled_back` | retour arrière exécuté et vérifié | observation reproductible |

## Portes communes

- Toutes les unités incluses sont acceptées et inchangées.
- La source, le commit ou l'empreinte du candidat est identifié.
- Le diff ne contient aucun changement inattendu, secret ou fichier privé.
- Lint, typecheck, tests et build applicables ont réellement été exécutés.
- Les critères d'acceptation inclus restent satisfaits.
- La version et les notes correspondent au contenu exact.
- Les dépendances et fichiers de verrouillage sont cohérents.
- La cible, le compte, l'environnement et les personnes affectées sont explicites.
- Les préconditions externes et la configuration attendue sont documentées.
- La stratégie de retour arrière est testée ou justifiée.
- Les contrôles post-livraison et leur responsable sont définis.
- Aucun constat bloquant ou majeur ne reste ouvert.

## Artefact local ou remise

- Le format demandé s'ouvre ou s'exécute dans l'environnement cible.
- L'artefact ne contient ni source privée, ni cache, ni secret, ni fichier local inutile.
- Le nom, la version, la taille et l'empreinte sont enregistrés.
- Le canal et le destinataire exacts sont autorisés avant remise.
- Un accusé de réception ou une preuve de mise à disposition est prévu.

## Registre, store ou distribution

- Le paquet ou bundle respecte les conventions du canal.
- Identifiant, version, droits, métadonnées et notes sont vérifiés.
- La disponibilité du nom ou de la version est contrôlée sans écraser une publication existante.
- Les étapes de validation ou revue du store sont distinguées de la publication réelle.
- Les informations publiques ne révèlent aucune donnée privée.

## Service, staging ou production

- L'environnement ciblé est confirmé et distingué des autres.
- Les migrations sont compatibles, sauvegardées et ordonnées.
- Les variables nécessaires existent sur la cible sans être affichées.
- Les smoke tests couvrent disponibilité, chemin critique et erreurs déterminantes.
- Logs, métriques, alertes et personne de surveillance sont disponibles.
- Le rollback possède un déclencheur, une commande ou procédure et une autorité.

## Variante renforcée

Pour données sensibles, paiements, authentification, migration irréversible, large audience ou forte indisponibilité potentielle :

- revue indépendante du candidat ;
- sauvegarde restaurable démontrée ;
- fenêtre, communication et responsables d'incident définis ;
- critères automatiques d'arrêt ou de rollback ;
- déploiement progressif ou justification de son absence ;
- validation qualifiée sécurité, juridique ou métier lorsque nécessaire.

L'absence d'une preuve obligatoire produit `blocked`, pas une acceptation de risque implicite.
