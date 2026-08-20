/**
 * Static geographic reference data for CAPFLUX KYC forms.
 *
 * All datasets are embedded in the bundle — no network dependency required.
 * This is critical for CAPFLUX's offline-first design and Nigerian infrastructure
 * conditions (poor networks, limited connectivity).
 *
 * Canonical values: the `value` strings are the authoritative internal identifiers
 * used by both frontend dropdowns and persisted to the backend.
 */

export interface CountryOption {
  value: string;
  label: string;
}

export interface StateOption {
  value: string;
  label: string;
}

export interface LgaOption {
  value: string;
  label: string;
}

// ── West African countries ─────────────────────────────────────────

export const WEST_AFRICAN_COUNTRIES: CountryOption[] = [
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Sierra Leone', label: 'Sierra Leone' },
  { value: 'Liberia', label: 'Liberia' },
  { value: 'The Gambia', label: 'The Gambia' },
  { value: 'Senegal', label: 'Senegal' },
  { value: 'Guinea', label: 'Guinea' },
  { value: 'Guinea-Bissau', label: 'Guinea-Bissau' },
  { value: 'Mali', label: 'Mali' },
  { value: 'Burkina Faso', label: 'Burkina Faso' },
  { value: "Côte d'Ivoire", label: "Côte d'Ivoire" },
  { value: 'Togo', label: 'Togo' },
  { value: 'Benin', label: 'Benin' },
  { value: 'Niger', label: 'Niger' },
  { value: 'Cabo Verde', label: 'Cabo Verde' },
  { value: 'Mauritania', label: 'Mauritania' },
];

// ── Nigerian States (36 + FCT = 37) ─────────────────────────────────

export const NIGERIAN_STATES: StateOption[] = [
  { value: 'Abia', label: 'Abia' },
  { value: 'Adamawa', label: 'Adamawa' },
  { value: 'Akwa Ibom', label: 'Akwa Ibom' },
  { value: 'Anambra', label: 'Anambra' },
  { value: 'Bauchi', label: 'Bauchi' },
  { value: 'Bayelsa', label: 'Bayelsa' },
  { value: 'Benue', label: 'Benue' },
  { value: 'Borno', label: 'Borno' },
  { value: 'Cross River', label: 'Cross River' },
  { value: 'Delta', label: 'Delta' },
  { value: 'Ebonyi', label: 'Ebonyi' },
  { value: 'Edo', label: 'Edo' },
  { value: 'Ekiti', label: 'Ekiti' },
  { value: 'Enugu', label: 'Enugu' },
  { value: 'Gombe', label: 'Gombe' },
  { value: 'Imo', label: 'Imo' },
  { value: 'Jigawa', label: 'Jigawa' },
  { value: 'Kaduna', label: 'Kaduna' },
  { value: 'Kano', label: 'Kano' },
  { value: 'Katsina', label: 'Katsina' },
  { value: 'Kebbi', label: 'Kebbi' },
  { value: 'Kogi', label: 'Kogi' },
  { value: 'Kwara', label: 'Kwara' },
  { value: 'Lagos', label: 'Lagos' },
  { value: 'Nasarawa', label: 'Nasarawa' },
  { value: 'Niger', label: 'Niger (State)' },
  { value: 'Ogun', label: 'Ogun' },
  { value: 'Ondo', label: 'Ondo' },
  { value: 'Osun', label: 'Osun' },
  { value: 'Oyo', label: 'Oyo' },
  { value: 'Plateau', label: 'Plateau' },
  { value: 'Rivers', label: 'Rivers' },
  { value: 'Sokoto', label: 'Sokoto' },
  { value: 'Taraba', label: 'Taraba' },
  { value: 'Yobe', label: 'Yobe' },
  { value: 'Zamfara', label: 'Zamfara' },
  { value: 'Federal Capital Territory', label: 'Federal Capital Territory' },
];

// ── Nigerian LGAs by State ──────────────────────────────────────────

