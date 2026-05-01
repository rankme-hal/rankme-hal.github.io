<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
    <!-- Colonne de gauche (Filtres) -->
    <div class="lg:col-span-4 lg:sticky lg:top-24 h-max">
      <PublicationForm :isLoading="isLoading" @search="handleSearch" />
    </div>

    <!-- Colonne de droite (Résultats) -->
    <div class="lg:col-span-8">
      <div v-if="markdownResult" class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <!-- Ton composant existant -->
        <MdxContentEnhanced :content="markdownResult" />
      </div>
      
      <!-- État vide -->
      <div v-else class="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
        <svg class="w-12 h-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <h3 class="text-lg font-medium text-slate-900">Aucun résultat</h3>
        <p class="text-slate-500 mt-1">Remplissez le formulaire pour extraire et classer les publications.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PublicationForm, { type FilterParams } from './PublicationForm.vue';
import MdxContentEnhanced from './MdxContentEnhanced.vue'; // <-- Ton composant existant !
import {initSJRCache,initCoreCache, callHal, type SJRData, type COREData} from '../utils/stats.ts'
const isLoading = ref(false);
const markdownResult = ref<string | null>(null);
const isCacheInit = ref(false);
let sjrData : Map<number, Map<string, SJRData>>;
let  coreData : Map<number, Map<string, COREData>>;

const handleSearch = async (params: FilterParams) => {
  isLoading.value = true;
  try {
    if (!isCacheInit.value){
      sjrData  = await initSJRCache();
      coreData  =await initCoreCache();
      isCacheInit.value = true;
    }
    /*{source: 'hal', idType: 'structure', idValue: 'cdcd', startYear: 2021, endYear: 2026}*/
    if (params.idType==='structure' && params.source=== 'hal'){

      const msg = await callHal([+params.idValue],params.startYear, params.endYear,coreData,sjrData)
//    console.error(msg);
    // Simulation pour l491231'exemple
//    await new Promise(resolve => setTimeout(resolve, 1500));
//    markdownResult.value = `# Résultats pour ${params.idValue}\n\n- Publication 1 (CORE: A)\n- Publication 2 (SCIMAGO: Q1)`;
    markdownResult.value = msg
    }
  } catch (error) {
    console.error("Erreur lors de l'extraction", error);
    alert("Une erreur s'est produite lors de la récupération des données.");
  } finally {
    isLoading.value = false;
  }
};
</script>