import Papa from "papaparse";
import type { COREData, SJRData } from "./model";
import { cleanConferenceString } from "./matchConferenceAndJournalName";

// --- CHARGEMENT DES BASES DE RÉFÉRENCE ---
const basePath ="https://rankme-hal.github.io";
//const basePath = "http://localhost:4321";

// Charge le CSV de SCImago (SJR)
export async function loadSJR(urlPath: string): Promise<Map<string, SJRData>> {
  const sjrMap = new Map<string, SJRData>();
  return new Promise((resolve) => {
    var results = Papa.parse(urlPath, {
      download: true,
      header: true,
      worker: true,
      delimiter: ";",
      step: function (_row) {
        const row = _row.data as any;
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
        if (data.title) {
          sjrMap.set(data.title.toLowerCase().trim(), data);
        }
      },
      complete: function () {
        console.log(`📦 SJR chargé : ${sjrMap.size} titres/acronymes indexés.`);
        resolve(sjrMap);
      },
    });
  });
}

// Charge le CSV de CORE
export async function loadCORE(
  urlPath: string,
): Promise<Map<string, COREData>> {
  const coreMap = new Map<string, COREData>(); // Clé: Titre ou acronyme en minuscules -> Valeur: Rank
  return new Promise((resolve) => {
    var results = Papa.parse(urlPath, {
      download: true,
      header: true,
      worker: true,
      delimiter: ",",
      step: function (_row) {
        const row = _row.data as any;
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

export async function initSJRCache(): Promise<
  Map<number, Map<string, SJRData>>
> {
  const sjrMap2025 = await loadSJR(basePath + "/data/scimagojr_2025.csv");
  const sjrMap2024 = await loadSJR(basePath + "/data/scimagojr_2024.csv");
  const sjrMap2023 = await loadSJR(basePath + "/data/scimagojr_2023.csv");
  const sjrMap2022 = await loadSJR(basePath + "/data/scimagojr_2022.csv");
  const sjrMap2021 = await loadSJR(basePath + "/data/scimagojr_2021.csv");
  const sjrMap2020 = await loadSJR(basePath + "/data/scimagojr_2020.csv");

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
  const coreMap2026 = await loadCORE(basePath + "/data/2026core.csv");
  const coreMap2023 = await loadCORE(basePath + "/data/2023core.csv");
  const coreMap2021 = await loadCORE(basePath + "/data/2021core.csv");
  const coreMap2020 = await loadCORE(basePath + "/data/2020core.csv");

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