const _lgas: Record<string, string[]> = {
  Abia: ['Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano', 'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwato', 'Obi Ngwa', 'Osisioma', 'Ugwunagbo', 'Ukwa East', 'Ukwa West', 'Umuahia North', 'Umuahia South', 'Umuene'],
  Adamawa: ['Gombi', 'Hong', 'Jada', 'Girei', 'Shelleng', 'Yola North', 'Yola South', 'Demsa', 'Mayo Belwa', 'Michika', 'Mubi North', 'Mubi South', 'Numan', 'Shomgom', 'Toungo', 'Madagali', 'Guyuk', 'Lamurde'],
  'Akwa Ibom': ['Abak', 'Eastern Obolo', 'Eket', 'Esit', 'Essien', 'Etinan', 'Ibeno', 'Ibesikpo Asutan', 'Ibiono Ibom', 'Iquita', 'Itu', 'Mbo', 'Obot Akara', 'Okon', 'Oruk Anam', 'Ukanun', 'Onna', 'Oron', 'Uyo', 'Nsit Ayerep', 'Nsit Ibom', 'Nsit Udubio', 'Ikot Ekpene'],
  Anambra: ['Aguata', 'Anambra East', 'Anambra West', 'Awka North', 'Awka South', 'Dunukofia', 'Idemili North', 'Idemili South', 'Ihiala', 'Nnewi North', 'Nnewi South', 'Ogbaru', 'Onitsha North', 'Onitsha South', 'Orumba North', 'Orumba South', 'Oyi'],
  Bauchi: ['Alkaleri', 'Darazo', 'Dugwaza', 'Ganngere', 'Gombe', 'Jama', 'Katagun', 'Kirfi', 'Kaltungo', 'Misau', 'Ningi', 'Shira', 'Tafawa Balewa', 'Toro', 'Warji', 'Baya'],
  Bayelsa: ['Brass', 'Yenagoa', 'Ogbia', 'Sagbama', 'Southern Jaw', 'Kolokolo', 'Ekeremor', 'Wilberforce'],
  Benue: ['Ado', 'Agatu', 'Apa', 'Buruku', 'Guma', 'Gwer-East', 'Gwer-West', 'Igyor', 'Ijuma', 'Ogbadibo', 'Ohimini', 'Oju', 'Okpokwu', 'Oturkpo', 'Tarka', 'Vandeikya', 'Konshisha', 'Makurdi', 'Obi', 'Tever', 'Otukpo', 'Ushongo', 'Ukurabita', 'Abili', 'Anyiin', 'Benco'],
  Borno: ['Abadam', 'Askira', 'Bama', 'Bay', 'Bekes', 'Boi', 'Chai', 'Damaturu', 'Dikwa', 'Dutsen', 'Gamboru', 'Gwoza', 'Hawul', 'Jere', 'Kaga', 'Konduga', 'Kukuma', 'Mafa', 'Magarwa', 'Maiduguri', 'Marte', 'Mobbar', 'Monguno', 'Ngala', 'Nganzai', 'Sakura', 'Shani'],
  'Cross River': ['Abi', 'Akamkpa', 'Akpom', 'Akwa', 'Bekwarra', 'Bian', 'Calabar', 'Calabar Municipal', 'Clare', 'Eket', 'Essien', 'Etinan', 'Ikot Ekpene', 'Ikom', 'Oban', 'Obubra', 'Obudu', 'Odukpani', 'Ogoja', 'Okokwo', 'Yakurr', 'Yala', 'Boki', 'Biase', 'Odukpani'],
  Delta: ['Oshimili North', 'Oshimili South', 'Ika North', 'Ika South', 'Ndokwa East', 'Ndokwa West', 'Warri North', 'Warri South', 'Warri South West', 'Ethiope East', 'Ethiope West', 'Ukwuani', 'Aniocha North', 'Aniocha South', 'Bomadi', 'Edo', 'Oghara', 'Umu', 'Okomuku', 'Ossiom', 'Oghara', 'Kwale', 'Ughelli North', 'Ughelli South'],
  Ebonyi: ['Abakaliki', 'Afikpo', 'Onnion', 'Ezza', 'Oha', 'Ikwo', 'Ivo', 'Ohaozara', 'Ozizza', 'Ezza North', 'Ezza South', 'Ohaukwu', 'Ikwo', 'Onicho', 'Onitsha', 'Nsukka'],
  Edo: ['Ishan East', 'Ishan South', 'Etsako East', 'Etsako West', 'Oredo', 'Ovia East', 'Ovia North East', 'Ovia South West', 'Owan East', 'Owan West', 'Uhunmwonde', 'Akure', 'Auchi', 'Benin', 'Ekpoma', 'Ewu', 'Fugar', 'Igue', 'Igbesanmwan', 'Ikpoba', 'Ile', 'Owan', 'Uhum', 'Uhunmwonde'],
  Ekiti: ['Ado Ekiti', 'Ikere', 'Ise', 'Ekiti East', 'Ekiti West', 'Ekiti South West', 'Efon', 'Emure', 'Ido', 'Ido Osi', 'Ijero', 'Ikole', 'Irepodun', 'Oye', 'Oye North', 'Oye South', 'Gbonyin', 'Ifelodun'],
  Enugu: ['Enugu East', 'Enugu North', 'Enugu South', 'Aninri', 'Awgu', 'Ezeagu', 'Nkanu', 'Nkanu East', 'Nkanu West', 'Oji', 'Udi', 'Udi East', 'Udi West', 'Nsukka', 'Igbo Etche'],
  Gombe: ['Akko', 'Balanga', 'Bogoro', 'Dabak', 'Dukur', 'Funakaye', 'Gombe', 'Kaltungo', 'Kwaya', 'Malan', 'Mai', 'Obi', 'Shomgom', 'Tafawa', 'Yamaltu', 'Billiri'],
  Imo: ['Aboh', 'Ahiazu', 'Arochukwu', 'Bende', 'Ikeduru', 'Isiala Ngwa North', 'Isiala Ngwa South', 'Ihitte', 'Mbait', 'Ngor', 'Njaba', 'Nsit', 'Okigwe', 'Oru East', 'Oru West', 'Orsu', 'Orumba North', 'Orumba South', 'Umu', 'Umuahia North', 'Umuahia South', 'Onuimo'],
  Jigawa: ['Birnin Kudu', 'Dutse', 'Gagarawa', 'Gombe', 'Hadejia', 'Jigawa', 'Kafin', 'Kankara', 'Kano', 'Katsina', 'Kiri', 'Maigatari', 'Malumfashi', 'Suleja', 'Dutse', 'Gwaram', 'Taura'],
  Kaduna: ['Birnin Gwari', 'Chikun', 'Gijawa', 'Igabi', 'Ikara', 'Jaba', 'Jema', 'Kachia', 'Kaduna', 'Kagarko', 'Kudan', 'Laugwak', 'Lere', 'Made', 'Sob', 'Zaria', 'Kaduna North', 'Kaduna South', 'Soba', 'Tafa'],
  Kano: ['Albasu', 'Ajingi', 'Bebeji', 'Bichi', 'Daw', 'Doguwa', 'Fagge', 'Gabas', 'Garki', 'Kano Municipal', 'Kibiya', 'Kiru', 'Kumbotso', 'Kura', 'Madobi', 'Makoda', 'Minjibir', 'Nassawa', 'Rabi', 'Rano', 'Shan', 'Takai', 'Tara', 'Tofa', 'Warawa', 'Wudil'],
  Katsina: ['Batagarawa', 'Batsari', 'Charmagaz', 'Daura', 'Dutsin', 'Faskari', 'Funtua', 'Gamawa', 'Gobir', 'Katsina', 'Kusada', 'Laf', 'Mata', 'Matsa', 'Sa', 'Sabon', 'Saul', 'Shata', 'Tasawa', 'Zeng'],
  Kebbi: ['Ale', 'Arewa', 'Argungu', 'Birnin Kebbi', 'Bunza', 'Dandi', 'Funtua', 'Gandu', 'Gulu', 'Isa', 'Kebbi', 'Keffi', 'Kokun', 'Maiyama', 'Malo', 'Ngaski', 'Sakpe', 'Shayi', 'Suru', 'Was', 'Zuru', 'Doma'],
  Kogi: ['Adavi', 'Adavi East', 'Adavi West', 'Aja', 'Ank', 'Bassa', 'Dekina', 'Ibaderin', 'Idah', 'Igala East', 'Igala West', 'Ijumu', 'Kogi', 'Lokoja', 'Magaji', 'Mopa', 'Obe', 'Ofu', 'Okene', 'Okehi', 'Okehi', 'Olamaboro', 'Omala', 'Okene'],
  Kwara: ['Baruten', 'Edu', 'Ekiti', 'Ibadan', 'Ilorin', 'Ilorin East', 'Ilorin Kwara', 'Ilorin South', 'Ilorin West', 'Kaiama', 'Moro', 'Offa', 'Oke', 'Oyun', 'Pategi', 'Remo', 'Sokoto', 'Weppa', 'Ifelodun', 'Odo'],
  Lagos: ['Agege', 'Ajeromi', 'Alimosho', 'Apapa', 'Badagry', 'Epe', 'Ikeja', 'Lagos Island', 'Lagos Mainland', 'Lekki', 'Mushin', 'Ojo', 'Oshodi', 'Somolu', 'Surulere', 'Eti Osa', 'Ibeju', 'Ifako/Ijaiye', 'Ikoyi'],
  Nasarawa: ['Akwanga', 'Lafia', 'Doma', 'Nasarawa', 'Nasarawa East', 'Nasarawa West', 'Keana', 'Keffi', 'Kokona', 'Giwa', 'Obi', 'Toto', 'Wash', 'Guma', 'Awe'],
  'Niger (State)': ['Aga', 'Bosso', 'Chachanga', 'Edati', 'Etsuba', 'Gbako', 'Gurara', 'Igbo', 'Katcha', 'Magama', 'Mariga', 'Mashegu', 'Nasko', 'Rijau', 'Suleja', 'Tara', 'Wawa', 'Wushishi', 'Niger North', 'Niger South'],
  Ogun: ['Abeokuta', 'Ado', 'Egbado North', 'Egbado South', 'Ewekoro', 'Ifo', 'Ikenne', 'Ijebu', 'Ijebu East', 'Ijebu North', 'Ijebu North East', 'Ijebu West', 'Ilaro', 'Imeko', 'Imeko East', 'Ipokia', 'Obafemi', 'Odogbolu', 'Ogun East', 'Ogun West', 'Remo North', 'Remo South', 'Shagamu', 'Yewa North', 'Yewa South'],
  Ondo: ['Akoko North East', 'Akoko North West', 'Akoko South East', 'Akoko South West', 'Akure North', 'Akure South', 'Ekiti', 'Idanre', 'Ifedore', 'Ilaje', 'Ile Oluji', 'Ilesa', 'Irepodun', 'Odigbo', 'Okitipupa', 'Ondo East', 'Ondo West', 'Ondo', 'Ose', 'Owo'],
  Osun: ['Ale', 'Ba', 'Ejig', 'Ife', 'Ilesa', 'Ilesa East', 'Ilesa West', 'Ife North', 'Ife South', 'Osun', 'Osogbo', 'Irepodun', 'Obo', 'Obo North', 'Obo South', 'Omuma', 'Bolifa', 'Bosso'],
  Oyo: ['Afijio', 'Akinyele', 'Atiba', 'Atisbo', 'Egbeda', 'Ibadan', 'Ibadan North', 'Ibadan North East', 'Ibadan North West', 'Ibadan South East', 'Ibadan South West', 'Ibarapa East', 'Ibarapa North', 'Iseyin', 'Itesiwaju', 'Iwajola', 'Mori', 'Ogbomosho', 'Ogbomosho North', 'Ogbomosho South', 'Oyo', 'Oyo East', 'Oyo West', 'Saki', 'Saki East', 'Saki West', 'Surulere', 'Tede'],
  Plateau: ['Barkin Laka', 'Buji', 'Dengi', 'Gurunsi', 'Jos', 'Jos East', 'Jos North', 'Jos South', 'Kanam', 'Kanke', 'Kwall', 'Langtang', 'Lau', 'Mikang', 'Pankshin', 'Qua', 'Qua North', 'Qua South', 'Riyom', 'Shendam', 'Vatican', 'Wase', 'Bokkos', 'Dengi'],
  Rivers: ['Abua', 'Abua', 'Adogbo', 'Ahoada', 'Ahoada East', 'Ahoada West', 'Akinima', 'Alim', 'Amush', 'Andoni', 'Asari', 'Bonny', 'Buguma', 'Degema', 'Eleme', 'Eleme East', 'Eleme West', 'Emu', 'Enugu', 'Gokana', 'Gom', 'Ikwerre', 'Oban', 'Obi', 'Obi Ngwa', 'Ogba', 'Ogba East', 'Ogba West', 'Omuma', 'Port Harcourt', 'Port Harcourt City', 'Tai'],
  Sokoto: ['Bin', 'Bodinga', 'Dange', 'Dzara', 'Gobir', 'Gwi', 'Hungu', 'Isa', 'Kebbe', 'Kware', 'Marafa', 'Rabba', 'Sabon Birni', 'Safi', 'Sokoto', 'Sokoto North', 'Sokoto South', 'Tambu', 'Tangaza', 'Ture', 'Wamak', 'Wank'],
  Taraba: ['Ardo Kola', 'Bali', 'Donga', 'Gassol', 'Ibi', 'Jalingo', 'Jalingo East', 'Jalingo West', 'Kurmi', 'Lau', 'Songo', 'Takum', 'Ussa', 'Vale', 'Yandang', 'Yola', 'Zing'],
  Yobe: ['Bade', 'Borsh', 'Damaturu', 'Dap', 'Fika', 'Fune', 'Geidam', 'Gu', 'Ja', 'Jak', 'Jere', 'Kukuma', 'Mach', 'Mam', 'Potiskum'],
  Zamfara: ['Anka', 'Birnin Magaji', 'Bunkure', 'Chafe', 'Gummi', 'Gusau', 'Kaura', 'Maradun', 'Maru', 'Shinkafi', 'Shonga', 'Tal', 'Tsafe', 'Zamfara', 'Zurafa'],
  'Federal Capital Territory': ['Abaji', 'Abuja Municipal', 'Bwari', 'Gwaggi', 'Gwagwal', 'Gwagwala', 'Kuje', 'Kubwa', 'Kwali', 'Lugbe', 'Maitama'],
};

