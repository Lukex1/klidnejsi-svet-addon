import type { CategoryId, Mode, UiLang } from "./types.ts";

const COPY = {
  pl: {
    uiLanguage: "język interfejsu",
    dark: "ciemny motyw",
    sensitivity: "czułość",
    hideWhat: "co chować",
    where: "gdzie",
    todayHidden: "dziś ukryte",
    settings: "ustawienia",
    hiddenOnTab: "ukryte na karcie",
    pause: "pauza na tej karcie",
    resume: "wznów tę kartę",
    inject: "uruchom tutaj",
    hintInject: "ta karta była otwarta przed wtyczką. uruchom ją tutaj albo odśwież stronę.",
    hintBlocked: "tej karty nie da się ruszyć. odśwież ją albo odśwież zwykłą stronę.",
    enabledLabel: "Włącz klsv",
    darkLabel: "Ciemny motyw",
    loading: "ładowanie…",
    previewOutside: "podgląd poza wtyczką",
    off: "wyłączone. feed zostaje nienaruszony.",
    paused: "pauza na tej karcie.",
    skipPage: "tej strony nie ruszam.",
    siteOff: "jest wyłączony.",
    worksOn: "działa na",
    saveFailed: "nie udało się zapisać",
    backgroundDown: "tło wtyczki jeszcze nie wstało",
    modelOutside: "model w przeglądarce rusza w załadowanej wtyczce",
    modelSilent: "model jeszcze nie odpowiada",
    ownPhrase: "twoja fraza",
    threshold: "próg ukrycia",
    thresholdHint: "im wyżej, tym mniej musi się uzbierać.",
    mild: "łagodna",
    medium: "średnia",
    sharp: "ostra",
    modelIdle: "model ruszy na pierwszym wpisie i pobierze się raz",
    modelStarting: "uruchamiam model",
    modelBrowser: "model przeglądarki jest gotowy",
    modelEmbed: "lekki model jest gotowy",
    modelOff: "model w przeglądarce jest wyłączony",
    downloading: "pobieram",
  },
  cs: {
    uiLanguage: "jazyk rozhraní",
    dark: "tmavý režim",
    sensitivity: "citlivost",
    hideWhat: "co schovávat",
    where: "kde",
    todayHidden: "dnes skryto",
    settings: "nastavení",
    hiddenOnTab: "skryté na kartě",
    pause: "pauza na této kartě",
    resume: "obnovit tuto kartu",
    inject: "spustit tady",
    hintInject: "tahle karta byla otevřená před doplňkem. spusť ho tady nebo obnov stránku.",
    hintBlocked: "tuhle kartu nejde hnout. obnov ji nebo otevři obyčejnou stránku.",
    enabledLabel: "Zapnout klsv",
    darkLabel: "Tmavý režim",
    loading: "načítání…",
    previewOutside: "náhled mimo doplněk",
    off: "vypnuto. feed zůstává netknutý.",
    paused: "pauza na této kartě.",
    skipPage: "tuhle stránku nechávám být.",
    siteOff: "je vypnutý.",
    worksOn: "běží na",
    saveFailed: "nepodařilo se uložit",
    backgroundDown: "pozadí doplňku ještě nevstalo",
    modelOutside: "model v prohlížeči se spustí v načteném doplňku",
    modelSilent: "model ještě neodpovídá",
    ownPhrase: "tvoje fráze",
    threshold: "práh skrytí",
    thresholdHint: "čím výš, tím míň se musí nashromáždit.",
    mild: "mírná",
    medium: "střední",
    sharp: "ostrá",
    modelIdle: "model se spustí u prvního příspěvku a stáhne se jednou",
    modelStarting: "spouštím model",
    modelBrowser: "model prohlížeče je připravený",
    modelEmbed: "lehký model je připravený",
    modelOff: "model v prohlížeči je vypnutý",
    downloading: "stahuji",
  },
} as const;

export type CopyKey = keyof (typeof COPY)["pl"];

