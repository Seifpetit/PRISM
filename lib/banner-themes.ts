/** Banner themes: each is a Pexels search. The catalog is what a person can pick their own selector from; their own
 * themes (any words they like) sit beside it. */

export type ThemeDef = { id: string; label: string; query: string; group: string };

const t = (group: string, label: string, query: string, id?: string): ThemeDef => ({
  id: id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  label,
  query,
  group,
});

export const THEME_CATALOG: ThemeDef[] = [
  t("History & culture", "Medieval", "medieval castle"),
  t("History & culture", "Renaissance", "renaissance painting"),
  t("History & culture", "Baroque", "baroque art architecture"),
  t("History & culture", "Ancient Rome", "ancient rome ruins"),
  t("History & culture", "Ancient Egypt", "ancient egypt pyramids"),
  t("History & culture", "Greek temples", "ancient greece temple"),
  t("History & culture", "Vikings", "viking norse"),
  t("History & culture", "Samurai", "samurai japan warrior"),
  t("History & culture", "Japan", "japan landscape"),
  t("History & culture", "Japan ancient art", "japanese ancient art ukiyo-e", "japan-art"),
  t("History & culture", "Asian landscape", "asian landscape", "asia"),
  t("History & culture", "Maya & Aztec", "maya aztec ancient art", "maya-aztec"),
  t("History & culture", "Chinese ink", "chinese ink painting"),
  t("History & culture", "Persian", "persian architecture mosaic"),
  t("History & culture", "Byzantine", "byzantine mosaic"),
  t("History & culture", "Gothic", "gothic cathedral"),
  t("Games & pop", "Gaming", "gaming setup neon"),
  t("Games & pop", "Retro arcade", "retro arcade 80s"),
  t("Games & pop", "Pixel art", "pixel art"),
  t("Games & pop", "Esports", "esports gaming"),
  t("Games & pop", "Cyberpunk", "cyberpunk neon city"),
  t("Games & pop", "Fantasy", "fantasy landscape magical"),
  t("Games & pop", "Sci-fi", "science fiction futuristic"),
  t("Games & pop", "Comics", "comic book pop art"),
  t("Vehicles", "Cars", "cars"),
  t("Vehicles", "Supercars", "supercar"),
  t("Vehicles", "Classic cars", "classic vintage car"),
  t("Vehicles", "Motorcycles", "motorcycle"),
  t("Vehicles", "Racing", "motorsport racing"),
  t("Vehicles", "Trains", "train railway"),
  t("Vehicles", "Aviation", "airplane sky"),
  t("Vehicles", "Sailing", "sailing boat sea"),
  t("Nature", "Nature", "nature landscape"),
  t("Nature", "Mountains", "mountains peaks"),
  t("Nature", "Forest", "forest trees"),
  t("Nature", "Desert", "desert dunes"),
  t("Nature", "Ocean", "ocean waves"),
  t("Nature", "Waterfalls", "waterfall"),
  t("Nature", "Northern lights", "northern lights aurora"),
  t("Nature", "Sunset", "sunset sky"),
  t("Nature", "Flowers", "flowers field"),
  t("Nature", "Snow", "snow winter landscape"),
  t("Nature", "Tropical", "tropical beach palm"),
  t("Nature", "Lakes", "lake reflection"),
  t("Nature", "Canyons", "canyon rock"),
  t("Nature", "Volcanoes", "volcano"),
  t("Nature", "Autumn", "autumn leaves"),
  t("Space", "Night sky", "night sky stars", "space"),
  t("Space", "Galaxy", "galaxy milky way"),
  t("Space", "Planets", "planets moon"),
  t("Space", "Nebula", "nebula cosmos"),
  t("City", "City skyline", "city skyline", "city"),
  t("City", "City at night", "city night lights"),
  t("City", "Tokyo streets", "tokyo street night"),
  t("City", "New York", "new york city"),
  t("City", "Bridges", "bridge architecture"),
  t("City", "Neon signs", "neon signs"),
  t("City", "Street", "street urban"),
  t("Art & design", "Abstract", "abstract gradient", "abstract"),
  t("Art & design", "Minimal", "minimal texture", "minimal"),
  t("Art & design", "Watercolor", "watercolor painting"),
  t("Art & design", "Geometric", "geometric pattern"),
  t("Art & design", "Marble", "marble texture"),
  t("Art & design", "Oil painting", "oil painting"),
  t("Art & design", "Graffiti", "graffiti street art"),
  t("Art & design", "Paper craft", "paper craft"),
  t("Art & design", "Black & white", "black and white photography"),
  t("Architecture", "Architecture", "architecture"),
  t("Architecture", "Modern buildings", "modern building glass"),
  t("Architecture", "Skyscrapers", "skyscraper"),
  t("Architecture", "Interiors", "interior design"),
  t("Architecture", "Castles", "castle"),
  t("Tech & work", "Technology", "technology"),
  t("Tech & work", "Circuit board", "circuit board electronics"),
  t("Tech & work", "Workspace", "workspace desk"),
  t("Tech & work", "Code", "programming code screen"),
  t("Tech & work", "Data", "data visualization"),
  t("Life", "Coffee", "coffee"),
  t("Life", "Food", "food"),
  t("Life", "Travel", "travel destination"),
  t("Life", "Fitness", "fitness gym"),
  t("Life", "Music", "music concert"),
  t("Life", "Books", "books library"),
  t("Life", "Fashion", "fashion"),
  t("Life", "Animals", "wildlife animals"),
];

/** The themes in the selector until the person changes them. */
export const DEFAULT_THEME_IDS = [
  "medieval",
  "renaissance",
  "japan",
  "asia",
  "japan-art",
  "maya-aztec",
  "gaming",
  "cars",
  "pixel-art",
  "nature",
  "abstract",
  "city",
  "space",
  "ocean",
  "minimal",
  "architecture",
];

export type ThemeState = {
  /** Ids shown in the selector: catalog themes and the person's own. */
  mine: string[];
  /** The ones ticked right now; their photos are mixed together. Empty means the featured set. */
  active: string[];
  /** Themes the person wrote themselves. */
  custom: ThemeDef[];
};

export const DEFAULT_THEMES: ThemeState = { mine: DEFAULT_THEME_IDS, active: [], custom: [] };

export const MAX_CUSTOM_THEMES = 24;
export const MAX_ACTIVE_THEMES = 6;

export function findTheme(id: string, custom: ThemeDef[]): ThemeDef | undefined {
  return THEME_CATALOG.find((theme) => theme.id === id) ?? custom.find((theme) => theme.id === id);
}

export function customTheme(text: string): ThemeDef | null {
  const label = text.trim().replace(/\s+/g, " ").slice(0, 40);
  if (label.length < 2) return null;
  return { id: `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme"}`, label, query: label, group: "Yours" };
}
