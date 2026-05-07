import { getFromCache, setToCache } from "./cache";
import { matchConference, matchJournal } from "./matchConferenceAndJournalName";
import type {
  COREData,
  HalDocument,
  JournalRanks,
  ConfRanks,
  SJRData,
  Stats,
  VenueCacheItem,
} from "./model";
import { generateMarkdownReport } from "./printMd";
// --- TYPES ---

// Cache en mémoire pour dé-dupliquer les appels simultanés vers la même URL
const pendingRequests = new Map<string, Promise<VenueCacheItem>>();

async function importPublications(
  dblpPid: string,
  startYear: number,
  endYear: number,
): Promise<HalDocument[]> {
  if (!dblpPid || dblpPid.length === 0) return [];
  const publications: HalDocument[] = [];

  try {
    const url = `https://dblp.org/pid/${dblpPid}.xml`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error("Erreur lors de la récupération des données de l'auteur");

    const xmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");

    // Les publications sont contenues dans les balises <r>
    const records = doc.querySelectorAll("r > *");
    const results: HalDocument[] = [];

    // Identifiant incrémental pour le front (car DBLP n'a pas d'ID numérique simple)
    let docidCounter = 1;

    for (const record of Array.from(records)) {
      const tagName = record.tagName.toLowerCase();
      const key = record.getAttribute("key") || "";

      // Informations de base
      const title = record.querySelector("title")?.textContent || "";
      const yearStr = record.querySelector("year")?.textContent;
      const producedDateY_i = yearStr ? parseInt(yearStr, 10) : undefined;
      const authors = Array.from(record.querySelectorAll("author")).map(
        (a) => a.textContent || "",
      );
      const url = record.querySelector("url")?.textContent || "";

      let pages :string|undefined = undefined;
      let month :string|undefined = undefined;
      let volume :string|undefined = undefined;
      let number :string|undefined = undefined;


      let docType_s = "OTHER";
      let journalTitle_s: string | undefined;
      let longTitleConf_s: string | undefined;
      let conferenceTitle_s: string | undefined;
      let issn_s: string[] | undefined;

      if (
        producedDateY_i &&
        (producedDateY_i < startYear || producedDateY_i > endYear)
      ) {
        continue; // Ignorer les publications hors de la plage d'années
      }

      // Traitement des articles de revue
      if (tagName === "article") {
        docType_s = "ART"; // Identifiant HAL commun pour les articles de revue
        pages = record.querySelector("pages")?.textContent;
        month = record.querySelector("month")?.textContent;
        volume = record.querySelector("volume")?.textContent;
        number = record.querySelector("number")?.textContent;


        const stream = record.querySelector("stream")?.textContent;
        const url = record.querySelector("url")?.textContent;
        if (stream) {
          let parts = stream.split("/");

          if (parts.length > 2) {
            parts = parts.splice(1, parts.length - 1); // Retire l'année (ex: 2025)
          }
          const baseStream = parts.join("/");
          const venue = await resolveVenue(baseStream, false, false,yearStr || "");
          journalTitle_s = venue.title;
          if (venue.issn) issn_s = venue.issn;
        } else if  (url){
          let parts = url.split("/");

          if (parts.length > 2) {
            parts = parts.splice(1, parts.length - 2); // Retire l'année (ex: 2025)
          }

          const baseStream = parts.join("/");
          const venue = await resolveVenue(baseStream, false, false,yearStr || "");
          journalTitle_s = venue.title;
          if (venue.issn) issn_s = venue.issn;

        }
        
        else {
          // Fallback si pas de stream
          journalTitle_s =
            record.querySelector("journal")?.textContent || undefined;
        }
      }
      // Traitement des articles de conférence
      else if (tagName === "inproceedings") {
        docType_s = "COMM"; // Identifiant HAL commun pour les conférences
        const crossref = record.querySelector("crossref")?.textContent; // ex: conf/ease/2025
        pages = record.querySelector("pages")?.textContent;
        
        if (crossref) {
          // On retire l'année : on sépare par '/', on enlève le dernier élément, on rejoint
          const parts = crossref.split("/");
          let year2 = "";
          if (parts.length > 2) {
            year2 = parts.pop()!; // Retire l'année (ex: 2025)
          }
          const isnnan  =isNaN(+year2);
          if (isnnan){
            const url = record.querySelector("url")?.textContent; // ex: conf/ease/2025
            if (url) {
              const index  = url.lastIndexOf("#");
              if (index !== -1 && index >4) {
                const url1 = url.substring(0,index - 4) + "xml";
                const venue = await resolveVenue(url1, true, true, yearStr || "");
                conferenceTitle_s = venue.title;
                if (venue.items.length > 0){
                   const item1 = venue.items[0];
                    longTitleConf_s =  item1.title;
                 } else{
                       conferenceTitle_s =
                    record.querySelector("booktitle")?.textContent || undefined;
                 }

                }

            }
          }else{
          const baseCrossref = parts.join("/"); // devient 'conf/ease'
          const venue = await resolveVenue(baseCrossref, true, false, yearStr || "");
          conferenceTitle_s = venue.title;
          const item1 = venue.items.find((i) => i.year.toString() === yearStr);
          if (item1){
            longTitleConf_s =  item1.title;         
          } else {
          // Fallback si pas de crossref
          conferenceTitle_s =
            record.querySelector("booktitle")?.textContent || undefined;
        }
      }
    }

    

    }
      // Construction de l'objet final
      const halDoc: HalDocument = {
        docid: docidCounter++,
        halId_s: key, // On utilise la clé DBLP comme halId_s par défaut
        title_s: title ? [title] : undefined,
        docType_s,
        journalTitle_s,
        conferenceTitle_s,
        authFullName_s: authors.length > 0 ? authors : undefined,
        producedDateY_i,
        issn_s,
        dblpentry: true,
        url,
        year:yearStr,
        pages,
        number,
        volume,
        month,
        longTitleConf_s

      };

      results.push(halDoc);
    }

    publications.push(...results);
  } catch (err: any) {
    console.error(err.message || "Une erreur est survenue");
  } finally {
    return publications;
  }
  fetchAndAnalyzeDblp;
}