const CATEGORY_COPY: Record<UiLang, Record<CategoryId, { label: string; hint: string }>> = {
  pl: {
    ragebait: { label: "Prowokacja", hint: "Wpisy napisane tak, żeby wyciągnąć kłótnię." },
    toxicity: { label: "Szorstkie słowa", hint: "Obelgi, pogarda i nękanie." },
    ai_slop: { label: "Sztuczny połysk", hint: "Gładki tekst z generatora i filmy złożone przez model." },
    doom: { label: "Czarny scenariusz", hint: "Ciągły alarm zamiast treści." },
    clickbait: { label: "Pusta obietnica", hint: "Tytuł obiecuje coś, czego w środku nie ma." },
    spam: { label: "Nachalna reklama", hint: "Promocje i wstawione ogłoszenia." },
  },
  cs: {
    ragebait: { label: "Provokace", hint: "Příspěvky napsané tak, aby vytáhly hádku." },
    toxicity: { label: "Ostrá slova", hint: "Nadávky, pohrdání a obtěžování." },
    ai_slop: { label: "Umělý lesk", hint: "Hladký text z generátoru a videa složená modelem." },
    doom: { label: "Černý scénář", hint: "Pořádný poplach místo obsahu." },
    clickbait: { label: "Prázdný slib", hint: "Titulek slibuje něco, co uvnitř není." },
    spam: { label: "Vtíravá reklama", hint: "Akce a vložená oznámení." },
  },
};

const MODE_COPY: Record<UiLang, Record<Mode, { label: string; hint: string }>> = {
  pl: {
    soft: { label: "Miękko", hint: "Wpis zostaje w tym samym miejscu, ale jest rozmyty. Na wierzchu leży ciekawostka." },
    cover: { label: "Zasłona", hint: "Treści nie widać wcale. Zostaje karta w kolorze tła strony." },
    line: { label: "Jedna linia", hint: "Mocniejsze rozmycie i jedno zdanie zamiast całego akapitu." },
  },
  cs: {
    soft: { label: "Jemně", hint: "Příspěvek zůstane na místě, ale je rozmazaný. Navrchu leží zajímavost." },
    cover: { label: "Zástěna", hint: "Obsah není vidět vůbec. Zůstane karta v barvě pozadí stránky." },
    line: { label: "Jeden řádek", hint: "Silnější rozmazání a jedna věta místo celého odstavce." },
  },
};

