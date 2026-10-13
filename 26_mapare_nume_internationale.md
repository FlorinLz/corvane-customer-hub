# Name mapping: international names for users, contacts and institutions

**Status:** applied to every document, 5 October 2026 (PO decision: international, easy-to-identify names; no Romanian names or institutions).
**Use:** the single source for the rename in Claude Design (all artboards) and Claude Code (seed, tests, GLEIF cache, oracles). The old names are kept here only for the rename.

## Portal users (Corvane team, fictional)

| Team (location) | Old name | New name | Old seed key | New seed key | New email |
|---|---|---|---|---|---|
| Ops, admin (Malaysia) | Radu Stoica | Adrian Koh | radu | adrian | adrian.koh@corvane.example |
| Ops, on-call (Malaysia) | Andrei Ionescu | Kevin Lim | andreiI | kevin | kevin.lim@corvane.example |
| Customer Success (Europe) | Mira Costea | Emma Wilson | mira | emma | emma.wilson@corvane.example |
| Customer Success (Europe) | Mihai Dobre | Leo Martin | mihai | leo | leo.martin@corvane.example |
| Customer Success (London) | Sorina Vlad | Sophie Mitchell | sorina | sophie | sophie.mitchell@corvane.example |
| Customer Success (Europe) | Andrei Toma | Ethan Brooks | andreiT | ethan | ethan.brooks@corvane.example |
| Sales (New York) | Dan Ilie | Michael Reed | dan | michael | michael.reed@corvane.example |
| Sales (Europe) | Tom Hadley | Tom Hadley (unchanged) | tom | tom | tom.hadley@corvane.example |
| Network (Singapore) | Lukas Brenner | Lukas Brenner (unchanged) | lukas | lukas | lukas.brenner@corvane.example |
| Network, on-call (Singapore) | Ana Pop | Nora Lee | ana | nora | nora.lee@corvane.example |
| Compliance (Singapore) | Ioana Marin | Mei Chen | ioana | mei | mei.chen@corvane.example |
| Finance (Singapore) | Elena Varga | Rachel Wong | elena | rachel | rachel.wong@corvane.example |

Avatar initials follow the new names (for example AK, KL, EW, MC, RW).

## Institutions

| Old | New | LEI | BIC | Country | Notes |
|---|---|---|---|---|---|
| Banca Comercială Română SA (alias BCR), seed key `bcr` | **UniCredit Bank GmbH** (alias HVB, HypoVereinsbank), seed key `hvb` | 2ZCNRR8UK83OBTEK2170 | HYVEDEMMXXX | DE | Parent UniCredit S.p.A. (LEI 549300TRUWO2CD2G5692), replacing Erste Group Bank AG. Licence BAFIN-KI-100208 · BaFin. Product line EU VoP / DE. Contacts in Europe/Berlin, phones +49 15... Owner reassignment reason "Rebalancing German accounts before Q4" |
| Netopia Financial Services S.A., seed key `netopia` | **Adyen N.V.**, seed key `adyen` | 724500973ODKK3IFQ447 | none in seed | NL | Customer and partner (PSP). Licence DNB-BL-0412 · De Nederlandsche Bank. Product and coverage lines on NL. Contract IPE-NL-2024-011. Contacts in Europe/Amsterdam, phones +316... |

Both LEIs are confirmed in public LEI registries; Claude Code re-checks them against GLEIF and refreshes the cached copy. Neither institution is a publicly announced Corvane customer. Mollie was rejected because it uses Form3 for VoP.

## External contacts

| Old | New | Institution |
|---|---|---|
| Andreea Popescu | Claudia Schulz | UniCredit Bank GmbH (Champion) |
| Ionuț Marinescu | Tobias Klein | UniCredit Bank GmbH (Technical) |
| Alexandru Georgescu | Markus Wolf | UniCredit Bank GmbH (Incident) |
| Raluca Enache | Sanne de Vries | Adyen N.V. (Champion) |
| Cosmin Barbu | Joris Bakker | Adyen N.V. (Technical) |
| Daniel Matei | Daan Visser | Adyen N.V. (customer Incident) |
| Mihaela Stan | Lotte Jansen | Adyen N.V. (partner Incident, primary) |
| Cristina Neagu | Eva Smit | Adyen N.V. (partner Escalation, never verified) |
| Leo Martin (existing contact, renamed to avoid a clash with the user Leo Martin) | Harriet Cole | Monzo Bank Ltd |

Every other contact keeps its name. New names were checked against existing contacts and users to avoid shared surnames. The PR #9 check found one clash (the user Leo Martin and an existing Monzo contact Leo Martin), resolved by renaming the contact to Harriet Cole.

## Demo beat removed

The "LEI renewal due soon" item on the old BCR record relied on BCR's real GLEIF renewal date. UniCredit Bank GmbH renews on 2 Aug 2027, outside the 90-day window. Decision: drop the item. Scenario 3 keeps a real GLEIF case through the lapsed LEI of Banco Santander Consumer Portugal S.A., plus the Adyen licence expiring in 23 days.

## Phone examples

The generic phone example becomes a UK number: "+447700900123" (typed as "0044 7700 900123"). Adyen contacts use Dutch numbers (+316...).

## Unchanged on purpose

- `APP_TIMEZONE` stays Europe/Bucharest (the presenter's local time; "today" for date-only rules).
- Regulatory facts in 18_issues_research.md about Romania as a non-euro EU state stay as research.
