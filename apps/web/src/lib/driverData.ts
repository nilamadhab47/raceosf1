/**
 * Static driver metadata — photos, nationality, team info, etc.
 * Used by the DriverFocusModal for rich driver profiles.
 */

export interface DriverMeta {
  abbreviation: string;
  firstName: string;
  lastName: string;
  number: number;
  nationality: string;
  country_flag: string;
  team: string;
  teamFull: string;
  dob: string;
  photoUrl: string;
  helmetEmoji: string;
}

// Driver photo CDN pattern — uses media.formula1.com
const DRIVER_IMG = (firstName: string, lastName: string) =>
  `https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/${firstName[0].toUpperCase()}/${firstName.substring(0, 3).toUpperCase()}${lastName.substring(0, 3).toUpperCase()}01_${firstName}_${lastName}/${firstName.substring(0, 3).toLowerCase()}${lastName.substring(0, 3).toLowerCase()}01.png`;

const HEADSHOT = (code: string) =>
  `https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/${code.charAt(0)}/${code}01_${code.toLowerCase()}01.png`;

export const DRIVER_DATABASE: Record<string, DriverMeta> = {
  VER: { abbreviation: "VER", firstName: "Max", lastName: "Verstappen", number: 1, nationality: "Dutch", country_flag: "🇳🇱", team: "Red Bull Racing", teamFull: "Oracle Red Bull Racing", dob: "1997-09-30", photoUrl: DRIVER_IMG("Max", "Verstappen"), helmetEmoji: "🦁" },
  NOR: { abbreviation: "NOR", firstName: "Lando", lastName: "Norris", number: 4, nationality: "British", country_flag: "🇬🇧", team: "McLaren", teamFull: "McLaren Formula 1 Team", dob: "1999-11-13", photoUrl: DRIVER_IMG("Lando", "Norris"), helmetEmoji: "🧡" },
  LEC: { abbreviation: "LEC", firstName: "Charles", lastName: "Leclerc", number: 16, nationality: "Monegasque", country_flag: "🇲🇨", team: "Ferrari", teamFull: "Scuderia Ferrari", dob: "1997-10-16", photoUrl: DRIVER_IMG("Charles", "Leclerc"), helmetEmoji: "❤️" },
  PIA: { abbreviation: "PIA", firstName: "Oscar", lastName: "Piastri", number: 81, nationality: "Australian", country_flag: "🇦🇺", team: "McLaren", teamFull: "McLaren Formula 1 Team", dob: "2001-04-06", photoUrl: DRIVER_IMG("Oscar", "Piastri"), helmetEmoji: "🏖️" },
  SAI: { abbreviation: "SAI", firstName: "Carlos", lastName: "Sainz", number: 55, nationality: "Spanish", country_flag: "🇪🇸", team: "Williams", teamFull: "Williams Racing", dob: "1994-09-01", photoUrl: DRIVER_IMG("Carlos", "Sainz"), helmetEmoji: "🌶️" },
  HAM: { abbreviation: "HAM", firstName: "Lewis", lastName: "Hamilton", number: 44, nationality: "British", country_flag: "🇬🇧", team: "Ferrari", teamFull: "Scuderia Ferrari", dob: "1985-01-07", photoUrl: DRIVER_IMG("Lewis", "Hamilton"), helmetEmoji: "⭐" },
  RUS: { abbreviation: "RUS", firstName: "George", lastName: "Russell", number: 63, nationality: "British", country_flag: "🇬🇧", team: "Mercedes", teamFull: "Mercedes-AMG PETRONAS F1 Team", dob: "1998-02-15", photoUrl: DRIVER_IMG("George", "Russell"), helmetEmoji: "🪐" },
  PER: { abbreviation: "PER", firstName: "Sergio", lastName: "Perez", number: 11, nationality: "Mexican", country_flag: "🇲🇽", team: "Red Bull Racing", teamFull: "Oracle Red Bull Racing", dob: "1990-01-26", photoUrl: DRIVER_IMG("Sergio", "Perez"), helmetEmoji: "🇲🇽" },
  ALO: { abbreviation: "ALO", firstName: "Fernando", lastName: "Alonso", number: 14, nationality: "Spanish", country_flag: "🇪🇸", team: "Aston Martin", teamFull: "Aston Martin Aramco F1 Team", dob: "1981-07-29", photoUrl: DRIVER_IMG("Fernando", "Alonso"), helmetEmoji: "🐐" },
  STR: { abbreviation: "STR", firstName: "Lance", lastName: "Stroll", number: 18, nationality: "Canadian", country_flag: "🇨🇦", team: "Aston Martin", teamFull: "Aston Martin Aramco F1 Team", dob: "1998-10-29", photoUrl: DRIVER_IMG("Lance", "Stroll"), helmetEmoji: "🍁" },
  GAS: { abbreviation: "GAS", firstName: "Pierre", lastName: "Gasly", number: 10, nationality: "French", country_flag: "🇫🇷", team: "Alpine", teamFull: "BWT Alpine F1 Team", dob: "1996-02-07", photoUrl: DRIVER_IMG("Pierre", "Gasly"), helmetEmoji: "🗼" },
  OCO: { abbreviation: "OCO", firstName: "Esteban", lastName: "Ocon", number: 31, nationality: "French", country_flag: "🇫🇷", team: "Haas", teamFull: "MoneyGram Haas F1 Team", dob: "1996-09-17", photoUrl: DRIVER_IMG("Esteban", "Ocon"), helmetEmoji: "🇫🇷" },
  TSU: { abbreviation: "TSU", firstName: "Yuki", lastName: "Tsunoda", number: 22, nationality: "Japanese", country_flag: "🇯🇵", team: "RB", teamFull: "Visa Cash App RB F1 Team", dob: "2000-05-11", photoUrl: DRIVER_IMG("Yuki", "Tsunoda"), helmetEmoji: "🗾" },
  RIC: { abbreviation: "RIC", firstName: "Daniel", lastName: "Ricciardo", number: 3, nationality: "Australian", country_flag: "🇦🇺", team: "RB", teamFull: "Visa Cash App RB F1 Team", dob: "1989-07-01", photoUrl: DRIVER_IMG("Daniel", "Ricciardo"), helmetEmoji: "🍯" },
  HUL: { abbreviation: "HUL", firstName: "Nico", lastName: "Hulkenberg", number: 27, nationality: "German", country_flag: "🇩🇪", team: "Sauber", teamFull: "Stake F1 Team Kick Sauber", dob: "1987-08-19", photoUrl: DRIVER_IMG("Nico", "Hulkenberg"), helmetEmoji: "🇩🇪" },
  MAG: { abbreviation: "MAG", firstName: "Kevin", lastName: "Magnussen", number: 20, nationality: "Danish", country_flag: "🇩🇰", team: "Haas", teamFull: "MoneyGram Haas F1 Team", dob: "1992-10-05", photoUrl: DRIVER_IMG("Kevin", "Magnussen"), helmetEmoji: "🇩🇰" },
  BOT: { abbreviation: "BOT", firstName: "Valtteri", lastName: "Bottas", number: 77, nationality: "Finnish", country_flag: "🇫🇮", team: "Sauber", teamFull: "Stake F1 Team Kick Sauber", dob: "1989-08-28", photoUrl: DRIVER_IMG("Valtteri", "Bottas"), helmetEmoji: "🏔️" },
  ZHO: { abbreviation: "ZHO", firstName: "Guanyu", lastName: "Zhou", number: 24, nationality: "Chinese", country_flag: "🇨🇳", team: "Sauber", teamFull: "Stake F1 Team Kick Sauber", dob: "1999-05-30", photoUrl: DRIVER_IMG("Guanyu", "Zhou"), helmetEmoji: "🇨🇳" },
  ALB: { abbreviation: "ALB", firstName: "Alexander", lastName: "Albon", number: 23, nationality: "Thai", country_flag: "🇹🇭", team: "Williams", teamFull: "Williams Racing", dob: "1996-03-23", photoUrl: DRIVER_IMG("Alexander", "Albon"), helmetEmoji: "🇹🇭" },
  SAR: { abbreviation: "SAR", firstName: "Logan", lastName: "Sargeant", number: 2, nationality: "American", country_flag: "🇺🇸", team: "Williams", teamFull: "Williams Racing", dob: "2000-12-31", photoUrl: DRIVER_IMG("Logan", "Sargeant"), helmetEmoji: "🇺🇸" },
  LAW: { abbreviation: "LAW", firstName: "Liam", lastName: "Lawson", number: 30, nationality: "New Zealander", country_flag: "🇳🇿", team: "RB", teamFull: "Visa Cash App RB F1 Team", dob: "2002-02-11", photoUrl: DRIVER_IMG("Liam", "Lawson"), helmetEmoji: "🥝" },
  BEA: { abbreviation: "BEA", firstName: "Oliver", lastName: "Bearman", number: 87, nationality: "British", country_flag: "🇬🇧", team: "Haas", teamFull: "MoneyGram Haas F1 Team", dob: "2005-05-08", photoUrl: DRIVER_IMG("Oliver", "Bearman"), helmetEmoji: "🐻" },
  COL: { abbreviation: "COL", firstName: "Franco", lastName: "Colapinto", number: 43, nationality: "Argentine", country_flag: "🇦🇷", team: "Alpine", teamFull: "BWT Alpine F1 Team", dob: "2003-05-27", photoUrl: DRIVER_IMG("Franco", "Colapinto"), helmetEmoji: "🇦🇷" },
  DOO: { abbreviation: "DOO", firstName: "Jack", lastName: "Doohan", number: 7, nationality: "Australian", country_flag: "🇦🇺", team: "Alpine", teamFull: "BWT Alpine F1 Team", dob: "2003-01-20", photoUrl: DRIVER_IMG("Jack", "Doohan"), helmetEmoji: "🦘" },
  ANT: { abbreviation: "ANT", firstName: "Andrea Kimi", lastName: "Antonelli", number: 12, nationality: "Italian", country_flag: "🇮🇹", team: "Mercedes", teamFull: "Mercedes-AMG PETRONAS F1 Team", dob: "2006-08-25", photoUrl: DRIVER_IMG("Andrea Kimi", "Antonelli"), helmetEmoji: "🇮🇹" },
  HAD: { abbreviation: "HAD", firstName: "Isack", lastName: "Hadjar", number: 6, nationality: "French", country_flag: "🇫🇷", team: "RB", teamFull: "Visa Cash App RB F1 Team", dob: "2004-09-28", photoUrl: DRIVER_IMG("Isack", "Hadjar"), helmetEmoji: "🔥" },
  BOR: { abbreviation: "BOR", firstName: "Gabriel", lastName: "Bortoleto", number: 5, nationality: "Brazilian", country_flag: "🇧🇷", team: "Sauber", teamFull: "Stake F1 Team Kick Sauber", dob: "2004-10-14", photoUrl: DRIVER_IMG("Gabriel", "Bortoleto"), helmetEmoji: "🇧🇷" },
};

