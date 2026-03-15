# IPTV Live TV – Titan OS projekt

Hotový HTML5 projekt pre Titan OS / Philips TV.

## Čo obsahuje
- slovenské rozhranie
- Live TV only
- M3U URL
- import M3U súboru (experimentálne podľa podpory TV/browseru)
- kategórie z playlistu
- obľúbené
- vyhľadávanie
- prepínanie kanálov číslami
- prepínanie kanálov šípkami hore/dole
- posledný sledovaný kanál
- overlay pri prepnutí kanála
- ikony, banner, splash

## Spustenie
1. Rozbaľ projekt.
2. Nahraj celý priečinok na web hosting.
3. Otvor `index.html` cez URL.
4. Na Titan OS to spusti cez DevView alebo browser.

## Poznámky
- Niektoré streamy môžu mať obmedzenia kvôli CORS alebo podpore kodekov v TV browseri.
- Import M3U súboru je pridaný, ale správanie závisí od podpory file pickeru na zariadení.
- Pri HLS/DASH streamoch môže byť správanie audio/titulkov rozdielne podľa zdroja.

## Súbory
- `index.html` – hlavné rozhranie
- `styles.css` – dizajn
- `app.js` – logika aplikácie
- `assets/` – ikony, logo, banner, splash
- `config/app.json` – základná konfigurácia projektu
