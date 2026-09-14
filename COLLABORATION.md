# Spolupráce: ChatGPT / Codex, Claude a GitHub

GitHub je jediný společný zdroj pravdy pro projekt. Každá změna musí být dohledatelná přes issue, větev, commit nebo pull request.

## Pracovní postup

1. Založ issue s jasným cílem a ověřitelnými kritérii hotovo.
2. Pracuj v samostatné větvi pojmenované `feature/<kratky-popis>` nebo `fix/<kratky-popis>`.
3. ChatGPT / Codex implementuje změny, spouští testy a vytváří pull request.
4. Claude provádí nezávislou revizi pull requestu: chyby, bezpečnost, srozumitelnost a chybějící testy.
5. Po zapracování připomínek se pull request sloučí do `main`.

## Pravidla pro agenty

- Neměň `main` přímo.
- Necommituj tajné údaje: API klíče, hesla, tokeny ani soubory `.env`.
- Každý commit má popisovat jednu logickou změnu.
- Před pull requestem spusť dostupné testy a zapiš jejich výsledek.
- Pokud si agent není jistý požadavkem, vytvoří návrh v issue nebo pull requestu místo nevratné změny.

## Role

| Nástroj | Úloha |
| --- | --- |
| ChatGPT / Codex | Implementace, testy, dokumentace, správa větví a pull requestů |
| Claude | Nezávislá revize, alternativní návrhy, hledání rizik |
| GitHub | Úkoly, historie změn, pull requesty a schválení |