/** Get driver metadata, falling back to a generic entry */
export function getDriverMeta(abbreviation: string): DriverMeta | null {
  return DRIVER_DATABASE[abbreviation] ?? null;
}

/* ── Team Colors and Logos ────────────────────────────────────────── */

export interface TeamMeta {
  name: string;
  fullName: string;
  principal: string;
  engine: string;
  base: string;
  color: string;
  championships: number;
}

export const TEAM_DATABASE: Record<string, TeamMeta> = {
  "Red Bull Racing":    { name: "Red Bull Racing", fullName: "Oracle Red Bull Racing", principal: "Christian Horner", engine: "Honda RBPT", base: "Milton Keynes, UK", color: "#3671C6", championships: 6 },
  "McLaren":            { name: "McLaren", fullName: "McLaren Formula 1 Team", principal: "Andrea Stella", engine: "Mercedes", base: "Woking, UK", color: "#FF8000", championships: 8 },
  "Ferrari":            { name: "Ferrari", fullName: "Scuderia Ferrari", principal: "Fred Vasseur", engine: "Ferrari", base: "Maranello, Italy", color: "#E80020", championships: 16 },
  "Mercedes":           { name: "Mercedes", fullName: "Mercedes-AMG PETRONAS F1 Team", principal: "Toto Wolff", engine: "Mercedes", base: "Brackley, UK", color: "#27F4D2", championships: 8 },
  "Aston Martin":       { name: "Aston Martin", fullName: "Aston Martin Aramco F1 Team", principal: "Mike Krack", engine: "Mercedes", base: "Silverstone, UK", color: "#229971", championships: 0 },
  "Alpine":             { name: "Alpine", fullName: "BWT Alpine F1 Team", principal: "Oliver Oakes", engine: "Renault", base: "Enstone, UK", color: "#0093CC", championships: 2 },
  "Williams":           { name: "Williams", fullName: "Williams Racing", principal: "James Vowles", engine: "Mercedes", base: "Grove, UK", color: "#64C4FF", championships: 9 },
  "RB":                 { name: "RB", fullName: "Visa Cash App RB F1 Team", principal: "Laurent Mekies", engine: "Honda RBPT", base: "Faenza, Italy", color: "#6692FF", championships: 0 },
  "Haas":               { name: "Haas", fullName: "MoneyGram Haas F1 Team", principal: "Ayao Komatsu", engine: "Ferrari", base: "Kannapolis, USA", color: "#B6BABD", championships: 0 },
  "Sauber":             { name: "Sauber", fullName: "Stake F1 Team Kick Sauber", principal: "Mattia Binotto", engine: "Ferrari", base: "Hinwil, Switzerland", color: "#52E252", championships: 0 },
};

export function getTeamMeta(teamName: string): TeamMeta | null {
  // Try exact match first, then partial
  if (TEAM_DATABASE[teamName]) return TEAM_DATABASE[teamName];
  for (const [key, val] of Object.entries(TEAM_DATABASE)) {
    if (teamName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(teamName.toLowerCase())) {
      return val;
    }
  }
  return null;
}
