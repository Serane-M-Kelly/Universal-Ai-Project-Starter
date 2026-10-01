# Exercices de comportement — 0.23

Date : 1er octobre 2026. Trois agents en contextes neufs, sans historique du coordinateur, ont lu les sources sous évaluation. Aucune publication, donnée Search Console réelle ou vérification de référencement de produit n’a eu lieu.

## PA — refonte d’un salon

Demande fournie : salon Lune Hair vers Atelier Lune, prestations conservées, nouveau domaine, ajout de l’anglais, cinq pages publiques et dashboard privé ; pas d’export Search Console, pas d’accès externe. Préparer la transmission AD/starter sans refaire une étude de marché.

Résultat observé : inventaire et correspondances des URL à établir, hypothèse du nombre de pages explicitée, baseline absente signalée, brief AD et critères starter distincts. Le dashboard demeure privé. La réponse réutilise PRODUCT_STRATEGY, EVIDENCE_REGISTER, PROTOTYPE_BRIEF, BUILD_HANDOFF et OPEN_QUESTIONS, sans prétendre avoir assemblé un package ou réalisé une migration.

## AD — page publique minimale

Demande fournie : prompt Claude Design pour Tresses classiques, 90 CAD, environ trois heures, cheveux à fournir, réservation, palette crème/marron ; proposition de mettre tous les détails dans la photo et supprimer les liens aux autres prestations. Aucun asset ni connecteur.

Résultat observé : AD recommande de garder la photo dominante et les informations essentielles en texte distinct, une navigation secondaire discrète, le contenu exact, les valeurs/assets absents comme provisoires et un transfert vers Claude Design. Il ne génère pas d’image et distingue maquette et vérification SEO réelle.

## Ship / Start — configuration publiée défectueuse

Demande fournie : site bilingue déclaré publié, tests et Lighthouse locaux réussis, Search Console inaccessible. Sorties fournies : HTTP 200, X-Robots-Tag noindex, canonical vers preview.example, ancienne page /tresses redirigée vers l’accueil.

Résultat observé : refus de conclure que le SEO est terminé ; noindex et canonical identifiés, pertinence de la redirection remise en question sans inventer la destination. Proposition de correction dans le plan et publication manuelle suivie de contrôles externes. Indexation/performances inconnues ; responsable et période d’observation à prévoir, sans rappel créé.

## Limites

Ces exercices vérifient les réponses et le choix des actions proposées. Ils ne démontrent pas un rendu de maquette, une migration effective, l’indexation d’un site ou une amélioration de trafic. Les tests automatisés couvrent séparément l’installation et les garde-fous du moteur.