/**
 * Build a deduplicated LGA list for a given state.
 */
export const NIGERIAN_LGAS: Record<string, LgaOption[]> = (() => {
  const result: Record<string, LgaOption[]> = {};
  for (const [state, lgas] of Object.entries(_lgas)) {
    const seen = new Set<string>();
    result[state] = [];
    for (const lga of lgas) {
      if (!seen.has(lga)) {
        seen.add(lga);
        result[state].push({ value: lga, label: lga });
      }
    }
  }
  return result;
})();

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Returns the LGA options for the given state. Returns an empty array if the
 * state has no known LGAs or if the state is not a Nigerian state.
 */
export function getLgasForState(state: string | null | undefined): LgaOption[] {
  if (!state || !NIGERIAN_LGAS[state]) return [];
  return NIGERIAN_LGAS[state];
}

/**
 * Returns true if the given country is Nigeria (the only country with
 * structured state/LGA data).
 */
export function hasStructuredStates(country: string | null | undefined): boolean {
  return country === 'Nigeria';
}

/**
 * Returns the state options for the given country. For non-Nigeria countries,
 * returns an empty array (the form should show a free-text state field instead).
 */
export function getStatesForCountry(country: string | null | undefined): StateOption[] {
  if (hasStructuredStates(country)) return NIGERIAN_STATES;
  return [];
}