const OPTIONS: Record<UiLang, Record<string, string>> = {
  pl: {
    lead: "Chowa z feedu prowokację, szorstkie słowa, czarny scenariusz, pustą obietnicę, nachalną reklamę i sztuczny połysk, także filmy złożone przez model. W to miejsce kładzie krótką ciekawostkę. Ramka zostaje tam, gdzie była.",
    note: "Nie chowa poglądów. Chowa zaczepkę, obelgę, alarm, reklamę i rzeczy z generatora. Pokaż oryginał pamięta wpis do odświeżenia karty. Zostaw autora zostaje tutaj. Skrót:",
    enabled: "włączone",
    reasonTitle: "podpisuj, dlaczego schowane",
    reasonHint: "Cichy nagłówek nad ciekawostką. Bez tego zostaje samo „klsv”.",
    factLanguage: "język ciekawostek",
    factHint: "Dotyczy tekstu w miejsce wpisu. Interfejs przełączasz osobno.",
    sitesNote: "X, Reddit, Facebook, Instagram, Threads, YouTube, LinkedIn, TikTok i Bluesky.",
    allowTitle: "zawsze pokazuj",
    allowHint: "Ma pierwszeństwo. Krótkie słowo przepuści pół feedu.",
    allowPlaceholder: "jedna fraza w linii, co najmniej 3 znaki",
    blockTitle: "zawsze chowaj",
    blockHint: "Działa nawet przy wyłączonych kategoriach.",
    blockPlaceholder: "jedna fraza w linii",
    authorsTitle: "autorzy, których zostawiam",
    authorsHint: "Na Facebooku imię bywa niestabilne. Na X i Bluesky lepiej zostawić nick.",
    authorsPlaceholder: "nick albo imię, jedno w linii",
    aiTitle: "AI",
    aiBody: "Słownik łapie znane frazy od razu, bez sieci. Model w przeglądarce czyta resztę wpisów, po polsku i po angielsku. Jeśli Chrome ma już swój model, użyje jego. Inaczej pobierze raz około 130 MB i zostawi je u siebie. Na serwer idą tylko wagi, nie treść wpisu.",
    neural: "model w przeglądarce",
    embedded: "dopasowanie fraz",
    cloud: "większy model obok, opcjonalnie",
    cloudBody: "To Ollama albo LM Studio na tym komputerze, na przykład qwen2.5:0.5b. Klucz zostaw pusty. Dostaje tylko wpisy blisko progu. Zdalny adres https też przejdzie, jeśli wkleisz klucz.",
    key: "klucz",
    show: "pokaż",
    hide: "ukryj",
    keyHint: "Klucz zostaje w lokalnym magazynie tej przeglądarki. Eksport go nie zabiera.",
    test: "sprawdź połączenie",
    playground: "plac zabaw",
    playgroundHint: "Wklej wpis. Werdykt liczy się tutaj, na twoich aktualnych ustawieniach. Do sieci nic nie idzie.",
    draftPlaceholder: "wklej wpis…",
    stats: "statystyki",
    since: "od początku",
    today: "dziś",
    emptyStats: "jeszcze pusto. feed sam się dziś zachowuje.",
    export: "eksport ustawień",
    import: "import",
    reset: "wyczyść wszystko",
    asking: "pytam…",
    onlyInside: "połączenie działa tylko w środku wtyczki.",
    needUrl: "podaj https albo http://127.0.0.1.",
    needPermission: "bez zgody przeglądarki model się nie odezwie.",
    connected: "jest połączenie.",
    checkFailed: "nie udało się sprawdzić.",
    importFailed: "tego pliku nie dało się wczytać.",
    unassigned: "nieprzypisany",
    onlyExtension: "tylko we wtyczce",
    saved: "zapisane",
    thresholdLong: "Przy łagodnej czułości chowam tylko wyraźne przypadki. Przy ostrej wystarczy jeden mocny sygnał.",
    paste: "Wklej wpis, zobacz werdykt.",
    previewEmpty: "Tu pojawi się ciekawostka, którą dostałby ten wpis.",
    wouldHide: "Schowałbym to.",
    wouldKeep: "Zostawiłbym to.",
    stays: "zostaje na feedzie",
    thresholdIs: "Próg to",
    sampleCalm: "spokojny",
    sampleRage: "ragebait",
    sampleSlop: "sztuczny połysk",
    sampleInsult: "obelga",
    sampleAd: "reklama",
  },
  cs: {
    lead: "Schovává z feedu provokaci, ostrá slova, černý scénář, prázdný slib, vtíravou reklamu a umělý lesk, včetně videí složených modelem. Na to místo položí krátkou zajímavost. Rám zůstane tam, kde byl.",
    note: "Neschovává názory. Schovává háček, nadávku, poplach, reklamu a věci z generátoru. Zobrazit originál si příspěvek pamatuje do obnovení karty. Nechat autora zůstane tady. Zkratka:",
    enabled: "zapnuto",
    reasonTitle: "podepisovat, proč je to schované",
    reasonHint: "Tichý nadpis nad zajímavostí. Bez toho zůstane jen „klsv“.",
    factLanguage: "jazyk zajímavostí",
    factHint: "Týká se textu místo příspěvku. Rozhraní přepínáš zvlášť.",
    sitesNote: "X, Reddit, Facebook, Instagram, Threads, YouTube, LinkedIn, TikTok a Bluesky.",
    allowTitle: "vždy ukázat",
    allowHint: "Má přednost. Krátké slovo pustí půl feedu.",
    allowPlaceholder: "jedna fráze na řádek, aspoň 3 znaky",
    blockTitle: "vždy schovat",
    blockHint: "Funguje i při vypnutých kategoriích.",
    blockPlaceholder: "jedna fráze na řádek",
    authorsTitle: "autoři, které nechávám",
    authorsHint: "Na Facebooku bývá jméno nestabilní. Na X a Bluesky je lepší nechat přezdívku.",
    authorsPlaceholder: "přezdívka nebo jméno, jedno na řádek",
    aiTitle: "AI",
    aiBody: "Slovník chytá známé fráze hned, bez sítě. Model v prohlížeči čte zbytek příspěvků, polsky i anglicky. Když už Chrome svůj model má, použije ho. Jinak si jednou stáhne asi 130 MB a nechá je u sebe. Na server jdou jen váhy, ne text příspěvku.",
    neural: "model v prohlížeči",
    embedded: "shoda frází",
    cloud: "větší model vedle, volitelně",
    cloudBody: "To je Ollama nebo LM Studio na tomhle počítači, třeba qwen2.5:0.5b. Klíč nech prázdný. Dostane jen příspěvky blízko prahu. Vzdálená adresa https taky projde, když vložíš klíč.",
    key: "klíč",
    show: "ukázat",
    hide: "skrýt",
    keyHint: "Klíč zůstane v místním úložišti tohohle prohlížeče. Export ho nebere.",
    test: "zkontrolovat spojení",
    playground: "hřiště",
    playgroundHint: "Vlož příspěvek. Verdikt se počítá tady, na tvém aktuálním nastavení. Do sítě nic nejde.",
    draftPlaceholder: "vlož příspěvek…",
    stats: "statistiky",
    since: "od začátku",
    today: "dnes",
    emptyStats: "ještě prázdno. feed se dnes chová sám.",
    export: "export nastavení",
    import: "import",
    reset: "vymazat všechno",
    asking: "ptám se…",
    onlyInside: "spojení funguje jen uvnitř doplňku.",
    needUrl: "dej https nebo http://127.0.0.1.",
    needPermission: "bez souhlasu prohlížeče se model neozve.",
    connected: "spojení je.",
    checkFailed: "nepodařilo se zkontrolovat.",
    importFailed: "tenhle soubor nešel načíst.",
    unassigned: "nepřiřazeno",
    onlyExtension: "jen v doplňku",
    saved: "uloženo",
    thresholdLong: "Při mírné citlivosti schovávám jen jasné případy. Při ostré stačí jeden silný signál.",
    paste: "Vlož příspěvek a uvidíš verdikt.",
    previewEmpty: "Tady se objeví zajímavost, kterou by ten příspěvek dostal.",
    wouldHide: "Schoval bych to.",
    wouldKeep: "Nechal bych to.",
    stays: "zůstává ve feedu",
    thresholdIs: "Práh je",
    sampleCalm: "klidný",
    sampleRage: "ragebait",
    sampleSlop: "umělý lesk",
    sampleInsult: "nadávka",
    sampleAd: "reklama",
  },
};

