<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 transition-all duration-300">
    
    <!-- En-tête / Bouton de bascule -->
    <button 
      @click="isCollapsed = !isCollapsed"
      class="w-full flex items-center justify-between p-5 md:p-6 text-left rounded-xl focus:outline-none focus:bg-slate-50 hover:bg-slate-50 transition-colors"
      :class="{ 'pb-4 rounded-b-none': !isCollapsed }"
    >
      <div class="flex items-center gap-3">
        <div class="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <h2 class="text-base font-semibold text-slate-900">Paramètres d'extraction</h2>
      </div>
      <!-- Icône Chevron animée -->
      <svg 
        class="w-5 h-5 text-slate-400 transform transition-transform duration-300" 
        :class="isCollapsed ? '' : 'rotate-180'"
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Corps du formulaire avec animation Grid (Smooth Expand/Collapse) -->
    <div 
      class="grid transition-all duration-300 ease-in-out"
      :class="isCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'"
    >
      <div class="overflow-hidden">
        <form @submit.prevent="handleSubmit" class="p-5 md:p-6 pt-0 space-y-5">
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Source de données -->
            <fieldset>
              <legend class="block text-sm font-medium text-slate-700 mb-2">Source</legend>
              <div class="flex gap-4">
                <label class="flex items-center cursor-pointer">
                  <input type="radio" v-model="formData.source" value="hal" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500">
                  <span class="ml-2 text-sm text-slate-700">HAL</span>
                </label>
                <label class="flex items-center cursor-pointer">
                  <input disabled type="radio" v-model="formData.source" value="dblp" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500">
                  <span class="ml-2 text-sm text-slate-700">DBLP</span>
                </label>
              </div>
            </fieldset>

            <!-- Type de recherche -->
            <fieldset>
              <legend class="block text-sm font-medium text-slate-700 mb-2">Cible</legend>
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
              :placeholder="formData.idType === 'structure' ? 'Ex: 123456' : 'Ex: jeandupont'"
              class="w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <!-- Période -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="startYear" class="block text-sm font-medium text-slate-700 mb-1">De</label>
              <select id="startYear" v-model="formData.startYear" class="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 sm:text-sm">
                <option v-for="year in availableYears" :key="`start-${year}`" :value="year">{{ year }}</option>
              </select>
            </div>
            <div>
              <label for="endYear" class="block text-sm font-medium text-slate-700 mb-1">À</label>
              <select id="endYear" v-model="formData.endYear" class="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 sm:text-sm">
                <option v-for="year in availableYears" :key="`end-${year}`" :value="year">{{ year }}</option>
              </select>
            </div>
          </div>

          <!-- Submit -->
          <div class="pt-2">
            <button 
              type="submit" 
              class="w-full flex justify-center py-2.5 px-6 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              :disabled="isLoading"
            >
              {{ isLoading ? 'Extraction en cours...' : 'Extraire les publications' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';

export interface FilterParams {
  source: 'hal' | 'dblp';
  idType: 'structure' | 'author';
  idValue: string;
  startYear: number;
  endYear: number;
}

const props = defineProps<{ isLoading?: boolean }>();
const emit = defineEmits<{ (e: 'search', params: FilterParams): void }>();

// NOUVEAU : On définit isCollapsed comme un Model contrôlable par le parent (faux par défaut)
const isCollapsed = defineModel<boolean>('isCollapsed', { default: false });

const currentYear = new Date().getFullYear();
const availableYears = computed(() => {
  const years =[];
  for (let i = currentYear + 1; i >= 1990; i--) years.push(i);
  return years;
});

const formData = reactive<FilterParams>({
  source: 'hal',
  idType: 'structure',
  idValue: '',
  startYear: currentYear - 5,
  endYear: currentYear,
});

const handleSubmit = () => {
  if (formData.startYear > formData.endYear) {
    alert("L'année de début ne peut pas être supérieure à l'année de fin.");
    return;
  }
  
  emit('search', { ...formData });
  
};
</script>