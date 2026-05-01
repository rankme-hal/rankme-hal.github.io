import Papa from "papaparse";
import stringSimilarity from "string-similarity";

// --- TYPES ---
export interface COREData {
  title: string;
  acronym: string;
  rank: string;
  cleanedTitle: string;
}
export interface SJRData {
  title: string;
  issn: string;
  quartile: string;
}

interface Stats {
  total: number;
  journals: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    unranked: number;
  };
  conferences: {
    aStar: number;
    a: number;
    b: number;
    c: number;
    unranked: number;
  };
}

interface HalDocument {
  docid: number;
  halId_s: string;
  title_s?: string[];
  docType_s: string;
  journalTitle_s?: string;
  conferenceTitle_s?: string;
  issn_s?: string[];
  eissn_s?: string[];
  authFullName_s?: string[];
  producedDateY_i?: number;
}

// Structures pour stocker les listes de papiers
type JournalRanks = "Q1" | "Q2" | "Q3" | "Q4" | "Unranked";
type ConfRanks = "A*" | "A" | "B" | "C" | "Unranked";

const categorizedJournals: Record<JournalRanks, HalDocument[]> = {
  Q1: [],
  Q2: [],
  Q3: [],
  Q4: [],
  Unranked: [],
};
const categorizedConferences: Record<ConfRanks, HalDocument[]> = {
  "A*": [],
  A: [],
  B: [],
  C: [],
  Unranked: [],
};

// --- CHARGEMENT DES BASES DE RÉFÉRENCE ---

// Charge le CSV de SCImago (SJR)
async function loadSJR(urlPath: string): Promise<Map<string, SJRData>> {
  const sjrMap = new Map<string, SJRData>();
  return new Promise((resolve) => {
    var results = Papa.parse( urlPath, {
      download: true,
      header: true,
      worker: true,
      delimiter: ";",
      step: function (_row) {
        const row = _row.data as any
          const issns = (row["Issn"] || "")
          .split(",")
          .map((i: string) => i.trim());
        const data = {
          title: row["Title"],
          issn: row["Issn"],
          quartile: row["SJR Best Quartile"],
        };

        for (const issn of issns) {
          if (issn) sjrMap.set(issn.toLowerCase(), data);
        }

      },
      complete: function () {
        console.log(
          `📦 SJR chargé : ${sjrMap.size} titres/acronymes indexés.`,
        );
        resolve(sjrMap);
      },
    });
  });
}

/**
 * STRATÉGIE 1 : Extraire les acronymes probables d'une chaîne HAL
 * Ex: "SPLC 2019" -> "SPLC" ou "Titre (SPLC)" -> "SPLC"
 */
