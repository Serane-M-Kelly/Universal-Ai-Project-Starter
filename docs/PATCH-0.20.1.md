# Correctif 0.20.1

## Pourquoi cette version

Kelly a exécuté la validation sur macOS avec Node 24.10.0 : 178 tests réussis et 16 échecs.
Tous les échecs se produisaient dans la préparation partagée, au chargement de l’état,
avec « Référence hors du workspace ou liée symboliquement ».

Le moteur résolvait le chemin réel du fichier, mais le comparait au chemin non résolu du
workspace. Un alias de dossier parent suffisait donc à faire rejeter une référence interne.
Ce scénario a été reproduit sous Linux avec un lien de dossier parent ; il correspond notamment
aux chemins macOS /var et /private/var. Les journaux de Kelly ne donnent pas le chemin temporaire
exact de son essai. L’ancienne validation Linux seule n’avait pas exposé ce cas.

## Correction

- Résoudre le workspace et le fichier dans le même espace de chemins avant comparaison.
- Réutiliser le contrôle commun d’appartenance au dossier.
- Appliquer la même normalisation à la séparation entre code et workspace, puis aux mutations, au lancement et à l’enregistrement des preuves pour utiliser un chemin stable lors des écritures et des verrous.
- Réessayer au plus trois fois le nettoyage des verrous et des fixtures en cas d’erreur transitoire de suppression ; aucun contournement du verrou actif.
- Conserver le refus d’un fichier d’état lié symboliquement ou d’un dossier intermédiaire qui redirige hors du workspace.
- Ajouter trois tests : cycle complet sous un alias, lien de fichier interdit, redirection intermédiaire interdite.

Le workflow et les neuf skills conservent leurs comportements et leur schéma. Aucun test n’est
retiré, ignoré ou rendu systématiquement réussi. Aucun changement de Node n’est requis pour
corriger cette comparaison.

## Alerte npm

L’audit a identifié fast-uri 3.1.5, dépendance indirecte d’Ajv. Le verrou passe à fast-uri 3.1.7,
sans changement majeur des dépendances. L’[avis officiel](https://github.com/advisories/GHSA-5jgf-p345-68v8)
indique une correction dans la branche 3 à partir de 3.1.6. Le nouvel audit ne signale aucune
vulnérabilité au moment de la vérification ; le résultat complet est joint.

## Refaire le test sur le Mac

Décompresser cette version dans un dossier distinct de l’ancienne. Depuis le dossier 0.20.1 :

```bash
npm ci
npm run validate
npm audit
```

Le nombre attendu est maintenant **197 tests** (194 existants et 3 nouveaux), aucun échec,
puis « Paquet vérifié ». L’audit attendu est sans vulnérabilité signalée.
L’exécution native sur le Mac de Kelly reste à confirmer ; la reproduction locale utilise un
alias de dossier sous Linux. Le contrôle complet a été lancé avec un TMPDIR accessible via
cet alias, afin que les fixtures existantes rencontrent elles aussi ce cas.

Les workspaces et le code des produits ne sont pas modifiés en décompressant ce starter.
Un workspace déjà créé embarque son propre runtime : changer le dossier de distribution
ne remplace pas automatiquement ce runtime. Pour le petit projet jetable, créer un nouveau
dossier de test depuis 0.20.1 ; conserver tout workspace contenant du travail réel.

## Transparence sur les vérifications intermédiaires

Un premier passage complet sous l’alias a corrigé les 16 rejets initiaux et donné 195/197 :
deux tests ont alors signalé une différence d’empreinte du brief. Un contrôle ciblé a reproduit
l’un de ces échecs une fois. La même préparation exécutée étape par étape a montré des empreintes
identiques ; les 21 tests du workflow ont ensuite tous réussi. La cause de ces échecs intermittents
n’a pas été isolée. Les contrôles d’approbation n’ont pas été assouplis et aucun test n’a été ignoré.
Les journaux intermédiaires sont conservés dans docs/validation.

Un passage ultérieur a également rencontré un verrou et un nettoyage de fixture ENOTEMPTY.
Ces observations ont conduit à étendre la normalisation aux mutations et à borner les reprises
de suppression. Elles ne démontrent pas à elles seules la cause de chaque échec intermédiaire.

## Résultat final de cette livraison

Après normalisation étendue et reprises bornées du nettoyage, `npm run validate` avec le
répertoire temporaire habituel de Linux donne **197/197**, aucun échec et paquet vérifié.
Cette passe contient les trois tests qui créent explicitement un parent accessible par un alias.
L’audit npm indique zéro vulnérabilité. Le résultat natif sur le Mac reste à confirmer.
