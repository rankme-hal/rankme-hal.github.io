import type { COREData, SJRData } from "./model";
import stringSimilarity from "string-similarity";

/**
 * STRATÉGIE 1 : Extraire les acronymes probables d'une chaîne HAL
 * Ex: "SPLC 2019" -> "SPLC" ou "Titre (SPLC)" -> "SPLC"
 */
export function extractAcronyms(halString: string): string[] {
  const acronyms = new Set<string>();

  // 1. Cherche les mots tout en majuscules (de 3 à 8 lettres)
  const capsMatch = halString.match(/\b[A-Z]{3,8}\b/g);
  if (capsMatch) capsMatch.forEach((a) => acronyms.add(a));

  // 2. Cherche ce qui est entre parenthèses
  const parenMatch = halString.match(/\(([A-Za-z0-9]{3,8})\)/g);
  if (parenMatch)
    parenMatch.forEach((a) =>
      acronyms.add(a.replace(/[()]/g, "").toUpperCase()),
    );

  // 3. Cherche un mot juste avant une année (ex: "SPLC 2019")
  const yearPrefixMatch = halString.match(/\b([A-Za-z]{3,8})\s+(19|20)\d{2}\b/);
  if (yearPrefixMatch && yearPrefixMatch.length >= 1 && yearPrefixMatch[1])
    acronyms.add(yearPrefixMatch[1].toUpperCase());

  return Array.from(acronyms);
}

/**
 * STRATÉGIE 2 : Nettoyer le bruit
 * Supprime les années, éditions, et mots "poubelles" pour ne garder que le sens
 */
export function cleanConferenceString(str: string): string {
  let cleaned = str.toLowerCase();

  // Supprimer les années (19xx ou 20xx)
  cleaned = cleaned.replace(/\b(19|20)\d{2}\b/g, " ");

  // Supprimer les numéros d'éditions (1st, 2nd, 23rd, 40th...)
  cleaned = cleaned.replace(/\b\d+(st|nd|rd|th)\b/g, " ");

  // Supprimer la ponctuation
  cleaned = cleaned.replace(/[^\w\s]/g, " ");

  // Supprimer les "Stop Words" de conférences
  const stopWords = [
    "international",
    "conference",
    "symposium",
//    "workshop",
    "proceedings",
//    "annual",
//    "ieee",
//    "acm",
    "the",
    "and",
    "of",
    "in",
    "on",
    "for",
  ];
  const regex = new RegExp(`\\b(${stopWords.join("|")})\\b`, "gi");
  cleaned = cleaned.replace(regex, " ");

  // Nettoyer les espaces multiples
  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * STRATÉGIE 3 : L'entonnoir de Matching
 */
export function matchConference(
  halString: string,
  coreData: COREData[],
): COREData | undefined {
  // -- ÉTAPE 1 : Match par Acronyme (Ultra rapide et fiable) --
  const possibleAcronyms = extractAcronyms(halString);
  const cleanedHal = cleanConferenceString(halString);

  for (const acr of possibleAcronyms) {
    const match = coreData.find((c) => c.acronym.toUpperCase() === acr);
    if (match && !cleanedHal.toLowerCase().includes("workshop")) {
      // Sécurité : on peut vérifier si le fuzzy score n'est pas catastrophique
      // pour éviter qu'un acronyme erroné comme "IEEE" ne valide n'importe quoi.
      return match;
    }
  }

  // -- ÉTAPE 2 : Match Exact sur chaîne nettoyée --
  const exactMatch = coreData.find((c) => c.cleanedTitle === cleanedHal);
  if (exactMatch) return exactMatch;

  // -- ÉTAPE 4 : Fuzzy Matching (Scores de similarité) --
  // On compare le titre HAL nettoyé à tous les titres CORE nettoyés
  const coreCleanedTitles = coreData.map((c) => c.cleanedTitle);
  const matchResult = stringSimilarity.findBestMatch(
    cleanedHal,
    coreCleanedTitles,
  );

  const bestMatch = matchResult.bestMatch;
  const bestScore = bestMatch.rating; // Score entre 0 (différent) et 1 (identique)

  // On fixe un seuil d'acceptation (0.6 ou 0.65 est un bon compromis pour ce genre de données)
  if (bestScore > 0.6) {
    const res =  coreData[matchResult.bestMatchIndex];

    // -- etape 3: filtre workshop
    if (cleanedHal.toLowerCase().includes("workshop") && !res.title.toLowerCase().includes("workshop")){ 
      return undefined; // Si HAL mentionne "workshop" mais que le match CORE n'en parle pas, on rejette (car souvent les workshops de la conf qui ne sont pas classés)
    }else{
      return res;
    }
  }

  // Aucun match trouvé
  return undefined;
}


/**
 * STRATÉGIE 3 : L'entonnoir de Matching
 */
export function matchJournal(
  journalName: string,
  sjrData: SJRData[],
): SJRData | undefined {
  // -- ÉTAPE 1 : Match par Acronyme (Ultra rapide et fiable) --
  const cleanJournalName = cleanConferenceString(journalName);


  // -- ÉTAPE 2 : Match Exact sur chaîne nettoyée --
  const exactMatch = sjrData.find((c) => c.title === cleanJournalName);
  if (exactMatch) return exactMatch;

  // -- ÉTAPE 4 : Fuzzy Matching (Scores de similarité) --
  // On compare le titre HAL nettoyé à tous les titres CORE nettoyés
  const coreCleanedTitles = sjrData.map((c) => c.title);
  const matchResult = stringSimilarity.findBestMatch(
    cleanJournalName,
    coreCleanedTitles,
  );

  const bestMatch = matchResult.bestMatch;
  const bestScore = bestMatch.rating; // Score entre 0 (différent) et 1 (identique)

  // On fixe un seuil d'acceptation (0.6 ou 0.65 est un bon compromis pour ce genre de données)
  if (bestScore > 0.6) {
    const res =  sjrData[matchResult.bestMatchIndex];

    // -- etape 3: filtre workshop
      return res;
    
  }

  // Aucun match trouvé
  return undefined;
}

