/**
 * Mapping NAF/APE division (2 premiers chiffres du code) → libellé secteur.
 * Basé sur la nomenclature NAF rév. 2 (INSEE 2008).
 * Utilisé pour pré-remplir le champ "secteur" lors de la sync Pappers.
 */
const NAF_DIVISION_TO_SECTOR: Record<string, string> = {
  // A — Agriculture, sylviculture et pêche
  "01": "Agriculture",
  "02": "Sylviculture et exploitation forestière",
  "03": "Pêche et aquaculture",

  // B — Industries extractives
  "05": "Extraction de charbon et de lignite",
  "06": "Extraction d'hydrocarbures",
  "07": "Extraction de minerais métalliques",
  "08": "Autres industries extractives",
  "09": "Services de soutien aux industries extractives",

  // C — Industrie manufacturière
  "10": "Industries alimentaires",
  "11": "Fabrication de boissons",
  "12": "Fabrication de produits à base de tabac",
  "13": "Fabrication de textiles",
  "14": "Industrie de l'habillement",
  "15": "Industrie du cuir et de la chaussure",
  "16": "Travail du bois et fabrication d'articles en bois",
  "17": "Industrie papier-carton",
  "18": "Imprimerie et reproduction d'enregistrements",
  "19": "Cokéfaction et raffinage",
  "20": "Industrie chimique",
  "21": "Industrie pharmaceutique",
  "22": "Fabrication de produits en caoutchouc et plastique",
  "23": "Fabrication de produits minéraux non métalliques",
  "24": "Métallurgie",
  "25": "Fabrication de produits métalliques",
  "26": "Fabrication de produits informatiques et électroniques",
  "27": "Fabrication d'équipements électriques",
  "28": "Fabrication de machines et équipements",
  "29": "Industrie automobile",
  "30": "Fabrication d'autres matériels de transport",
  "31": "Fabrication de meubles",
  "32": "Autres industries manufacturières",
  "33": "Réparation et installation de machines",

  // D — Énergie
  "35": "Production et distribution d'énergie",

  // E — Eau, assainissement, déchets
  "36": "Captage, traitement et distribution d'eau",
  "37": "Collecte et traitement des eaux usées",
  "38": "Collecte, traitement et élimination des déchets",
  "39": "Dépollution et gestion des déchets",

  // F — Construction
  "41": "Promotion et construction immobilière",
  "42": "Génie civil",
  "43": "Travaux de construction spécialisés",

  // G — Commerce
  "45": "Commerce et réparation automobile",
  "46": "Commerce de gros",
  "47": "Commerce de détail",

  // H — Transport
  "49": "Transports terrestres et transport par conduites",
  "50": "Transports par eau",
  "51": "Transports aériens",
  "52": "Entreposage et services auxiliaires des transports",
  "53": "Activités de poste et de courrier",

  // I — Hébergement et restauration
  "55": "Hébergement",
  "56": "Restauration",

  // J — Information et communication
  "58": "Édition",
  "59": "Production de films et programmes",
  "60": "Programmation et diffusion",
  "61": "Télécommunications",
  "62": "Informatique et services informatiques",
  "63": "Services d'information",

  // K — Finance et assurance
  "64": "Activités des services financiers",
  "65": "Assurance",
  "66": "Activités auxiliaires de services financiers",

  // L — Immobilier
  "68": "Activités immobilières",

  // M — Activités spécialisées, scientifiques et techniques
  "69": "Activités juridiques et comptables",
  "70": "Activités des sièges sociaux et conseil de gestion",
  "71": "Activités d'architecture et d'ingénierie",
  "72": "Recherche-développement",
  "73": "Publicité et études de marché",
  "74": "Autres activités spécialisées",
  "75": "Activités vétérinaires",

  // N — Services administratifs et de soutien
  "77": "Activités de location et de leasing",
  "78": "Activités liées à l'emploi",
  "79": "Agences de voyage et voyagistes",
  "80": "Enquêtes et sécurité",
  "81": "Services relatifs aux bâtiments et paysagers",
  "82": "Activités administratives et de soutien",

  // O — Administration publique
  "84": "Administration publique et défense",

  // P — Enseignement
  "85": "Enseignement",

  // Q — Santé et action sociale
  "86": "Activités pour la santé humaine",
  "87": "Hébergement médico-social et social",
  "88": "Action sociale sans hébergement",

  // R — Arts, spectacles, loisirs
  "90": "Activités créatives, artistiques et de spectacle",
  "91": "Bibliothèques, archives, musées",
  "92": "Organisation de jeux de hasard",
  "93": "Activités sportives et récréatives",

  // S — Autres services
  "94": "Activités des organisations associatives",
  "95": "Réparation d'ordinateurs et d'équipements",
  "96": "Autres services personnels",

  // T — Ménages employeurs
  "97": "Activités des ménages en tant qu'employeurs",
  "98": "Activités indifférenciées des ménages",

  // U — Organismes extraterritoriaux
  "99": "Activités des organismes extraterritoriaux",
};

/**
 * Retourne le libellé secteur correspondant à un code NAF/APE.
 * Exemple : "6201Z" → "Informatique et services informatiques"
 */
export function sectorFromNafCode(nafCode: string | null | undefined): string | null {
  if (!nafCode) return null;
  const division = nafCode.slice(0, 2);
  return NAF_DIVISION_TO_SECTOR[division] ?? null;
}