/**
 * Returns country options (always available offline).
 */
export function getCountryOptions(): CountryOption[] {
  return WEST_AFRICAN_COUNTRIES;
}

/**
 * Country code aliases — maps common short codes to canonical values.
 */
const COUNTRY_CODE_ALIASES: Record<string, string> = {
  ng: 'Nigeria',
  gh: 'Ghana',
  sl: 'Sierra Leone',
  lr: 'Liberia',
  gm: 'The Gambia',
  sn: 'Senegal',
  gn: 'Guinea',
  gw: 'Guinea-Bissau',
  ml: 'Mali',
  bf: 'Burkina Faso',
  ci: "Côte d'Ivoire",
  tg: 'Togo',
  bj: 'Benin',
  ne: 'Niger',
  cv: 'Cabo Verde',
  mr: 'Mauritania',
};

/**
 * Normalizes a country value for storage. Accepts canonical value, display
 * label, lowercase variant, or country code and returns the canonical value.
 */
export function normalizeCountry(value: string | null | undefined): string {
  if (!value) return 'Nigeria';
  const lower = value.toLowerCase().trim();
  // Check country code aliases (e.g. 'NG' → 'Nigeria')
  const codeMatch = COUNTRY_CODE_ALIASES[lower];
  if (codeMatch) return codeMatch;
  // Check exact value or label match
  const exact = WEST_AFRICAN_COUNTRIES.find((c) => c.value === value || c.label === value);
  if (exact) return exact.value;
  // Check case-insensitive match on value/label
  const ci = WEST_AFRICAN_COUNTRIES.find((c) => c.value.toLowerCase() === lower || c.label.toLowerCase() === lower);
  if (ci) return ci.value;
  return value;
}

/**
 * Validates that a country value is one of the supported West African countries.
 */
export function isValidCountry(value: string | null | undefined): boolean {
  if (!value) return false;
  return WEST_AFRICAN_COUNTRIES.some((c) => c.value === value || c.label === value);
}
