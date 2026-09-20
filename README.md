# nemcina

Projekt pro studium němčiny.

## 👉 Aplikace běží tady

### **https://eduardjarnot1-lgtm.github.io/nemcina/**

To je **jediná adresa**. Vždycky ukazuje aktuální stav větve `main` — po
každém pushu se sama přestaví a nasadí, nic se nepublikuje ručně. Odkazy
uvnitř fungují, takže `…/nemcina/grammar` si můžeš uložit a vrátit se rovnou
tam.

Obsah: **5 484 slovíček** A1–C1 (A1 600 · A2 854 · B1 983 · B2 1 774 · C1 1 273) a
**136 gramatických témat** A1–C1 včetně vlastní sekce B2, opakování podle
FSRS-5, personalizované lekce, umístňovací test, kouč a účet přes Firebase.

## Co je kde

| Adresář | Co to je | Stav |
|---|---|---|
| `apps/mobile` | **Aplikace.** Expo Router + React Native. Běží na Androidu, iOS i na webu — a právě její webový export je na odkazu výše. | živé |
| `packages/core` | **Motor.** FSRS-5, výběr položek, cvičení, lekce, kouč, statistiky. Bez DOM, bez sítě, bez úložiště. | živé |
| `packages/server` | Účty, synchronizace a kvóta kouče. | není nasazené |
| `app/data` | **Korpus.** `vocabulary.json`, `grammar.json`, `frequency.json` — čte je motor i aplikace. | živé |
| `app/tools` | **Pipeline.** Extraktory → `*-source.json` → build → `app/data/*.json` → `validate_content.py`. | živé |
| `app/index.html`, `app/src` | Původní webový prototyp. Přepsán aplikací výše. | **zamrazený** |

Prototyp v `app/` se **už nepublikuje**. Kód zůstává, protože pod `app/` žije
korpus i pipeline, ale vyvíjí se `apps/mobile`.

## Spuštění lokálně

```bash
npm install
npm test --workspaces                  # 394 testů motoru a serveru
python3 app/tools/validate_content.py  # kontrola obsahu

cd apps/mobile && npx expo start       # aplikace
```

## Publikování

Nic ručního. Push do `main` spustí
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml),
který před nasazením projde dvěma branami:

* **`validate_content.py`** shodí build, pokud by se objevila karta s cizím
  zdrojem překladu. Kvůli tomu se převzatý materiál nemůže na veřejnou adresu
  vrátit.
* **`assert-api-url.mjs`** odmítne balík se zadrátovanou `localhost` adresou.
  Metro už to jednou nacacheovalo a takový build se dostal ven.

## Původ obsahu a licence

Slovní zásoba **nepatří nikomu jinému** — celý korpus vznikl ze čtyř seznamů
sestavených pro tento projekt (6 000 vstupů → 5 484 karet). C1 je zatím
neúplné — dodány byly tři části ze čtyř, tedy 1 500 z 2 000 hesel.

Gramatika je jiný případ a **je to zbývající licenční překážka**: 121 ze 136
témat pochází z učebnic Klett a Hueber, doslovně (build doslovnost přímo
vyžaduje, což je skvělé pro přesnost a přesně proto je to šíření cizího
obsahu). Podrobně v [`app/ZDROJE.md`](app/ZDROJE.md).

Stav projektu, co chybí a co blokuje vydání: [`PROJECT_STATUS.md`](PROJECT_STATUS.md).
