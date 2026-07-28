<script setup lang="ts">
import { ref } from 'vue';

// Types pour les données
interface ScholarStats {
  name: string;
  url: string;
  citations: string[];
  hIndex: string[];
  i10Index: string[];
}

const authorName = ref('');
const stats = ref<ScholarStats | null>(null);
const loading = ref(false);
const error = ref('');

// Utilisation d'un proxy CORS public pour pouvoir fetcher Google depuis le navigateur
const PROXY_URL = "https://corsproxy.io/?";

async function searchAndScrape() {
  if (!authorName.value) return;
  
  loading.value = true;
  error.value = '';
  stats.value = null;

  try {
    // 1. RECHERCHE DE L'AUTEUR (pour trouver l'URL/ID)
    const searchUrl = `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(authorName.value)}`;
    const searchResponse = await fetch(PROXY_URL + encodeURIComponent(searchUrl));
    
    if (!searchResponse.ok) throw new Error("Erreur lors de la recherche");
    
    const searchText = await searchResponse.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(searchText, "text/html");
    
    // On récupère le premier lien de profil
    const firstProfileLink = doc.querySelector('.gsc_1usr h3 a') as HTMLAnchorElement;
    
    if (!firstProfileLink) {
      throw new Error("Aucun auteur trouvé avec ce nom.");
    }

    const relativeHref = firstProfileLink.getAttribute('href');
    const fullUrl = `https://scholar.google.com${relativeHref}`;

    // 2. SCRAPING DU PROFIL
    const profileResponse = await fetch(PROXY_URL + encodeURIComponent(fullUrl));
    const profileText = await profileResponse.text();
    const profileDoc = parser.parseFromString(profileText, "text/html");

    // Extraction du tableau des statistiques (ID: gsc_rsb_st)
    // Ligne 1: Citations, Ligne 2: h-index, Ligne 3: i10-index
    const rows = profileDoc.querySelectorAll('#gsc_rsb_st tbody tr');

    const getRowData = (rowIdx: number) => {
      const cells = rows[rowIdx]?.querySelectorAll('td');
      return cells ? [cells[1].textContent || '0', cells[2].textContent || '0'] : ['0', '0'];
    };

    stats.value = {
      name: profileDoc.querySelector('#gsc_prf_in')?.textContent || authorName.value,
      url: fullUrl,
      citations: getRowData(0),
      hIndex: getRowData(1),
      i10Index: getRowData(2)
    };

  } catch (err: any) {
    error.value = err.message || "Une erreur est survenue";
    console.error(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
    <h1 class="text-2xl font-bold text-gray-800 mb-6 text-center">Scholar Scraper</h1>
    
    <!-- Formulaire -->
    <div class="flex gap-2 mb-6">
      <input 
        v-model="authorName"
        type="text" 
        placeholder="Nom de l'auteur (ex: Yann LeCun)"
        class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        @keyup.enter="searchAndScrape"
      />
      <button 
        @click="searchAndScrape"
        :disabled="loading"
        class="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {{ loading ? 'Recherche...' : 'Chercher' }}
      </button>
    </div>

    <!-- Message d'erreur -->
    <div v-if="error" class="p-3 mb-4 text-sm text-red-600 bg-red-50 rounded-lg">
      {{ error }}
    </div>

    <!-- Résultats -->
    <div v-if="stats" class="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900">{{ stats.name }}</h2>
        <a :href="stats.url" target="_blank" class="text-indigo-600 hover:underline text-sm font-medium">
          Profil original ↗
        </a>
      </div>

      <div class="grid grid-cols-1 gap-4">
        <table class="w-full border-collapse">
          <thead>
            <tr class="text-left text-gray-500 text-sm border-b">
              <th class="pb-2 font-medium">Indicateur</th>
              <th class="pb-2 font-medium">Toutes</th>
              <th class="pb-2 font-medium">Depuis 2019</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr>
              <td class="py-3 text-gray-700">Citations</td>
              <td class="py-3 font-bold">{{ stats.citations[0] }}</td>
              <td class="py-3 text-gray-600">{{ stats.citations[1] }}</td>
            </tr>
            <tr>
              <td class="py-3 text-gray-700">Indice h</td>
              <td class="py-3 font-bold">{{ stats.hIndex[0] }}</td>
              <td class="py-3 text-gray-600">{{ stats.hIndex[1] }}</td>
            </tr>
            <tr>
              <td class="py-3 text-gray-700">Indice i10</td>
              <td class="py-3 font-bold">{{ stats.i10Index[0] }}</td>
              <td class="py-3 text-gray-600">{{ stats.i10Index[1] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>