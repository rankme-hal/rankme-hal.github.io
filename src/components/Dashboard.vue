<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
    <!-- Colonne de gauche (Filtres) -->
    <div class="lg:col-span-4 lg:sticky lg:top-24 h-max">
      <PublicationForm v-model:isCollapsed="isFormCollapsed" :isLoading="isLoading" @search="handleSearch" />
      <!-- La nouvelle table des matières, visible uniquement si on a des résultats -->
      <Transition enter-active-class="transition duration-500 ease-out" enter-from-class="opacity-0 -translate-y-4"
        enter-to-class="opacity-100 translate-y-0">
        <TableOfContents v-if="markdownResult && !isLoading" />
      </Transition>
      <div class="min-h-screen bg-gray-50 py-12 px-4">
<!--  <ScholarScraper client:only="vue" />-->
</div>
    </div>
<!--    <DblpImporter></DblpImporter>>-->
    <!-- Colonne de droite (Résultats) -->
    <div class="lg:col-span-8">
      <div v-if="markdownResult" class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <!-- Ton composant existant -->
        <MdxContentEnhanced :content="markdownResult" />
      </div>

      <!-- État vide -->
      <div v-else
        class="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
        <svg class="w-12 h-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
          </path>
        </svg>
        <h3 class="text-lg font-medium text-slate-900">Aucun résultat</h3>
        <p class="text-slate-500 mt-1">Remplissez le formulaire pour extraire et classer les publications.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TableOfContents from './TableOfContents.vue';
import PublicationForm, { type FilterParams } from './PublicationForm.vue';
import MdxContentEnhanced from './MdxContentEnhanced.vue'; // <-- Ton composant existant !
// import ScholarScraper from './ScholarScraper.vue'; // <-- Ton composant existant !
import {callHal } from '../utils/halstats.ts'
import {callDblp } from '../utils/dblpstats.ts'
import { initSJRCache, initCoreCache} from '../utils/sjrAndCoreExtraction.ts'
import {  type SJRData, type COREData } from '../utils/model.ts'
const isLoading = ref(false);
const markdownResult = ref<string | null>(null);
const isCacheInit = ref(false);
let sjrData: Map<number, Map<string, SJRData>>;
let coreData: Map<number, Map<string, COREData>>;
const isFormCollapsed = ref(false);

const handleSearch = async (params: FilterParams) => {
  isLoading.value = true;
  markdownResult.value = null; // Optionnel : masque les résultats précédents pendant la charge

  try {
    if (!isCacheInit.value) {
      sjrData = await initSJRCache();
      coreData = await initCoreCache();
      isCacheInit.value = true;
    } 490899
    if (params.source === 'hal') {
      const msg = await callHal(params.idValue, params.idType, params.startYear, params.endYear, coreData, sjrData)
      markdownResult.value = msg
      isFormCollapsed.value = true; // Replie le formulaire après la recherche
    } else if (params.source === 'dblp') {

      if (params.idType !== 'authorId') {
        throw new Error("Pour DBLP, l'extraction finale nécessite un identifiant d'auteur (PID).");
      }

      const pid = params.idValue; // Ex: 1home?hl=fr&gl=FR&ceid=FR:fr88/5658
      const msg  = await callDblp(pid, params.startYear, params.endYear, coreData,sjrData);
        markdownResult.value = msg;
        isFormCollapsed.value = true; // Replie le formulaire après la recherche
    }
  } catch (error) {
    console.error("Erreur lors de l'extraction", error);
    alert("Une erreur s'est produite lors de la récupération des données.");
  } finally {
    isLoading.value = false;
  }
};
</script>