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

export interface Stats {
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

export interface HalDocument {
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
  dblpentry:boolean;
  url?:string;
  pages?:string;
  year?:string;
  month?:string;
  volume?:string;
  number?:string;
  longTitleConf_s?:string;

  
}

// Structures pour stocker les listes de papiers
export type JournalRanks = "Q1" | "Q2" | "Q3" | "Q4" | "Unranked";
export type ConfRanks = "A*" | "A" | "B" | "C" | "Unranked";


export interface VenueCacheItnemPerYear {
    id: string; // 'streams/journals/jot' ou 'conf/ease'
    title: string;
    booktitle: string;
    publisher: string;
    isbn: string;
    year: number;
    issn?: string[];

}

export interface VenueCacheItem {
    id: string; // 'streams/journals/jot' ou 'conf/ease'
    title: string;
    items: VenueCacheItnemPerYear[];
    issn?: string[];
}
