# Stav projektu

Poslední aktualizace: 2026-09-14 · větev `feature/vyukova-aplikace`

> Skutečný HEAD zjisti příkazem `git log --oneline -1` — tento soubor se
> commituje spolu se změnami, které popisuje, takže konkrétní SHA by tu vždy
> bylo o jeden commit pozadu.

Tento soubor drží stav rozdělané práce, aby další session mohla okamžitě
navázat. Aktualizuje se při každém přerušení, dosažení limitu a po dokončení
většího kroku.

## Kde to stojí

| | |
|---|---|
| Větev | `feature/vyukova-aplikace` (pushnutá, shodná se vzdálenou) |
| Pracovní strom | čistý, nic necommitnutého |
| Pull request | [#2](https://github.com/eduardjarnot1-lgtm/nemcina/pull/2) — otevřený, popis aktualizovaný, čeká na revizi |
| Aplikace | `app/` — 4 768 slovíček A1–B2, 121 gramatických témat A1–C1 |

### Hotovo

1. `ec1ee3a` — import zdroje aplikace do `app/` (74 souborů)
2. `1fe16e4` — kořenový `README.md` odkazuje na `app/`
3. `077ab6c` — oprava 14 zastaralých cest `german/` → `app/` v `app/README.md`
4. `c09e8de` — táž oprava od Codexu (viz konflikt níže)
5. `22aa94a` — merge, konflikt vyřešen ve prospěch `077ab6c`
6. `db8ae74` — zavedení tohoto souboru a pravidla v `CLAUDE.md`

### Poslední ověření (z kořene repozitáře)

```
python3 app/tools/validate_content.py   → PASSED, 98 776 kontrol, 0 chyb, 1 varování
python3 app/tools/build_grammar.py      → 121 témat, 615 příkladů, 615 cvičení
python3 app/tools/build_vocabulary.py   → 4 768 karet
python3 app/tools/build_artifact.py     → jednosouborový build 5,87 MB
http://localhost:8000/app/              → HTTP 200, bez chyb v konzoli
```

Jediné varování je dlouhodobé a legitimní: zdrojový seznam uvádí *einwerfen*
dvakrát s mírně odlišným překladem, obě karty zůstávají a jsou označené.

## Další krok — přesně

**Všechna tři rozhodnutí z PR #2 jsou vyřízená. Práce na PR je hotová a čeká
na revizi projektového manažera.** Dokud revize nepřijde, není co dělat —
nezačínat novou práci bez zadání.

1. ~~Docstringy `german/` v `app/tools/*.py`~~ — hotovo, `a160a76`.
2. ~~Licence~~ — vyřízeno, `5aaf3e1`. Provozní hranice je v `app/ZDROJE.md`
   a `CLAUDE.md`: **repozitář zůstává soukromý, aplikace se veřejně nenasazuje
   a nezpoplatňuje.** Platí i pro agenty.
3. ~~Věta o Netlify v `app/README.md`~~ — smazána, `7f1a2b3`. Popisovala
   nasazení předchozího repozitáře; tady žádná deploy konfigurace není.

Až revize dorazí: zapracovat připomínky na téže větvi, znovu spustit
`python3 app/tools/validate_content.py` a aktualizovat popis PR.

## Na co narazit při navázání

### Konflikt na větvi je vyřešený, ale stojí za vysvětlení

Commit `c09e8de` od Codexu opravil cesty správně, ale zároveň slepil celý
`app/README.md` do jediného řádku (420 → 1), čímž zničil Markdown, a záměnou
uvnitř slova změnil `search.js German/English search` na `app/English search`.
Merge `22aa94a` proto zachoval verzi `077ab6c`. Historie Codexu **nebyla
přepsána**, zůstává v grafu.

### Zdrojové dokumenty v repozitáři nejsou

Commitují se jen odvozená strukturovaná data (`app/data/*.json`), ne původní
PDF. Pokud bude potřeba znovu spustit `extract_*.py` nebo `build_cefr.py`,
je nutné si vstupy znovu obstarat:

```bash
git clone --depth 1 https://github.com/technologiestiftung/sprach-o-mat.git       # Goethe A1/A2/B1 PDF
git clone --depth 1 https://github.com/ilkermeliksitki/goethe-institute-wordlist.git
git clone --depth 1 https://github.com/Hazrat-Ali9/Deutschland-Vocabulary-A1-B2.git  # seznam Lingster
git clone --depth 1 https://github.com/SavSanta/ding-de.git                        # slovník Ding
git clone --depth 1 https://github.com/abdullahbutt/deutsch-lernen-goethe-a1-c2.git # gramatika CC BY-NC
```

Příkaz pro `build_cefr.py` se všemi přepínači je v `app/README.md`.

### Omezení sítě v tomto prostředí

* `github.com` — dostupné přes `git clone` (přes `curl` na API ne).
* `goethe.de`, `chatgpt.com`, `api.openai.com`, `wikipedia`/`wiktionary`,
  `archive.org`, `huggingface.co` — **blokované** egress politikou (403 na CONNECT).
* `WebSearch` a `WebFetch` fungují, ale `WebFetch` na blokované domény selže.

To je důvod, proč B2 slovní zásoba stojí jen na seznamu Lingster: oficiální
Goethe B2 Wortliste se z tohoto prostředí stáhnout nedá.

### Jednosouborový build

`app/dist/` je v `.gitignore`, protože jde o generovaný 5,87MB soubor.
Sestaví se `python3 app/tools/build_artifact.py`.

## Jak navázat od nuly

Nová session **nemá žádnou paměť** předchozích. Nenaváže sama od sebe ani po
restartu počítače — běží v dočasném cloudovém kontejneru, který se po skončení
zahodí. Přežije jen to, co je na GitHubu. Navázání se proto musí říct.

### Text k vložení do nové session

> Pracuješ na repozitáři `eduardjarnot1-lgtm/nemcina`. Přečti si
> `PROJECT_STATUS.md`, `CLAUDE.md` a `COLLABORATION.md` a pokračuj od sekce
> „Další krok — přesně". Nic nepushuj do `main`, pracuj na větvi
> `feature/vyukova-aplikace`.

### Příprava prostředí

```bash
git clone https://github.com/eduardjarnot1-lgtm/nemcina /home/user/nemcina
cd /home/user/nemcina
git checkout feature/vyukova-aplikace
python3 app/tools/validate_content.py     # ověření, že je vše v pořádku
python3 -m http.server 8000                # pak http://localhost:8000/app/
```

### Co se ztratí a co ne

| | |
|---|---|
| Přežije | vše commitnuté a pushnuté na GitHub — kód, data, tento soubor, PR a jeho komentáře |
| Zmizí | obsah kontejneru: klon, dočasné soubory a ~1,3 GB stažených zdrojových dokumentů |

Zdrojové dokumenty se dají znovu stáhnout příkazy v sekci „Zdrojové dokumenty
v repozitáři nejsou". Pro běžnou práci nejsou potřeba — `app/data/*.json` už
jsou hotová a commitnutá; potřebné jsou jen při znovuspuštění extraktorů.
