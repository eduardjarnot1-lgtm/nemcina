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

* **CC BY-NC 4.0** u témat Zustandspassiv a slovesa s předložkou zakazuje
  **komerční užití**. Dokud aplikace zůstane nekomerční, je to v pořádku;
  jakmile by se na ní mělo vydělávat, je nutné tuto část nahradit nebo si
  vyžádat svolení. Uvedení autora je podmínkou licence a je vypsané u tématu
  přímo v aplikaci.
* **GPL v2+** u slovníku Ding se vztahuje na slovníková data. Týká se
  `data/cefr.json` a těch karet, které mají `translationSource: "ding"`.
* Materiály nakladatelství (Klett, Hueber, Goethe-Institut) jsou v repozitáři
  jen jako **odvozená strukturovaná data v rozsahu nutném pro výuku**, ne jako
  kopie původních dokumentů.

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
