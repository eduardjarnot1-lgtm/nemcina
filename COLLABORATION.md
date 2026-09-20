# Spolupráce: ChatGPT / Codex, Claude a GitHub

GitHub je jediný společný zdroj pravdy pro projekt. Každá změna musí být dohledatelná přes issue, větev, commit nebo pull request.

## Pracovní postup

1. Založ issue s jasným cílem a ověřitelnými kritérii hotovo.
2. Pracuj v samostatné větvi pojmenované `feature/<kratky-popis>` nebo `fix/<kratky-popis>`.
3. ChatGPT / Codex implementuje změny, spouští testy a vytváří pull request.
4. Claude provádí nezávislou revizi pull requestu: chyby, bezpečnost, srozumitelnost a chybějící testy.
5. Po zapracování připomínek se pull request sloučí do `main`.

## Jedna aplikace, jedna adresa

Všechno, co vlastník vidí, běží na **jedné adrese**:

> https://eduardjarnot1-lgtm.github.io/nemcina/

Staví se z `apps/mobile` při každém pushi do `main`. **Veškerá práce patří do
té aplikace.** Pokyn vlastníka, 2026-09-20.

Upravuj tedy to, co tu nasazenou aplikaci zlepší: `apps/mobile` (aplikace),
`packages/core` (motor), `app/data` a `app/tools` (korpus a pipeline),
`.github/workflows/deploy-pages.yml` (nasazení).

**Neupravuj `app/index.html` ani `app/src/`.** To je původní webový prototyp.
Je zamrazený, nikde se nepublikuje a oprava v něm se k nikomu nedostane —
adresář přežívá jen proto, že vedle něj leží `app/data` a `app/tools`. Když je
něco špatně v prototypu, řeší se to v `apps/mobile`.

Aplikaci nepublikuj nikam jinam. Druhý hosting ani ruční export jen vrátí
rozcházení, kvůli kterému ta jediná adresa vznikla.

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

