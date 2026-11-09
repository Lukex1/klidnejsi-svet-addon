# klsv

Klidnější svět. Wtyczka do Chrome i Firefoksa, która uspokaja feed: zasłania prowokację, szorstkie słowa, czarny scenariusz, pustą obietnicę, nachalną reklamę i sztuczny połysk, także filmy złożone przez model. W to miejsce kładzie krótką ciekawostkę. Ramka wpisu zostaje tam, gdzie była.

Działa na X, Reddit, Facebook, Instagram, Threads, YouTube, LinkedIn, TikTok i Bluesky. Interfejs jest po polsku albo po czesku. Ciekawostki osobno, po polsku albo po angielsku.

Nie trzeba podłączać żadnego klucza. Słownik i lekki model w przeglądarce działają lokalnie. Większy model na własnym komputerze (Ollama albo LM Studio) jest opcjonalny.

## Budowanie

Potrzebny jest [Bun](https://bun.sh).

```bash
bun install
bun test
bun run build
```

Paczki lądują w `dist/chrome` i `dist/firefox`.

## Instalacja

Chrome: `chrome://extensions`, tryb dewelopera, „Załaduj rozpakowane”, wskaż `dist/chrome`.

Firefox: `about:debugging#/runtime/this-firefox`, „Załaduj dodatek tymczasowy”, wskaż `dist/firefox/manifest.json`.

Po każdej przebudowie załaduj wtyczkę ponownie.

## Co chowa

| Nazwa | Co łapie |
| --- | --- |
| Prowokacja | Wpisy napisane tak, żeby wyciągnąć kłótnię. |
| Szorstkie słowa | Obelgi, pogarda i nękanie. |
| Sztuczny połysk | Gładki tekst z generatora oraz filmy złożone przez model. |
| Czarny scenariusz | Ciągły alarm zamiast treści. |
| Pusta obietnica | Tytuł, który obiecuje coś, czego w środku nie ma. |
| Nachalna reklama | Promocje i wstawione ogłoszenia. |

Każdą kategorię i każdą stronę da się wyłączyć. Własna fraza zawsze chowa albo zawsze przepuszcza. Autor dodany do listy zostaje.

Film z modelu jest zasłaniany na liście YouTube, w Shorts, na otwartym odtwarzaczu i na TikToku, gdy tytuł, opis albo oznaczenie strony mówi, że powstał w generatorze (na przykład Sora, Veo, Kling albo „treści syntetyczne”). Odtwarzanie pod zasłoną staje.

## Model

Słownik działa od razu, bez sieci.

Model w przeglądarce czyta resztę wpisów, po polsku i po angielsku. Jeśli Chrome ma już własny model, wtyczka użyje jego. Inaczej raz pobierze około 130 MB wag z Hugging Face i zostawi je u siebie. Na serwer idą tylko wagi, nie treść wpisu. Silnik WASM jest w paczce.

Opcjonalnie można włączyć większy model pod adresem `http://127.0.0.1:11434/v1/chat/completions` (Ollama, model `qwen2.5:0.5b`, pusty klucz). Dostaje tylko wpisy blisko progu.

## Ikona

Na ikonie widać liczbę schowanych wpisów na karcie. Po najechaniu i w popupie są skróty włączonych kategorii: `r` prowokacja, `t` szorstkie słowa, `a` sztuczny połysk, `d` czarny scenariusz, `c` pusta obietnica, `s` nachalna reklama.
