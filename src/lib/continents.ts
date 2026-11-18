// Which continent each country is in, for the Explore filter. Travel-style
// groupings: Central America and the Caribbean are in North America; Turkey,
// Cyprus and Russia in Europe; the Caucasus in Asia.

export const CONTINENTS = {
  AF: "Africa",
  AS: "Asia",
  EU: "Europe",
  NA: "North & Central America",
  SA: "South America",
  OC: "Oceania",
  AN: "Antarctica",
} as const;

export type Continent = keyof typeof CONTINENTS;
export const CONTINENT_CODES = Object.keys(CONTINENTS) as Continent[];

const MEMBERS: Record<Continent, string> = {
  AF: "DZ AO BJ BW BF BI CV CM CF TD KM CD CG CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW",
  AS: "AF AM AZ BH BD BT BN KH CN GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TM AE UZ VN YE",
  EU: "AX AL AD AT BY BE BA BG HR CY CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH TR UA GB VA",
  NA: "AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM",
  SA: "AR BO BR CL CO EC FK GF GY PY PE SR UY VE",
  OC: "AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF",
  AN: "AQ BV GS HM TF",
};

const BY_COUNTRY = new Map<string, Continent>(
  CONTINENT_CODES.flatMap((c) => MEMBERS[c].split(" ").map((code) => [code, c] as const)),
);

/** The continent of an ISO country code ("TH" → "AS"), or null if unknown. */
export function continentOf(countryCode: string): Continent | null {
  return BY_COUNTRY.get(countryCode.toUpperCase()) ?? null;
}

/** Every country code in a continent */
export function countriesIn(continent: Continent): string[] {
  return MEMBERS[continent].split(" ");
}
