import { matchConference } from "./matchConferenceAndJournalName";
import type {
  COREData,
  HalDocument,
  JournalRanks,
  ConfRanks,
  SJRData,
  Stats,
} from "./model";
import { generateMarkdownReport } from "./printMd";
// --- TYPES ---

// --- RÉCUPÉRATION ET ANALYSE HAL ---

async function fetchAndAnalyzeHAL(
  idValue: string,
  idType: string,
  startYar: number,
  endYear: number,
  sjrMaps: Map<number, Map<string, SJRData>>,
  coreMaps: Map<number, Map<string, COREData>>,
): Promise<string> {
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

  const docs = [];
  let numFound = 0;
  const limit = 8000; // On récupère 5000 publications pour l'exemple
  const structIds = idValue.split("||").map((id) => id.trim());

  for (const structId of structIds) {
    // On demande les champs: docType_s (ART=Article, COMM=Conférence), issn, titres...

    // 1. Construction du paramètre de requête principale "q"
    let q = "";
    switch (idType) {
      case "structure":
        q = `structId_i:${structId}`;
        break;

      case "authorId":
        q = `authIdHal_s:${structId}`;
        break;

      case "authorName":
        // Astuce Pro : on découpe le nom saisi par l'utilisateur par les espaces
        // Ex: "Jean Dupont" devient authFullName_t:("Jean" AND "Dupont")
        // Cela permet de trouver les publications même si HAL a indexé "Dupont Jean"
        const nameTokens = structId
          .trim()
          .split(/\s+/)
          .map((token) => `"${token}"`)
          .join(" AND ");

        q = `authFullName_t:(${nameTokens})`;
        break;
    }

    
    const params = new URLSearchParams({
      q: q,
      //      fq: `structId_i:${structId} AND (docType_s:ART OR docType_s:COMM) and (submittedDateY_i:[${startYar} TO ${endYear}])`,
      fq: `(docType_s:ART OR docType_s:COMM) and (submittedDateY_i:[${startYar} TO ${endYear}])`,

      wt: "json",
      fl: "docid,halId_s,title_s,docType_s,journalTitle_s,conferenceTitle_s,journalIssn_s,journalEissn_s,authFullName_s,producedDateY_i",
      //"halId_s,title_s,docType_s,journalTitle_s,journalIssn_s,journalEissn_s,conferenceTitle_s",

      rows: limit.toString(),
    });
    const url = `https://api.archives-ouvertes.fr/search/?${params.toString()}`;
    //console.log(`\n🔍 Interrogation HAL : ${url}\n`);

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
      if (doc.producedDateY_i === undefined || (doc.producedDateY_i >=startYar && doc.producedDateY_i <=endYear)) {
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
    }
  });

  const res = generateMarkdownReport(
    structIds,
    categorizedJournals,
    categorizedConferences,
  );

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
/*  categorizedConferences["A*"] = [];
  categorizedConferences["A"] = [];
  categorizedConferences["B"] = [];
  categorizedConferences["C"] = [];
  categorizedConferences["Unranked"] = [];
  categorizedJournals["Q1"] = [];
  categorizedJournals["Q2"] = [];
  categorizedJournals["Q3"] = [];
  categorizedJournals["Q4"] = [];
  categorizedJournals["Unranked"] = [];*/
  return await res;
}

// --- POINT D'ENTRÉE ---
export async function callHal(
  idValue: string,
  idType: string,
  startYear: number,
  endYear: number,
  coreData: Map<number, Map<string, COREData>>,
  sjrData: Map<number, Map<string, SJRData>>,
) {
  try {
    // const irisaStructId = 491231; // ID du D7 l'IRISA
    const res = await fetchAndAnalyzeHAL(
      idValue,
      idType,
      startYear,
      endYear,
      sjrData,
      coreData,
    );
    return res;
  } catch (error) {
    console.error("🔴 Erreur :", error);
    return "🔴 Erreur :" + JSON.stringify(error);
  }
}