// --- API & LOGIC ---

async function resolveVenue(
  path: string,
  conf: boolean,
  isurl: boolean,
  year: string,
): Promise<VenueCacheItem> {
  // 1. Vérifier si c'est dans IndexedDB
  const cached = await getFromCache(path);
  if (cached) return cached;

  // 2. Vérifier si une requête réseau pour ce path est déjà en cours d'exécution
  if (pendingRequests.has(path)) {
    return pendingRequests.get(path)!;
  }

  

  // 3. Exécuter la requête réseau
  const fetchPromise = (async () => {
    try {
      await new Promise((r) => setTimeout(r, 1000));
      if (isurl){
      const url = `https://dblp.org/${path}`;
      console.log(`Fetching venue info from DBLP: ${url}`);
      const response = await fetchWithRetry(url,4,1000,100);
      if (!response.ok) {
        console.error(`Failed to fetch venue info for ${path}: ${response.status} , ${response.statusText}`); 

        throw new Error(`HTTP error ${response.status}`);
      } 
      const xmlText = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "text/xml");
      const ttitle = doc.querySelector("bht");
      let title :string= ''; 
      if (ttitle){
        title = ttitle.getAttribute("title") || '';
      }
      const longtitle = doc.querySelector("proceedings > title")?.textContent || path;
      const venueItem: VenueCacheItem = {
        id: path,
        title,
        items: [],
      };
          let venueItem1 = {
            id: "",
            title: longtitle,
            booktitle: "",
            publisher: "",
            isbn: "",
            year: -1,
          };
      venueItem.items.push(venueItem1);

      return venueItem;

      }else {


      const url = `https://dblp.org/db/${path}/index.xml`;
      console.log(`Fetching venue info from DBLP: ${url}`);
      const response = await fetchWithRetry(url,4,1000,100);
      if (!response.ok) {
        console.error(`Failed to fetch venue info for ${path}: ${response.status} , ${response.statusText}`); 

        throw new Error(`HTTP error ${response.status}`);
      } 
      const xmlText = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "text/xml");

      const title = doc.querySelector("h1")?.textContent || path;

      // Extraire les ISSN (si disponibles dans le XML)
      const issns = Array.from(doc.querySelectorAll("issn"))
        .map((el) => el.textContent || "")
        .filter(Boolean);

      const venueItem: VenueCacheItem = {
        id: path,
        title,
        items: [],
        issn: issns.length > 0 ? issns : undefined,
      };

      if (conf) {
        // Pour les conférences, on peut aussi extraire les années disponibles

        const t = doc.querySelectorAll("year");
        for (const record of Array.from(t)) {
          let venueItem1 = {
            id: "",
            title: "",
            booktitle: "",
            publisher: "",
            isbn: "",
            year: parseInt(record.textContent || "0", 10),
          };
          // console.error('title2', record.parentElement?.children);
          if (record.parentElement?.children) {
            venueItem1.id = record.parentElement?.getAttribute("key") || "";
            for (const record1 of record.parentElement?.children) {
              //       console.error(record1.nodeName + " => " + record1.textContent);
              if (record1.nodeName === "title") {
                venueItem1.title = record1.textContent || "";
              } else if (record1.nodeName === "booktitle") {
                venueItem1.booktitle = record1.textContent || "";
              } else if (record1.nodeName === "publisher") {
                venueItem1.publisher = record1.textContent || "";
              } else if (record1.nodeName === "isbn") {
                venueItem1.isbn = record1.textContent || "";
              } else if (record1.nodeName === "year") {
                venueItem1.year = parseInt(record1.textContent || "2025", 10);
              }
            }
            venueItem.items.push(venueItem1);
          }

          // console.error('title2', record);
        }
      } else {
        const t = doc.querySelectorAll("ref");
        for (const record of Array.from(t)) {
          let venueItem1 = {
            id: "",
            title: "",
            booktitle: "",
            publisher: "",
            isbn: "",
            year: -1,
          };
          venueItem1.id = record.getAttribute("href") || "";
          venueItem1.title = record.textContent || "";
          venueItem.items.push(venueItem1);
        }
      }

      // Sauvegarder dans IndexedDB pour la prochaine fois
      await setToCache(venueItem);
      return venueItem;
            }

    } finally {
      // Nettoyer le cache en mémoire une fois terminé
      pendingRequests.delete(path);
    }
  })();

  pendingRequests.set(path, fetchPromise);
  return fetchPromise;
}

