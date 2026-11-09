import { categoryLabel } from "../shared/catalog.ts";
import { hashString } from "../shared/hash.ts";
import type { CategoryId, Lang, Verdict } from "../shared/types.ts";

interface Fact {
  pl: string;
  en: string;
}

export const FACTS: readonly Fact[] = [
  {
    pl: "Miód w zamkniętym słoiku prawie nie zawiera wody, więc bakterie nie mają czego pić.",
    en: "Honey in a sealed jar has so little water that bacteria have nothing to drink.",
  },
  {
    pl: "Ośmiornica ma trzy serca i niebieską krew.",
    en: "An octopus has three hearts and blue blood.",
  },
  {
    pl: "Pszczoła tańcem podaje innym pszczołom kierunek i odległość kwiatów.",
    en: "A honeybee tells other bees the direction and distance of flowers by dancing.",
  },
  {
    pl: "Wrony pamiętają ludzkie twarze i potrafią ostrzec przed nimi inne wrony.",
    en: "Crows remember human faces and can warn other crows about them.",
  },
  {
    pl: "Krewetka nosi serce w głowie.",
    en: "A shrimp keeps its heart in its head.",
  },
  {
    pl: "Banan jest, według botaniki, jagodą. Truskawka nią nie jest.",
    en: "A banana is a berry, botanically. A strawberry is not.",
  },
  {
    pl: "Na Marsie zachód Słońca jest niebieski: pył rozprasza czerwień i przy tarczy zostaje błękit.",
    en: "Sunsets on Mars are blue. Dust scatters the red light and leaves blue around the sun.",
  },
  {
    pl: "Kleopatra żyła bliżej powstania iPhone'a niż budowy wielkiej piramidy.",
    en: "Cleopatra lived closer in time to the iPhone than to the building of the Great Pyramid.",
  },
  {
    pl: "Rekiny są starsze niż drzewa. Pływały, zanim na lądzie stanęły lasy.",
    en: "Sharks are older than trees. They were swimming before forests stood on land.",
  },
  {
    pl: "Wieża Eiffla w upał rośnie o kilkanaście centymetrów.",
    en: "The Eiffel Tower grows by more than ten centimeters in hot weather.",
  },
  {
    pl: "Szkło w oknie nie spływa. Grubszy dół starych szyb to ślad po dawnej produkcji.",
    en: "Window glass does not flow. The thick bottom of old panes is a trace of how they were made.",
  },
  {
    pl: "Księżyc oddala się od Ziemi o około 4 centymetry rocznie.",
    en: "The Moon drifts about 4 centimeters farther from Earth every year.",
  },
  {
    pl: "Rów Mariański jest głębszy, niż Everest jest wysoki.",
    en: "The Mariana Trench is deeper than Everest is tall.",
  },
  {
    pl: "Zwykła kłębiasta chmura może ważyć tyle, co stado słoni.",
    en: "An ordinary cumulus cloud can weigh as much as a herd of elephants.",
  },
  {
    pl: "Kot mruczy nie tylko z zadowolenia. Mruczy też, żeby się uspokoić.",
    en: "A cat purrs not only from pleasure. It also purrs to calm itself down.",
  },
  {
    pl: "Leniwiec schodzi z drzewa mniej więcej raz na tydzień.",
    en: "A sloth climbs down from its tree about once a week.",
  },
  {
    pl: "Dolary amerykańskie są z bawełny i lnu, nie z papieru drzewnego.",
    en: "US dollar bills are made of cotton and linen, not wood paper.",
  },
  {
    pl: "Ziarno kawy to pestka owocu.",
    en: "A coffee bean is the seed of a fruit.",
  },
  {
    pl: "Motyl smakuje stopami.",
    en: "A butterfly tastes with its feet.",
  },
  {
    pl: "Błyskawica bywa gorętsza niż powierzchnia Słońca.",
    en: "A lightning bolt can be hotter than the surface of the Sun.",
  },
  {
    pl: "Przez twoje ciało co sekundę przelatują miliardy neutrin. Prawie żadne nie zostawia śladu.",
    en: "Billions of neutrinos pass through your body every second. Almost none leave a trace.",
  },
  {
    pl: "Wenus obraca się wokół własnej osi wolniej, niż obiega Słońce. Jeden obrót trwa dłużej niż jej rok.",
    en: "Venus spins more slowly than it orbits the Sun. One rotation takes longer than its year.",
  },
  {
    pl: "Pando w Utah to jeden organizm osiki, starszy niż jakiekolwiek miasto.",
    en: "Pando in Utah is a single aspen organism, older than any city.",
  },
  {
    pl: "Wydry morskie owijają się w wodorosty, żeby prąd nie zabrał ich w czasie snu.",
    en: "Sea otters wrap themselves in kelp so the current does not carry them off in their sleep.",
  },
  {
    pl: "Flamingi są różowe od karotenoidów w jedzeniu.",
    en: "Flamingos are pink because of carotenoids in their food.",
  },
  {
    pl: "Niektóre pingwiny wręczają partnerowi kamyk.",
    en: "Some penguins offer a pebble to a mate.",
  },
  {
    pl: "Futro dziobaka świeci na zielono-niebiesko w ultrafiolecie.",
    en: "A platypus's fur glows blue-green under ultraviolet light.",
  },
  {
    pl: "Ślady butów na Księżycu zostaną tam dłużej niż nasze miasta.",
    en: "Bootprints on the Moon will outlast our cities.",
  },
  {
    pl: "Korzenie drzew splatają się z grzybnią, która przenosi między nimi wodę i związki chemiczne.",
    en: "Tree roots weave into fungi that move water and chemicals between them.",
  },
  {
    pl: "W Suchych Dolinach Antarktydy są miejsca, gdzie deszcz nie padał od setek tysięcy lat.",
    en: "Parts of Antarctica's Dry Valleys have not seen rain for hundreds of thousands of years.",
  },
];

const KICKERS: Record<CategoryId, { pl: string; en: string }> = {
  ragebait: { pl: "zamiast iskry", en: "instead of a spark" },
  toxicity: { pl: "ciszej", en: "quieter" },
  ai_slop: { pl: "bez generatora", en: "no generator" },
  doom: { pl: "bez syreny", en: "no siren" },
  clickbait: { pl: "bez haczyka", en: "no hook" },
  spam: { pl: "bez oferty", en: "no pitch" },
};

export function factAt(seed: string): Fact {
  const index = hashString(seed) % FACTS.length;
  return FACTS[index] ?? FACTS[0]!;
}

export function replacementFor(
  seed: string,
  lang: Lang,
  verdict: Pick<Verdict, "top" | "custom">,
  showReason: boolean,
): { kicker: string; body: string } {
  const body = factAt(seed)[lang];
  if (!showReason) return { kicker: "klsv", body };
  if (verdict.custom && !verdict.top) return { kicker: "klsv · twoja fraza", body };
  if (verdict.top) return { kicker: `klsv · ${KICKERS[verdict.top][lang]}`, body };
  return { kicker: "klsv", body };
}

export function firstSentence(text: string): string {
  const match = /^[\s\S]{1,180}?[.!?]/u.exec(text);
  return (match?.[0] ?? text).trim();
}

export function reasonLine(verdict: Pick<Verdict, "top" | "custom">): string {
  if (verdict.custom && !verdict.top) return "twoja fraza";
  if (verdict.top) return categoryLabel(verdict.top);
  return "klsv";
}
