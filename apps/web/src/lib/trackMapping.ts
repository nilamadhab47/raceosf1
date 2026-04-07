/** Maps FastF1 circuit keys to julesr0y SVG filenames in /public/tracks/ */
export interface TrackInfo {
  svg: string;
  name: string;
  country: string;
  laps: number;
  length: number; // km
}

export const trackMapping: Record<string, TrackInfo> = {
  bahrain: {
    svg: "bahrain-3.svg",
    name: "Bahrain International Circuit",
    country: "BH",
    laps: 57,
    length: 5.412,
  },
  jeddah: {
    svg: "jeddah-1.svg",
    name: "Jeddah Corniche Circuit",
    country: "SA",
    laps: 50,
    length: 6.174,
  },
  albert_park: {
    svg: "albert-park-5.svg",
    name: "Albert Park Circuit",
    country: "AU",
    laps: 58,
    length: 5.278,
  },
  suzuka: {
    svg: "suzuka-4.svg",
    name: "Suzuka International Racing Course",
    country: "JP",
    laps: 53,
    length: 5.807,
  },
  shanghai: {
    svg: "shanghai-1.svg",
    name: "Shanghai International Circuit",
    country: "CN",
    laps: 56,
    length: 5.451,
  },
  miami: {
    svg: "miami-1.svg",
    name: "Miami International Autodrome",
    country: "US",
    laps: 57,
    length: 5.412,
  },
  imola: {
    svg: "imola-3.svg",
    name: "Autodromo Enzo e Dino Ferrari",
    country: "IT",
    laps: 63,
    length: 4.909,
  },
  monaco: {
    svg: "monaco-3.svg",
    name: "Circuit de Monaco",
    country: "MC",
    laps: 78,
    length: 3.337,
  },
  catalunya: {
    svg: "catalunya-6.svg",
    name: "Circuit de Barcelona-Catalunya",
    country: "ES",
    laps: 66,
    length: 4.657,
  },
  red_bull_ring: {
    svg: "red-bull-ring-4.svg",
    name: "Red Bull Ring",
    country: "AT",
    laps: 71,
    length: 4.318,
  },
  silverstone: {
    svg: "silverstone-7.svg",
    name: "Silverstone Circuit",
    country: "GB",
    laps: 52,
    length: 5.891,
  },
  hungaroring: {
    svg: "hungaroring-3.svg",
    name: "Hungaroring",
    country: "HU",
    laps: 70,
    length: 4.381,
  },
  spa: {
    svg: "spa-5.svg",
    name: "Circuit de Spa-Francorchamps",
    country: "BE",
    laps: 44,
    length: 7.004,
  },
  zandvoort: {
    svg: "zandvoort-4.svg",
    name: "Circuit Zandvoort",
    country: "NL",
    laps: 72,
    length: 4.259,
  },
  monza: {
    svg: "monza-4.svg",
    name: "Autodromo Nazionale Monza",
    country: "IT",
    laps: 53,
    length: 5.793,
  },
  baku: {
    svg: "baku-1.svg",
    name: "Baku City Circuit",
    country: "AZ",
    laps: 51,
    length: 6.003,
  },
  marina_bay: {
    svg: "marina-bay-4.svg",
    name: "Marina Bay Street Circuit",
    country: "SG",
    laps: 62,
    length: 4.940,
  },
  austin: {
    svg: "austin-1.svg",
    name: "Circuit of the Americas",
    country: "US",
    laps: 56,
    length: 5.513,
  },
  interlagos: {
    svg: "interlagos-3.svg",
    name: "Autódromo José Carlos Pace",
    country: "BR",
    laps: 71,
    length: 4.309,
  },
  las_vegas: {
    svg: "las-vegas-1.svg",
    name: "Las Vegas Strip Circuit",
    country: "US",
    laps: 50,
    length: 6.201,
  },
  lusail: {
    svg: "lusail-2.svg",
    name: "Lusail International Circuit",
    country: "QA",
    laps: 57,
    length: 5.419,
  },
  yas_marina: {
    svg: "yas-marina-3.svg",
    name: "Yas Marina Circuit",
    country: "AE",
    laps: 58,
    length: 5.281,
  },
};

/** Alternative name lookups — map common FastF1 circuit references to our keys */
const aliases: Record<string, string> = {
  "sakhir": "bahrain",
  "bahrain international circuit": "bahrain",
  "jeddah corniche circuit": "jeddah",
  "albert park": "albert_park",
  "melbourne": "albert_park",
  "suzuka international racing course": "suzuka",
  "shanghai international circuit": "shanghai",
  "miami international autodrome": "miami",
  "autodromo enzo e dino ferrari": "imola",
  "circuit de monaco": "monaco",
  "monte carlo": "monaco",
  "circuit de barcelona-catalunya": "catalunya",
  "barcelona": "catalunya",
  "red bull ring": "red_bull_ring",
  "spielberg": "red_bull_ring",
  "silverstone circuit": "silverstone",
  "hungaroring": "hungaroring",
  "budapest": "hungaroring",
  "circuit de spa-francorchamps": "spa",
  "spa-francorchamps": "spa",
  "circuit zandvoort": "zandvoort",
  "autodromo nazionale monza": "monza",
  "baku city circuit": "baku",
  "marina bay street circuit": "marina_bay",
  "singapore": "marina_bay",
  "circuit of the americas": "austin",
  "cota": "austin",
  "autódromo josé carlos pace": "interlagos",
  "são paulo": "interlagos",
  "sao paulo": "interlagos",
  "las vegas strip circuit": "las_vegas",
  "lusail international circuit": "lusail",
  "qatar": "lusail",
  "yas marina circuit": "yas_marina",
  "abu dhabi": "yas_marina",
};

export function resolveTrack(circuitRef: string): TrackInfo | null {
  const key = circuitRef.toLowerCase().trim();
  if (trackMapping[key]) return trackMapping[key];
  const aliasKey = aliases[key];
  if (aliasKey && trackMapping[aliasKey]) return trackMapping[aliasKey];
  // Fuzzy: check if any key is contained in the ref
  for (const [k, info] of Object.entries(trackMapping)) {
    if (key.includes(k.replace(/_/g, " ")) || key.includes(k)) return info;
  }
  return null;
}
