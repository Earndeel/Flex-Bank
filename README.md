# Flex — simulation personnelle

Application web statique adaptée à l’iPhone et installable sur l’écran d’accueil.

Flex possède sa propre identité visuelle. Les soldes, comptes, cartes, commerces et transactions proviennent de l’activité enregistrée dans l’application.



## Parcours

- Code d’accès local à quatre chiffres.
- Comptes EUR, USD, GBP, EGP et THB.
- Ajouts d’argent, virements immédiats ou programmés et change à taux fixes.
- Demandes de paiement et contacts locaux.
- Carte virtuelle, gel, plafond quotidien et cartes supplémentaires.
- Poches d’épargne et objectifs.
- Recherche, détails, statistiques mensuelles, budget et export CSV.
- Géolocalisation facultative : coordonnées traitées dans le navigateur, seule la région est conservée.
- Génération quotidienne déterministe, reprise à l’ouverture et vérification des nouveaux événements chaque minute lorsque l’app est ouverte.
- Trois mois calendaires glissants d’historique initial, avec enseignes et abonnements variés par ville.
- Écran de chargement animé, récupération en cas d’erreur et prise en compte de la réduction des animations.
- Mode sombre par défaut et cache hors ligne.

Les données sont conservées dans le stockage local du navigateur, sans synchronisation entre appareils. Le code local est un verrou d’interface ; l’accès au Site est privé et protégé séparément par l’hébergement.

Le compte EUR conserve au minimum 23 000,01 €. Toute opération qui franchirait ce seuil est refusée. Les paiements automatiques respectent le gel, le plafond et les options de la carte.

Les taux de change sont fixes et ne constituent pas des cours réels. Les opérations programmées s’exécutent lors de la prochaine ouverture après leur date, sous réserve du solde disponible. L’activité ne s’exécute pas en arrière-plan quand l’app est fermée.

La migration de la première version complète l’historique ancien et met à jour les libellés sans supprimer les opérations personnelles, contacts, poches ou cartes supplémentaires. Les soldes intermédiaires sont recalculés avec le même seuil minimum. La préférence sombre s’applique une fois ; le choix ultérieur du thème est conservé.

Les libellés de commerces mélangent enseignes existantes et noms illustratifs. Le parcours historique Bangkok, France puis Égypte est reconstitué.

Quelques sources consultées pour les noms locaux :

- [El Masry, Aswan](https://yellowpages.com.eg/en/profile/el-masry-restaurant/21662)
- [Salah El Din, Aswan](https://yellowpages.com.eg/en/profile/salah-el-din-restaurant/131948)
- [Wunder-Bar, Port Ghalib](https://www.tripadvisor.com/Restaurant_Review-g10837810-d4191680-Reviews-Wunder_Bar-Port_Ghalib_Marsa_Alam_Red_Sea_and_Sinai.html)

## Vérification

Lancer `npm test`. Aucun paquet tiers n’est nécessaire pour servir l’app.

## Mode édition

Ouvrir le profil de Lucas, puis « Mode édition ». Choisir les soldes des cinq comptes, le revenu mensuel, la référence de dépenses et les étapes datées du voyage. Les réglages et les opérations produites sont des données de démonstration stockées dans le navigateur.

« Régénérer dépenses et revenus » remplace l’historique automatique par trois mois calendaires de nouvelles opérations, sans supprimer les opérations manuelles, contacts, cartes, demandes, virements programmés ou poches. Les dépenses utilisent les commerces, coûts et devises de chaque région. Les revenus mensuels sont versés un jour ouvré ; le profil indépendant les répartit en deux missions. Chaque régénération choisit une nouvelle graine, conservée pour reprendre l’activité quotidienne sans doublons.

« Enregistrer les soldes uniquement » conserve les opérations et recalcule leurs soldes intermédiaires. Le solde initial est déduit du solde final choisi et du registre. Les réglages incompatibles avec le minimum de 23 000,01 € ou un solde négatif dans une autre devise sont refusés, sans ajouter de crédit de compensation.

« Annuler le dernier changement » est disponible dans la session déverrouillée tant qu’aucune nouvelle opération n’a modifié le registre ou ses soldes. Quitter l’éditeur conserve le scénario et son indication de démonstration ; verrouiller l’app ferme le mode édition.

## Interface mobile

Refonte visuelle d’octobre 2026 fondée sur les quatre captures iPhone fournies : accueil, dépenses, analyses et Invest. Flex reprend les proportions, le fond noir, les surfaces arrondies, les boutons avec relief et la navigation flottante à six entrées. Les illustrations SVG et l’icône F sont propres à Flex. Aucune capture, coordonnée bancaire ou donnée de compte de référence n’est intégrée.

Les analyses lisent le registre existant : dépenses, revenus, cashflow et patrimoine multidevise avec les taux fixes de l’application. Les périodes 1W, 1M, 6M et 1Y sont disponibles ; 1W couvre la semaine du lundi au dimanche et 6M les six mois calendaires se terminant au mois choisi. Les opérations futures, refusées, de change et de poche sont exclues des dépenses. Les boutons de période donnent accès aux périodes antérieures et à l’historique complet.

Cartes, paiements, poches, localisation et mode édition restent accessibles. Invest possède une trésorerie de présentation et une liste de suivi, enregistrées séparément du registre bancaire. Il n’y a aucune cotation, aucun ordre ni rendement réel. Credit est un calculateur illustratif hors frais ; Crypto est un catalogue sans achat ; les FlexPoints sont des points fictifs sans valeur. Le code 2589 et la clé de stockage historique sont conservés pour éviter toute perte de données lors du renommage.

Les tests valident les calculs, les invariants du registre et les parcours via un adaptateur DOM en mémoire. Ils ne vérifient pas le rendu de Safari. Le déploiement reste privé et le pied de page identifie l’application comme démonstration sans compte réel.

La vue Analytics s’ouvre directement sur l’anneau des dépenses avec les catégories et périodes 1W / 1M / 6M / 1Y. La vue d’ensemble reste accessible dans le menu de période. Les boutons d’en-tête utilisent des fonds opaques et des contours nets, sans flou ni ombres diffuses. L’IBAN fourni pour le compte EUR est une donnée d’interface marquée « IBAN fictif — non utilisable » ; les coordonnées copiées conservent cette mention de démonstration.
