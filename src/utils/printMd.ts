// ==========================================
// 4. GÉNÉRATION DU RAPPORT MARKDOWN
// ==========================================

import { getFromCache } from "./cache";
import { callDblp } from "./dblpstats";
import type { ConfRanks, HalDocument, JournalRanks, VenueCacheItem, VenueCacheItnemPerYear } from "./model";

export  function formatPaperListHal(docs: HalDocument[]): string {
  if (docs.length === 0) return "*Aucune publication dans cette catégorie.*\n";

  return docs
    .map((doc) => {
      const title = doc.title_s ? doc.title_s[0] : "Titre inconnu";
      const authors = doc.authFullName_s
        ? doc.authFullName_s.join(", ")
        : "Auteurs inconnus";
      let venue:string|undefined = ''
      if (doc.dblpentry){
          const id = doc.halId_s;
          const parts = id.split('/');
          if (parts.length >= 2) {
            const type = parts[0]; // 'conf' ou 'journals'
            const name = parts[1]; // nom de la conférence ou du journal
//            const cache = await getFromCache(type+'/'+name);
//            if (cache) {
                if (doc.docType_s === "COMM") {
//                    const item = cache.items.find(i => i.year === doc.producedDateY_i);
//                    if (item){
                      venue =  doc.longTitleConf_s || doc.conferenceTitle_s;
                      if (doc.pages){
                        venue =  venue+ ', pages '+ doc.pages;
  //                    }
                    }

                } else if (doc.docType_s === "ART") {
//                    const item:VenueCacheItnemPerYear|undefined = doc.url? cache.items.find(i => doc.url!.includes(i.id)):undefined;
//                    if (item){
//                      venue = cache.title;
                      venue = doc.journalTitle_s;
                      if (doc.year && doc.month){
                        venue = venue+', ' + doc.month + ' ' + doc.year;
                      }
                      if (doc.volume){
                        venue =  venue+ ', volume '+ doc.volume;
                      } if (doc.number){
                        venue =  venue+ ', number '+ doc.number;

                      } if (doc.pages){
                        venue =  venue+ ', pages '+ doc.pages;
                      }

                    
                }
            //}

          }
          if (venue ==='') {title
                    venue = doc.docType_s === "ART" ?  doc.journalTitle_s : doc.conferenceTitle_s;                 
          }

      }else {title
        venue=  doc.docType_s === "ART" ? doc.journalTitle_s : doc.conferenceTitle_s;

      }
      const year = doc.producedDateY_i || "N/titletitleA";
      const link = doc.dblpentry? `[dblp-${doc.halId_s}](https://dblp.org/rec/${doc.halId_s}.html)` : `[hal-${doc.halId_s}](https://hal.science/${doc.halId_s})`;
      return `- **${title}**\n  *${authors}* \n  📍 *${venue || "Non renseigné"}* (${year}) — 🔗 ${link}`;
    }).join("\n\n");

}

export function generateMarkdownReport(structId: string[],categorizedJournals: Record<JournalRanks, HalDocument[]>,categorizedConferences: Record<ConfRanks, HalDocument[]> ): string {
  const totalJournals = Object.values(categorizedJournals).reduce(
    (acc, val) => acc + val.length,
    0,
  );
  const totalConfs = Object.values(categorizedConferences).reduce(
    (acc, val) => acc + val.length,
    0,
  );


  const total = totalJournals + totalConfs;

  const confAstr =  formatPaperListHal(categorizedConferences["A*"]);
  const confA =  formatPaperListHal(categorizedConferences["A"]);
  const confB =  formatPaperListHal(categorizedConferences["B"]);
  const confC =  formatPaperListHal(categorizedConferences["C"]);
  const confUnranked =  formatPaperListHal(categorizedConferences["Unranked"]);

  const markdown = `
# 📊 Rapport Bibliométrique : (${structId.join(", ")})
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
${confAstr}

### ⭐ Conférences A
${confA}

### 🔹 Conférences B
${confB}

### 🔸 Conférences C
${confC}

### 🔸 Conférences Unranked
${confUnranked}

---

## 📖 Liste des Journaux par Quartile (SJR)

### 🥇 Journaux Q1 (Top 25%)
${formatPaperListHal(categorizedJournals["Q1"])}

### 🥈 Journaux Q2
${formatPaperListHal(categorizedJournals["Q2"])}

### 🥉 Journaux Q3
${formatPaperListHal(categorizedJournals["Q3"])}

### 📚 Journaux Q4
${formatPaperListHal(categorizedJournals["Q4"])}

### 🔸 Journaux Unranked
${formatPaperListHal(categorizedJournals["Unranked"])}


---
`;
  // *Note : Les publications "Unranked" (Non classées) ont été exclues de cette vue détaillée pour plus de lisibilité, mais sont comptabilisées dans le résumé.*
  // fs.writeFileSync(outputFilename, markdown);

  console.log(
    "✅ Rapport généré avec succès"
  );
  return markdown;
}

