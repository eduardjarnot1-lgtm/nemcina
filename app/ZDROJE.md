# Zdroje a licence

Aplikace nestaví na vymyšleném obsahu. Každé slovo, příklad i gramatické
pravidlo pochází z některého z dokumentů níže a build je odmítne, pokud je
v původním zdroji nenajde. Původní PDF se do repozitáře **necommitují** — jen
strukturovaná data, která z nich vznikla.

| Obsah | Zdroj | Licence / poznámka |
|---|---|---|
| Slovní zásoba (2 047 karet) | OCR GCSE German Vocabulary List | podklad pro výuku |
| Úrovně A1 / A2 / B1 | Oficiální Wortlisten Goethe-Institutu (A1 Start Deutsch 1, A2, B1) | © Goethe-Institut |
| Úroveň B2 | Der deutsche Wortschatz von A1 bis B2, Lingster Academy | © Lingster Academy |
| Anglické překlady slov, která seznamy nepřekládají | Ding German–English dictionary, TU Chemnitz | **GPL v2 nebo novější** |
| Gramatika A1–B1 (87 témat) | DaF kompakt neu A1/A2/B1, Grammatikerklärungen | © Ernst Klett Sprachen, Stuttgart 2018 |
| Gramatika C1 (32 témat) | Sicher! C1 Grammatikübersicht | © Hueber Verlag |
| Zustandspassiv + slovesa s pevnou předložkou | deutsch-lernen-goethe-a1-c2, Abdullah Butt | **CC BY-NC 4.0** |
| Frekvence slov | hermitdave/FrequencyWords (korpus OpenSubtitles) | titulkový korpus |

## Na co si dát pozor

> Nejsem právník a tohle není právní rada. Je to popis toho, co v repozitáři
> skutečně je, z čeho to pochází a kde jsou hranice. Před čímkoli veřejným
> nebo placeným si to nechte posoudit odborníkem.

### Rozsah použitého materiálu

| Zdroj | Co z něj v repozitáři je |
|---|---|
| DaF kompakt neu (**Klett**) | 87 gramatických témat · 394 doslovných příkladů · 419 cvičení |
| Sicher! C1 (**Hueber**) | 32 gramatických témat · 205 doslovných příkladů · 183 cvičení |
| Wortlisten **Goethe-Institutu** + **Lingster** | 2 721 karet, z toho 1 642 s překladem ze seznamu |
| OCR GCSE seznam | 2 047 karet |
| **Ding** (GPL v2+) | 1 079 anglických překladů |
| deutsch-lernen-goethe-a1-c2 (**CC BY-NC 4.0**) | 2 témata · 16 příkladů · 13 cvičení |

Celkem **3 689 karet nese doslovnou příkladovou větu** převzatou ze zdroje.

### Kde riziko doopravdy je

Otevřené licence, kterých se člověk lekne jako prvních, jsou ve skutečnosti ta
menší část:

* **CC BY-NC 4.0** — nekomerční užití **výslovně povoluje**. Dokud se na
  aplikaci nevydělává, je to v pořádku a podmínku uvedení autora splňujeme.
  Jde o 2 témata ze 121.
* **GPL v2+** — povinnosti se spouští až **šířením**, ne používáním. Navíc
  nejhorší důsledek je, že dílo musí zůstat otevřené, ne že se něco porušuje.

Skutečná expozice je jinde: **materiály komerčních nakladatelství**. Klett,
Hueber, Goethe-Institut ani Lingster k ničemu svolení nedali. 119 ze 121
gramatických témat a naprostá většina příkladových vět pochází z jejich
placených učebnic. Nejde o krátkou citaci, ale o systematické převzetí
didaktického obsahu.

**Rozhoduje ale ne to, co v repozitáři leží, nýbrž co se s tím dělá.**

| Použití | Jak to stojí |
|---|---|
| Soukromé studium, repozitář **private** | Současný stav. Prakticky bez rizika — na soukromou rozmnoženinu pro vlastní potřebu se ve většině Evropy vztahuje výjimka. |
| Repozitář **public** | Zpřístupnění veřejnosti. Tady mají nakladatelství reálný nárok. |
| **Veřejné nasazení** (Netlify, hosting) | Totéž, ještě zřetelněji. |
| **Zpoplatnění** | Porušení CC BY-NC přímo, a k tomu nároky nakladatelství. |

### Pravidlo pro provoz

**Repozitář zůstává soukromý. Aplikace se nikam veřejně nenasazuje a nezpoplatňuje.**

To platí i pro agenty pracující na tomto repozitáři: nezveřejňovat repozitář,
nenasazovat aplikaci na veřejný hosting, nenavrhovat monetizaci. Pokud si to
majitel projektu přeje změnit, je to jeho rozhodnutí — ale musí ho udělat
vědomě a s vědomím výše uvedeného.

Pozn.: odstranit 2 témata s CC BY-NC by samo o sobě **nepomohlo**. Dokud je
v aplikaci obsah od Klettu a Hueberu, komerční ani veřejné použití stejně
nepřipadá v úvahu. Cesta ke komerčnímu produktu nevede přes výmaz dvou témat,
ale přes nahrazení drtivé většiny gramatiky a příkladových vět vlastním nebo
volně licencovaným obsahem.

## Známá chyba ve zdroji

Seznam Lingster uvádí `glauben an D`. To je chyba — `glauben an` se pojí
s **akuzativem** (*Ich glaube an dich*). Aplikace zdroj cituje tak, jak je
vytištěný, a chybu výslovně označuje; neopravuje ji potichu ani ji potichu
neučí.

## Co v repozitáři není

* **Goethe-Zertifikat B2 Wortliste** — oficiální seznam pro B2 se nepodařilo
  získat, `goethe.de` je z prostředí nedostupné. B2 proto stojí jen na seznamu
  Lingster.
* **Tatoeba `deu-eng`** (~330 000 dvojic vět) — nikdy nebyl dodán. Doplnil by
  generované příkladové věty a doplňovačky.

Obojí projde stejným řetězcem `extract → build → validate` jako všechno
ostatní, jakmile bude soubor k dispozici.