export function t(ui: UiLang, key: CopyKey): string {
  return COPY[ui][key];
}

export function optionText(ui: UiLang, key: string): string {
  return OPTIONS[ui][key] ?? OPTIONS.pl[key] ?? key;
}

export function categoryCopy(ui: UiLang, id: CategoryId): { label: string; hint: string } {
  return CATEGORY_COPY[ui][id];
}

export function modeCopy(ui: UiLang, id: Mode): { label: string; hint: string } {
  return MODE_COPY[ui][id];
}

export function sensitivityName(ui: UiLang, value: number): string {
  if (value < 35) return t(ui, "mild");
  if (value < 70) return t(ui, "medium");
  return t(ui, "sharp");
}

export function modelLine(ui: UiLang, detail: string): string {
  if (detail === "off") return t(ui, "modelOff");
  if (detail === "idle") return t(ui, "modelIdle");
  if (detail === "starting") return t(ui, "modelStarting");
  if (detail === "ready:browser") return t(ui, "modelBrowser");
  if (detail === "ready:embed") return t(ui, "modelEmbed");
  if (detail.startsWith("download:")) {
    const [, file = "wagi", progress] = detail.split(":");
    const percent = progress ? `, ${progress}%` : "";
    return `${t(ui, "downloading")} ${file}${percent}`;
  }
  if (detail.startsWith("error:")) return detail.slice("error:".length);
  return detail;
}

function anyText(ui: UiLang, key: string): string {
  const options = OPTIONS[ui];
  if (Object.prototype.hasOwnProperty.call(options, key)) return options[key] ?? key;
  const chrome = COPY[ui];
  if (Object.prototype.hasOwnProperty.call(chrome, key)) return chrome[key as CopyKey];
  return key;
}

export function applyStaticCopy(ui: UiLang): void {
  document.documentElement.lang = ui === "cs" ? "cs" : "pl";
  for (const node of document.querySelectorAll<HTMLElement>("[data-copy]")) {
    const key = node.dataset.copy;
    if (!key) continue;
    node.textContent = anyText(ui, key);
  }
  for (const node of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-copy-placeholder]")) {
    const key = node.dataset.copyPlaceholder;
    if (!key) continue;
    node.placeholder = anyText(ui, key);
  }
  for (const node of document.querySelectorAll<HTMLElement>("[data-copy-label]")) {
    const key = node.dataset.copyLabel;
    if (!key) continue;
    node.setAttribute("aria-label", anyText(ui, key));
  }
}
