# French glossary (UI wording)

The storefront is **French only**. Use these words everywhere so screens stay consistent. Address the customer with **vous**, in a clear, professional B2B tone.

## Formatting

| What | Rule | Helper (`@/core/ui`) |
|---|---|---|
| Money | French formatting, currency from `NEXT_PUBLIC_CURRENCY` → `40 000,00 $US` | `formatMoney`, `formatMoneyShort`, `CURRENCY_SYMBOL` |
| Numbers | `1 200` | `formatCount` |
| Dates | `16 nov. 2026` | `formatDate` |
| Times | `15:15` · day and time: `lun. 16 nov., 15:15` | `formatTime`, `formatDayTime` |
| Countdown | `23 h 59 min` · `12 min` · `Expiré` | `formatCountdown` |
| Units | `pièce/pièces`, `boîte/boîtes`, `m` | `unitLabel` |
| Price input | Accepts `85,50` and `85.50`; shows `85,50` | `toCents`, `centsToInput` |
| Punctuation | A non-breaking space before `: ; ! ?` is nice but optional. Use French quotation marks `« … »` for quotes. | |

Never build English date/number strings by hand (`toLocaleString("en-US")`, `toFixed(2)` for display, a literal `$`).

## Words

| English | Français |
|---|---|
| Sign in / Sign out | Se connecter / Se déconnecter |
| Username / Password | Identifiant / Mot de passe |
| Account | Compte |
| Home | Accueil |
| Shop / Catalog | Boutique / Catalogue |
| Department / Category | Rayon / Catégorie |
| Search products or SKU | Rechercher un produit ou une référence |
| SKU | Réf. / Référence |
| Brand | Marque |
| Filters / Sort | Filtres / Trier |
| In stock / Out of stock / Low stock | En stock / Rupture de stock / Stock faible |
| Add to cart | Ajouter au panier |
| Cart | Panier |
| Quantity | Quantité |
| Unit price / per unit | Prix unitaire / l'unité (`/ unité`) |
| List price | Prix catalogue |
| **Trade price** (the negotiated price) | **Prix négocié** |
| **Trade quote / quote** | **Devis** |
| Request a trade price | Demander un prix négocié |
| Offer / Counter-offer | Offre / Contre-offre |
| Make an offer | Faire une offre |
| Accept / Decline (reject) | Accepter / Refuser |
| Offers left | Offres restantes |
| **Sales desk** | **Service commercial** |
| Negotiable (from N) | Négociable (dès N) |
| Negotiated | Négocié |
| Savings / You save | Économies / Vous économisez |
| Agreed price | Prix convenu |
| Checkout | Commande (button: « Passer la commande ») |
| Place order | Valider la commande |
| Order / Orders | Commande / Commandes |
| Order placed | Commande validée |
| Delivery address | Adresse de livraison |
| Delivery / Shipping | Livraison |
| Subtotal / Total / Tax | Sous-total / Total / Taxes |
| Free | Offerte (shipping) |
| Default (address) | Par défaut |
| Coming soon (Proposal tag) | Bientôt |
| Try again | Réessayer |
| Cancel / Close / Back | Annuler / Fermer / Retour |
| Loading… | Chargement… |
| Not found | Introuvable |

## Statuses

| Order | Libellé | | Quote | Libellé |
|---|---|---|---|---|
| confirmed | Confirmée | | awaiting_seller | En attente du service commercial |
| processing | En préparation | | awaiting_customer | À vous de répondre |
| shipped | Expédiée | | accepted | Prix convenu |
| delivered | Livrée | | rejected | Refusé |
| cancelled | Annulée | | cancelled | Annulé |
| | | | expired | Expiré |
| | | | ordered | Commandé |

## QR sign-in

| English | Français |
|---|---|
| Sign in with your phone | Se connecter avec votre téléphone |
| Scan QR code to sign in | Scanner un QR code pour se connecter |
| Sign in on your phone (computer side) | Connecter votre téléphone |
| Approve a computer (phone side) | Autoriser un ordinateur |
| Ask me to confirm on this computer | Me demander de confirmer sur cet ordinateur |
| Allow / Deny | Autoriser / Refuser |
| Scan again | Scanner à nouveau |
| Open camera | Ouvrir l'appareil photo |
| This phone | Ce téléphone |
| Code expires in | Le code expire dans |
| New code | Nouveau code |

Brand and fixed names stay as they are: **SOCIMCO**, product brands, and references (SKU).
