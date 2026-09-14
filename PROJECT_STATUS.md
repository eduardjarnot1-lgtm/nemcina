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

**Čeká se na odpovědi projektového manažera na tři otázky v popisu PR #2.**
Žádná z nich neblokuje běh aplikace; všechny jsou mimo původně zadaný rozsah,
proto nebyly udělány svévolně.

1. **Docstringy v `app/tools/*.py` stále uvádějí `german/`** — 5 výskytů
   (`build_artifact.py`, `build_grammar.py`, `build_cefr.py`,
   `build_frequency.py`, `build_vocabulary.py`). Jde jen o komentáře, běh
   neovlivňují. **Pokud manažer odsouhlasí**, provést takto:

   ```bash
   cd /home/user/nemcina
   git checkout feature/vyukova-aplikace
   sed -i 's|german/tools/|app/tools/|g; s|german/data/|app/data/|g' app/tools/*.py
   grep -rn "german/" app/tools/          # musí být prázdné
   python3 app/tools/validate_content.py  # musí projít
   git commit -am "tools: opravit zastaralé cesty german/ v docstringech"
   ```
   Pozor: v `app/tools/` **nepoužívat** globální záměnu `german/` → `app/` bez
   rozlišení. Přesně tím Codex v `c09e8de` změnil „German/English search" na
   „app/English search". Nahrazovat jen `german/tools/` a `german/data/`.

2. **Licence — vyřešit dřív, než se na tom začne stavět.** Podrobnosti
   v `app/ZDROJE.md`. Gramatika Zustandspassiv a sloves s předložkou je
   **CC BY-NC 4.0** (zákaz komerčního užití), překlady ze slovníku Ding jsou
   **GPL v2+**. Dokud projekt zůstane nekomerční, je to v pořádku.

3. **Věta o Netlify v `app/README.md`** (řádek 16–17) je cestou správná, ale
   popisuje nasazení předchozího repozitáře — tady žádná Netlify konfigurace
   není. Smazat, nebo se s Netlify počítá?

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

```bash
git clone https://github.com/eduardjarnot1-lgtm/nemcina /home/user/nemcina
cd /home/user/nemcina
git checkout feature/vyukova-aplikace
python3 app/tools/validate_content.py     # ověření, že je vše v pořádku
python3 -m http.server 8000                # pak http://localhost:8000/app/
```