function extractAcronyms(halString: string): string[] {
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
function cleanConferenceString(str: string): string {
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
function matchConference(
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

// Charge le CSV de CORE
async function loadCORE(urlPath: string): Promise<Map<string, COREData>> {
  const coreMap = new Map<string, COREData>(); // Clé: Titre ou acronyme en minuscules -> Valeur: Rank
  return new Promise((resolve) => {
    var results = Papa.parse(urlPath, {
      download: true,
      header: true,
      worker: true,
      delimiter: ",",
      step: function (_row) {
        const row = _row.data as any
       // console.error(row)
        // console.log("Row:", row.data);
        const title = (row["Title"] || "").toLowerCase().trim();
        const acronym = (row["Acronym"] || "").toLowerCase().trim();
        const rank = row["Rank"];
        // console.log(`CORE : ${title} (${acronym}) -> ${rank}`);
        if (title)
          coreMap.set(title, {
            title: "" + title,
            acronym: "" + acronym,
            rank: "" + rank,
            cleanedTitle: cleanConferenceString(row["Title"]),
          });
        if (acronym)
          coreMap.set(acronym, {
            title: "" + title,
            acronym: "" + acronym,
            rank: "" + rank,
            cleanedTitle: cleanConferenceString(row["Title"]),
          });
      },
      complete: function () {
        console.log(
          `📦 CORE chargé : ${coreMap.size} titres/acronymes indexés.`,
        );
        resolve(coreMap);
      },
    });
  });
}

// --- RÉCUPÉRATION ET ANALYSE HAL ---

async function fetchAndAnalyzeHAL(
  structIds: number[],
  startYar:number,
  endYear:number,
  sjrMaps: Map<number, Map<string, SJRData>>,
  coreMaps: Map<number, Map<string, COREData>>,
): Promise<string> {
  const docs = [];
  let numFound = 0;
  const limit = 5000; // On récupère 200 publications pour l'exemple
  for (const structId of structIds) {
    // On demande les champs: docType_s (ART=Article, COMM=Conférence), issn, titres...
    const params = new URLSearchParams({
      q: "*",
      fq: `structId_i:${structId} AND (docType_s:ART OR docType_s:COMM) and (submittedDateY_i:[${startYar} TO ${endYear}])`,
      wt: "json",
      fl: "docid,halId_s,title_s,docType_s,journalTitle_s,conferenceTitle_s,journalIssn_s,journalEissn_s,authFullName_s,producedDateY_i",
      //"halId_s,title_s,docType_s,journalTitle_s,journalIssn_s,journalEissn_s,conferenceTitle_s",

      rows: limit.toString(),
    });
    const url = `https://api.archives-ouvertes.fr/search/?${params.toString()}`;
    console.log(`\n🔍 Interrogation HAL : ${url}\n`);
 

    const response = await fetch(url);
    const data = await response.json();
    docs.push(...data.response.docs);
    numFound += data.response.numFound;
  }

  const docsunique = [
    ...new Map(docs.map((item) => [item.docid, item])).values(),
  ];

  const stats: Stats = {
    total: numFound,
    journals: { q1: 0, q2: 0, q3: 0, q4: 0, unranked: 0 },
    conferences: { aStar: 0, a: 0, b: 0, c: 0, unranked: 0 },
  };

  docsunique.forEach((doc: any) => {
    let sjrMap = sjrMaps.get(doc.producedDateY_i)!;
    let coreMap = coreMaps.get(doc.producedDateY_i)!;
    if (coreMap === undefined) {
      coreMap = coreMaps.get(2020)!; // Fallback sur la dernière année disponible
    }
    if (sjrMap === undefined) {
      sjrMap = sjrMaps.get(2020)!; // Fallback sur la dernière année disponible
    }

    // 1. GESTION DES JOURNAUX (Articles)
    if (doc.docType_s === "ART") {
      let matchedQuartile = "Unranked";

      // Nettoyage des ISSN de HAL (ex: "1234-5678" -> "12345678" pour matcher SJR)
      const issns = [
        ...(doc.journalIssn_s || []),
        ...(doc.journalEissn_s || []),
      ].map((i: string) => i.replace("-", "").toLowerCase());
      var issn = "";
      issn = doc.journalIssn_s || "";
      issn = issn.replace("-", "").toLowerCase();

      var eissn = "";
      eissn = doc.journalEIssn_s || "";
      eissn = eissn.replace("-", "").toLowerCase();

      if (sjrMap.has(issn)) {
        matchedQuartile = sjrMap.get(issn)!.quartile;
      }

      if (matchedQuartile === "Q1") {
        stats.journals.q1++;
        categorizedJournals[matchedQuartile].push(doc);
      } else if (matchedQuartile === "Q2") {
        stats.journals.q2++;
        categorizedJournals[matchedQuartile].push(doc);
      } else if (matchedQuartile === "Q3") {
        stats.journals.q3++;
        categorizedJournals[matchedQuartile].push(doc);
      } else if (matchedQuartile === "Q4") {
        stats.journals.q4++;
        categorizedJournals[matchedQuartile].push(doc);
      } else {
        categorizedJournals["Unranked"].push(doc);
        stats.journals.unranked++;
      }
    }

    // 2. GESTION DES CONFÉRENCES (Communications)
    if (doc.docType_s === "COMM") {
      const confTitle = (doc.conferenceTitle_s || "").toLowerCase().trim();
      let matchedRank = coreMap.get(confTitle); // Match exact sur le titre
      if (!matchedRank) {
        matchedRank = matchConference(
          doc.conferenceTitle_s || "",
          Array.from(coreMap.values()),
        ); // Match par entonnoir (acronyme, nettoyage, fuzzy)
      }
      if (matchedRank?.rank === "A*") {
        // console.log(`🎯 Match A* trouvé pour "${doc.conferenceTitle_s}" -> ${matchedRank.title} (${matchedRank.acronym})`);
        categorizedConferences[matchedRank.rank].push(doc);
        //console.error(categorizedConferences)
        stats.conferences.aStar++;
      } else if (matchedRank?.rank === "A") {
        categorizedConferences[matchedRank.rank].push(doc);
        stats.conferences.a++;
      } else if (matchedRank?.rank === "B") {
        categorizedConferences[matchedRank.rank].push(doc);
        stats.conferences.b++;
      } else if (matchedRank?.rank === "C") {
        categorizedConferences[matchedRank.rank].push(doc);
        stats.conferences.c++;
      } else {
        // console.log(`🎯 Match unranked trouvé pour "${doc.conferenceTitle_s}"`);
        categorizedConferences["Unranked"].push(doc);
        stats.conferences.unranked++;
      }
    }
  });

  const res = generateMarkdownReport(structIds);

  // --- AFFICHAGE DES RÉSULTATS ---
  console.log("📊 === STATISTIQUES DES PUBLICATIONS ===");
  console.log(
    `Total analysé (limité à ${limit}) sur ${stats.total} trouvées.\n`,
  );

  console.log("📚 JOURNAUX (SJR) :");
  console.log(`  - Q1 : ${stats.journals.q1}`);
  console.log(`  - Q2 : ${stats.journals.q2}`);
  console.log(`  - Q3 : ${stats.journals.q3}`);
  console.log(`  - Q4 : ${stats.journals.q4}`);
  console.log(`  - Non classé/Non matché : ${stats.journals.unranked}\n`);

  console.log("🎤 CONFÉRENCES (CORE) :");
  console.log(`  - A* : ${stats.conferences.aStar}`);
  console.log(`  - A  : ${stats.conferences.a}`);
  console.log(`  - B  : ${stats.conferences.b}`);
  console.log(`  - C  : ${stats.conferences.c}`);
  console.log(`  - Non classé/Non matché : ${stats.conferences.unranked}`);
categorizedConferences["A*"] =[];
categorizedConferences["A"] =[]
categorizedConferences["B"] =[]
categorizedConferences["C"] =[]
categorizedConferences["Unranked"] =[]
categorizedJournals["Q1"] =[]
categorizedJournals["Q2"] =[]
categorizedJournals["Q3"] =[]
categorizedJournals["Q4"] =[]
categorizedJournals["Unranked"] =[] 
return res;
}

// ==========================================
// 4. GÉNÉRATION DU RAPPORT MARKDOWN
// ==========================================

function formatPaperList(docs: HalDocument[]): string {
  if (docs.length === 0) return "*Aucune publication dans cette catégorie.*\n";

  return docs
    .map((doc) => {
      const title = doc.title_s ? doc.title_s[0] : "Titre inconnu";
      const authors = doc.authFullName_s
        ? doc.authFullName_s.join(", ")
        : "Auteurs inconnus";
      const venue =
        doc.docType_s === "ART" ? doc.journalTitle_s : doc.conferenceTitle_s;
      const year = doc.producedDateY_i || "N/A";
      const link = `[hal-${doc.halId_s}](https://hal.science/${doc.halId_s})`;

      return `- **${title}**\n  *${authors}* \n  📍 *${venue || "Non renseigné"}* (${year}) — 🔗 ${link}`;
    })
    .join("\n\n");
}

function generateMarkdownReport(structId: number[]): string {
  const totalJournals = Object.values(categorizedJournals).reduce(
    (acc, val) => acc + val.length,
    0,
  );
  const totalConfs = Object.values(categorizedConferences).reduce(
    (acc, val) => acc + val.length,
    0,
  );
  const total = totalJournals + totalConfs;

  const markdown = `
# 📊 Rapport Bibliométrique - Équipe IRISA (${structId.join(", ")})
*Généré le ${new Date().toLocaleDateString("fr-FR")}*

---

## 📈 Résumé Exécutif

**Total des publications analysées : ${total}** (Journaux : ${totalJournals} | Conférences : ${totalConfs})

### 🏆 Qualité des Conférences (CORE)
| Rang | Nombre | Pourcentage |
|:---:|:---:|:---:|
| **A\*** | ${categorizedConferences["A*"].length} | ${((categorizedConferences["A*"].length / totalConfs) * 100 || 0).toFixed(1)}% |
| **A** | ${categorizedConferences["A"].length} | ${((categorizedConferences["A"].length / totalConfs) * 100 || 0).toFixed(1)}% |
| **B** | ${categorizedConferences["B"].length} | ${((categorizedConferences["B"].length / totalConfs) * 100 || 0).toFixed(1)}% |
| **C** | ${categorizedConferences["C"].length} | ${((categorizedConferences["C"].length / totalConfs) * 100 || 0).toFixed(1)}% |
| Non classé | ${categorizedConferences["Unranked"].length} | - |

### 📚 Qualité des Journaux (SCImago/SJR)
| Quartile | Nombre | Pourcentage |
|:---:|:---:|:---:|
| **Q1** | ${categorizedJournals["Q1"].length} | ${((categorizedJournals["Q1"].length / totalJournals) * 100 || 0).toFixed(1)}% |
| **Q2** | ${categorizedJournals["Q2"].length} | ${((categorizedJournals["Q2"].length / totalJournals) * 100 || 0).toFixed(1)}% |
| **Q3** | ${categorizedJournals["Q3"].length} | ${((categorizedJournals["Q3"].length / totalJournals) * 100 || 0).toFixed(1)}% |
| **Q4** | ${categorizedJournals["Q4"].length} | ${((categorizedJournals["Q4"].length / totalJournals) * 100 || 0).toFixed(1)}% |
| Non classé | ${categorizedJournals["Unranked"].length} | - |

---

## 🎤 Liste des Conférences par Rang (CORE)

### 🌟 Conférences A* (Top Tier)
${formatPaperList(categorizedConferences["A*"])}

### ⭐ Conférences A
${formatPaperList(categorizedConferences["A"])}

### 🔹 Conférences B
${formatPaperList(categorizedConferences["B"])}

### 🔸 Conférences C
${formatPaperList(categorizedConferences["C"])}

### 🔸 Conférences Unranked
${formatPaperList(categorizedConferences["Unranked"])}

---

## 📖 Liste des Journaux par Quartile (SJR)

### 🥇 Journaux Q1 (Top 25%)
${formatPaperList(categorizedJournals["Q1"])}

### 🥈 Journaux Q2
${formatPaperList(categorizedJournals["Q2"])}

### 🥉 Journaux Q3
${formatPaperList(categorizedJournals["Q3"])}

### 📚 Journaux Q4
${formatPaperList(categorizedJournals["Q4"])}

### 🔸 Journaux Unranked
${formatPaperList(categorizedJournals["Unranked"])}


---
`;
  // *Note : Les publications "Unranked" (Non classées) ont été exclues de cette vue détaillée pour plus de lisibilité, mais sont comptabilisées dans le résumé.*
  // fs.writeFileSync(outputFilename, markdown);

  console.log(
    "✅ Rapport généré avec succès"
  );
  return markdown;
}


const basePath ="https://rankme-hal.github.io";

export async function initSJRCache(): Promise<Map<number, Map<string, SJRData>>> {
  const sjrMap2025 = await loadSJR(basePath+"/data/scimagojr_2025.csv");
  const sjrMap2024 = await loadSJR(basePath+"/data/scimagojr_2024.csv");
  const sjrMap2023 = await loadSJR(basePath+"/data/scimagojr_2023.csv");
  const sjrMap2022 = await loadSJR(basePath+"/data/scimagojr_2022.csv");
  const sjrMap2021 = await loadSJR(basePath+"/data/scimagojr_2021.csv");
  const sjrMap2020 = await loadSJR(basePath+"/data/scimagojr_2020.csv");

  const sjrData: Map<number, Map<string, SJRData>> = new Map();
  sjrData.set(2026, sjrMap2025);
  sjrData.set(2025, sjrMap2024);
  sjrData.set(2024, sjrMap2023);
  sjrData.set(2023, sjrMap2022);
  sjrData.set(2022, sjrMap2021);
  sjrData.set(2021, sjrMap2020);
  sjrData.set(2020, sjrMap2020);
  return sjrData;
}

export async function initCoreCache(): Promise<
  Map<number, Map<string, COREData>>
> {
  const coreMap2026 = await loadCORE(basePath+"/data/2026core.csv");
  const coreMap2023 = await loadCORE(basePath+"/data/2023core.csv");
  const coreMap2021 = await loadCORE(basePath+"/data/2021core.csv");
  const coreMap2020 = await loadCORE(basePath+"/data/2020core.csv");

  const coreData: Map<number, Map<string, COREData>> = new Map();
  coreData.set(2026, coreMap2026);
  coreData.set(2025, coreMap2023);
  coreData.set(2024, coreMap2023);
  coreData.set(2023, coreMap2021);
  coreData.set(2022, coreMap2021);
  coreData.set(2021, coreMap2020);
  coreData.set(2020, coreMap2020);
  return coreData;
}

// --- POINT D'ENTRÉE ---
export async function callHal(
  structIds: number[],
  startYear:number,
  endYear:number,
  coreData: Map<number, Map<string, COREData>>,
  sjrData: Map<number, Map<string, SJRData>>,
) {
  try {

    // const irisaStructId = 491231; // ID du D7 l'IRISA
    const res = await fetchAndAnalyzeHAL(structIds, startYear, endYear, sjrData, coreData);
    return res;
  } catch (error) {
    console.error("🔴 Erreur :", error);
    return "🔴 Erreur :" + JSON.stringify(error);
  }
}