// --- RÉCUPÉRATION ET ANALYSE DBLP ---

async function fetchAndAnalyzeDblp(
  idValue: string,
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

  let numFound = 0;
  const limit = 5000; // On récupère 5000 publications pour l'exemple

  const res1 = await importPublications(idValue, startYar, endYear);

  const docsunique = [
    ...new Map(res1.map((item) => [item.docid, item])).values(),
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
/*      const issns = [
        ...(doc.journalIssn_s || []),
        ...(doc.journalEissn_s || []),
      ].map((i: string) => i.replace("-", "").toLowerCase());
      var issn = "";
      issn = doc.journalIssn_s || "";
      issn = issn.replace("-", "").toLowerCase();

      var eissn = "";issn.toLowerCase()
      eissn = doc.journalEIssn_s || "";
      eissn = eissn.replace("-", "").toLowerCase();*/
      
    
      if (sjrMap.has(doc.journalTitle_s?.toLowerCase().trim())) {
        matchedQuartile = sjrMap.get(doc.journalTitle_s?.toLowerCase().trim())!.quartile;
      } else{
          const matchJournal1 =  matchJournal(doc.journalTitle_s?.toLowerCase().trim(), Array.from(sjrMap.values()));
          matchedQuartile = matchJournal1 ? matchJournal1.quartile : "Unranked";
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

  const res = generateMarkdownReport(
    [idValue],
    categorizedJournals,
    categorizedConferences,
  );

  return await res;
}

// --- POINT D'ENTRÉE ---
export async function callDblp(
  idValue: string,
  startYear: number,
  endYear: number,
  coreData: Map<number, Map<string, COREData>>,
  sjrData: Map<number, Map<string, SJRData>>,
) {
  try {
    // const dblpPid = '97/947';
    const res = await fetchAndAnalyzeDblp(
      idValue,
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

export async function fetchWithRetry(
  url: string,
  retries: number,
  delay: number,
  delayIncreasePercent: number,
  options?: RequestInit
): Promise<Response> {
  let currentDelay = delay;
  let attemptsLeft = retries;

  while (attemptsLeft >= 0) {
    try {
      const response = await fetch(url, options);

      // IMPORTANT : fetch ne lève une exception nativement que lors d'une erreur réseau.
      // Si vous voulez déclencher un retry sur des erreurs serveur (ex: 500, 502, 503),
      // il faut lever une erreur manuellement.
      // Vous pouvez modifier cette condition pour ne faire un retry que sur les erreurs 5xx.
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      }

      return response; // Succès de la requête
      
    } catch (error) {
      // Si c'était la dernière tentative, on rejette la promesse finale
      if (attemptsLeft === 0) {
        throw error;
      }

      console.warn(`Échec du fetch vers ${url}. Nouvel essai dans ${Math.round(currentDelay)}ms... (Essais restants : ${attemptsLeft})`);

      // Attente asynchrone avant de relancer la boucle
      await new Promise(resolve => setTimeout(resolve, currentDelay));

      // Calcul du nouveau délai avec le pourcentage d'augmentation
      currentDelay += currentDelay * (delayIncreasePercent / 100);
      
      // On décrémente le nombre de retries
      attemptsLeft--;
    }
  }

  throw new Error("Échec inattendu du retry.");
}