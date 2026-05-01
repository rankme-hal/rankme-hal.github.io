<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
    <h2 class="text-lg font-semibold text-slate-900 mb-6">Paramètres d'extraction</h2>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      
      <!-- Source de données & Type d'ID (Grid sur 2 colonnes pour desktop) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- Source de données -->
        <fieldset>
          <legend class="block text-sm font-medium text-slate-700 mb-2">Source de données</legend>
          <div class="flex gap-4">
            <label class="flex items-center cursor-pointer">
              <input type="radio" v-model="formData.source" value="hal" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500">
              <span class="ml-2 text-sm text-slate-700">HAL (Défaut)</span>
            </label>
            <label class="flex items-center cursor-pointer">
              <input disabled type="radio" v-model="formData.source" value="dblp" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500">
              <span class="ml-2 text-sm text-slate-700">DBLP</span>
            </label>
          </div>
        </fieldset>

        <!-- Type de recherche -->
        <fieldset>
          <legend class="block text-sm font-medium text-slate-700 mb-2">Rechercher par</legend>
          <div class="flex gap-4">
            <label class="flex items-center cursor-pointer">
              <input type="radio" v-model="formData.idType" value="structure" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500">
              <span class="ml-2 text-sm text-slate-700">Structure</span>
            </label>
            <label class="flex items-center cursor-pointer">
              <input disabled type="radio" v-model="formData.idType" value="author" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500">
              <span class="ml-2 text-sm text-slate-700">Auteur</span>
            </label>
          </div>
        </fieldset>
      </div>

      <!-- ID Input -->
      <div>
        <label for="searchId" class="block text-sm font-medium text-slate-700 mb-1">
          Identifiant {{ formData.idType === 'structure' ? 'de la structure' : "de l'auteur" }}
        </label>
        <input 
          id="searchId" 
          type="text" 
          v-model="formData.idValue" 
          required
          :placeholder="formData.idType === 'structure' ? 'Ex: 123456 (idHal)' : 'Ex: jeandupont'"
          class="w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors sm:text-sm"
        />
      </div>

      <!-- Période (Années) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="startYear" class="block text-sm font-medium text-slate-700 mb-1">Année de début</label>
          <select 
            id="startYear" 
            v-model="formData.startYear"
            class="w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option v-for="year in availableYears" :key="`start-${year}`" :value="year">
              {{ year }}
            </option>
          </select>
        </div>

        <div>
          <label for="endYear" class="block text-sm font-medium text-slate-700 mb-1">Année de fin</label>
          <select 
            id="endYear" 
            v-model="formData.endYear"
            class="w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option v-for="year in availableYears" :key="`end-${year}`" :value="year">
              {{ year }}
            </option>
          </select>
        </div>
      </div>

      <!-- Submit Button -->
      <div class="pt-4">
        <button 
          type="submit" 
          class="w-full sm:w-auto flex justify-center py-2.5 px-6 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          :disabled="isLoading"
        >
          <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isLoading ? 'Extraction en cours...' : 'Extraire les publications' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';

// Types pour tes données
export interface FilterParams {
  source: 'hal' | 'dblp';
  idType: 'structure' | 'author';
  idValue: string;
  startYear: number;
  endYear: number;
}

// Props (optionnel, utile si tu veux passer un état de chargement depuis le composant parent)
const props = defineProps<{
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'search', params: FilterParams): void
}>();

// Génération des années pour les menus déroulants (de l'année actuelle jusqu'à 1990)
const currentYear = new Date().getFullYear();
const availableYears = computed(() => {
  const years =[];
  for (let i = currentYear + 1; i >= 1990; i--) {
    years.push(i);
  }
  return years;
});

// État initial du formulaire
const formData = reactive<FilterParams>({
  source: 'hal',
  idType: 'structure',
  idValue: '',
  startYear: currentYear - 5, // Par défaut: 5 dernières années
  endYear: currentYear,
});

const handleSubmit = () => {
  // Simple validation de logique de dates
  if (formData.startYear > formData.endYear) {
    alert("L'année de début ne peut pas être supérieure à l'année de fin.");
    return;
  }
  
  // Émet les données vers le composant parent
  emit('search', { ...formData });
};
</script>