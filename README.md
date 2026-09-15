# nemcina
Projekt pro studium němčiny

## Aplikace

Výuková aplikace je v adresáři [`app/`](app/). Je to statická stránka — žádný
build krok, žádný server, žádné účty. Postup ke spuštění, popis architektury
a pravidla pro data jsou v [`app/README.md`](app/README.md), přehled zdrojů
a licencí v [`app/ZDROJE.md`](app/ZDROJE.md).

```bash
python3 -m http.server 8000     # z kořene repozitáře
# pak otevřít http://localhost:8000/app/
```

Obsah: 4 637 slovíček s úrovní A1–B2 a 121 gramatických témat A1–C1,
opakování podle FSRS-5, personalizované lekce a sledování pokroku.
