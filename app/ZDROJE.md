# Zdroje a licence

Aplikace nestaví na vymyšleném obsahu. Každé slovo, příklad i gramatické
pravidlo pochází z některého z dokumentů níže a build je odmítne, pokud je
v původním zdroji nenajde. Původní PDF se do repozitáře **necommitují** — jen
strukturovaná data, která z nich vznikla.

## Slovní zásoba — přepsána načisto

Slovní zásoba **už nepochází od nikoho jiného**. Celý korpus byl nahrazen
seznamy sestavenými přímo pro tento projekt: každé slovo, jeho anglický
překlad i příkladová věta s překladem vznikly zde.

| Obsah | Zdroj | Licence / poznámka |
|---|---|---|
| Slovní zásoba A1 (600 hesel, 12 témat) | *German Vocabulary — Level A1*, sestaveno pro tento projekt | vlastní obsah |
| Slovní zásoba A2 (900 hesel, 15 témat) | *German Vocabulary — Level A2*, sestaveno pro tento projekt | vlastní obsah |
| Slovní zásoba B1 (1 000 hesel, 18 témat) | *German Vocabulary — Level B1*, sestaveno pro tento projekt | vlastní obsah |
| Slovní zásoba B2 (500 hesel, 25 témat) | *German Vocabulary — Level B2*, sestaveno pro tento projekt | vlastní obsah |
| Slovní zásoba B2 (1 500 hesel, 20 témat) | *German Vocabulary — B2 1500*, 3 části, sestaveno pro tento projekt | vlastní obsah |
| Slovní zásoba C1 (1 500 hesel, 15 témat) | *German Vocabulary — C1 2000*, části 2–4, sestaveno pro tento projekt | vlastní obsah |
| Gramatika B2 (15 témat) | *Deutsche Grammatik – Niveau B2*, díl 1 a 2, sestaveno pro tento projekt | vlastní obsah |
| Frekvence slov | hermitdave/FrequencyWords (korpus OpenSubtitles) | otevřená licence, jen doplňuje pořadí |

Po sloučení hesel, která se opakují na více úrovních, z 6 000 vstupních
záznamů vznikne **5 484 karet**: A1 600 · A2 854 · B1 983 · B2 1 774 · C1 1 273.

**C1 je neúplné.** Dodány byly části 2, 3 a 4 ze čtyř, tedy 1 500 z ohlášených
2 000 hesel; část 1 (`clean-c1-0001`–`0500`) zatím chybí. Až dorazí, stačí ji
přidat do stejného příkazu extraktoru a korpus přestavět — nic dalšího se
neměří ani neupravuje.

Dva seznamy B2 stojí vedle sebe záměrně: mají společných jen 14 hesel z 1 986,
takže je to jedna úroveň ze dvou téměř disjunktních seznamů, ne duplicita.

### Co bylo odstraněno

Tyto zdroje z aplikace **zmizely i s daty, která z nich byla odvozena**:

* OCR GCSE German Vocabulary List (2 047 karet)
* Wortlisten Goethe-Institutu A1 / A2 / B1
* Der deutsche Wortschatz von A1 bis B2, Lingster Academy
* Ding German–English dictionary (GPL v2+) — překlady slov, která seznamy
  nepřekládaly

Smazány byly soubory `app/tools/source-entries.json`, `app/data/cefr.json`,
`app/tools/annotations/*.tsv` a nástroje, které je četly (`extract_pdf.py`,
`build_cefr.py`, `extract_goethe_b1.py`). Kontrola `validate_content.py` nově
**odmítne build**, ve kterém by se objevila karta s cizím zdrojem překladu —
aby se to nemohlo vrátit nepozorovaně.

## Gramatika A1–C1 — tady problém trvá

| Obsah | Zdroj | Licence / poznámka |
|---|---|---|
| Gramatika A1–B1 (87 témat) | DaF kompakt neu A1/A2/B1, Grammatikerklärungen | © Ernst Klett Sprachen, Stuttgart 2018 |
| Gramatika C1 (32 témat) | Sicher! C1 Grammatikübersicht | © Hueber Verlag |
| Zustandspassiv + slovesa s pevnou předložkou | deutsch-lernen-goethe-a1-c2, Abdullah Butt | **CC BY-NC 4.0** |

**Toto je teď jediná zbývající licenční překážka vydání.** 121 ze 136
gramatických témat pochází z učebnic Klett a Hueber a build je záměrně přebírá
**doslova** — příkladovou větu odmítne, pokud se slovo od slova nevyskytuje ve
zdrojovém dokumentu. Pro přesnost je to výborné a přesně proto je to šíření
cizího textu. Souhlas nakladatelství nikdo nemá.

Cesta ven je stejná jako u slovíček: 15 témat B2 už vzniklo pro tento projekt,
zbytek by šlo napsat stejně.

* **CC BY-NC 4.0** u témat Zustandspassiv a slovesa s předložkou zakazuje
  **komerční užití**. Dokud aplikace zůstane nekomerční, je to v pořádku;
  jakmile by se na ní mělo vydělávat, je nutné tuto část nahradit nebo si
  vyžádat svolení. Uvedení autora je podmínkou licence a je vypsané u tématu
  přímo v aplikaci.

## Co historie repozitáře pořád obsahuje

Smazání odstranilo soubory z pracovní kopie, ale **git historie je má dál** —
starší commity obsahují odvozená data Goethe, GCSE i Ding. Kdo si vyklonuje
repozitář, dostane i je. Vyčistit to jde jen přepsáním historie nebo založením
nového repozitáře; obojí je rozhodnutí vlastníka, ne úklid, který by šlo udělat
mimochodem.

## Co v repozitáři není

* **Tatoeba `deu-eng`** (~330 000 dvojic vět) — nikdy nebyl dodán. Doplnil by
  generované příkladové věty a doplňovačky.

Projde stejným řetězcem `extract → build → validate` jako všechno ostatní,
jakmile bude soubor k dispozici.
