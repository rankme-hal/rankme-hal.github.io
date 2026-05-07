<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 transition-all duration-300">
    
    <!-- Bouton de bascule de l'accordéon -->
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
      <svg 
        class="w-5 h-5 text-slate-400 transform transition-transform duration-300" 
        :class="isCollapsed ? '' : 'rotate-180'"
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Corps du formulaire -->
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
                  <input type="radio" v-model="formData.source" value="dblp" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500">
                  <span class="ml-2 text-sm text-slate-700">DBLP</span>
                </label>
              </div>
            </fieldset>

            <!-- Type de recherche -->
            <fieldset>
              <legend class="block text-sm font-medium text-slate-700 mb-2">Cible</legend>
              <div class="flex flex-wrap gap-x-4 gap-y-2">
                <!-- Désactivé si on est sur DBLP -->
                <label class="flex items-center" :class="formData.source === 'dblp' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'">
                  <input type="radio" v-model="formData.idType" value="structure" :disabled="formData.source === 'dblp'" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 disabled:bg-slate-200">
                  <span class="ml-2 text-sm text-slate-700">Structure</span>
                </label>
                <label class="flex items-center cursor-pointer">
                  <input type="radio" v-model="formData.idType" value="authorId" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500">
                  <span class="ml-2 text-sm text-slate-700">Identifiant</span>
                </label>
                <label class="flex items-center cursor-pointer">
                  <input type="radio" v-model="formData.idType" value="authorName" class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500">
                  <span class="ml-2 text-sm text-slate-700">Nom complet</span>
                </label>
              </div>
            </fieldset>
          </div>

          <!-- Champ de saisie -->
          <div>
            <label for="searchId" class="block text-sm font-medium text-slate-700 mb-1">
              {{ 
                formData.idType === 'structure' ? 'Identifiant de la structure (ex: 123456)' : 
                formData.idType === 'authorId' ? (formData.source === 'hal' ? 'IdHAL (ex: jean-dupont)' : 'PID DBLP (ex: 188/5658)') : 
                'Prénom et Nom (ex: Jean Dupont)' 
              }}
            </label>
            <input 
              id="searchId" 
              type="text" 
              v-model="formData.idValue" 
              required
              class="w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              :placeholder="formData.idType === 'structure' ? 'Ex: 123456' : formData.idType === 'authorId' ? 'Ex: jean-dupont' : 'Ex: Jean Dupont'"
              @keydown.enter="handleEnterKey"
            />
          </div>

          <!-- NOUVEAU : Affichage des candidats de l'Étape 1 (DBLP) -->
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="opacity-0 -translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-2"
          >
            <div v-if="dblpCandidates.length > 0" class="p-4 bg-sky-50 border border-sky-100 rounded-xl">
              <h3 class="text-sm font-semibold text-sky-900 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Sélectionnez le bon auteur
              </h3>
              <ul class="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                <li v-for="author in dblpCandidates" :key="author.pid">
                  <button 
                    type="button"
                    @click="selectDblpAuthor(author)"
                    class="w-full text-left px-3 py-2 text-sm bg-white border border-sky-200 rounded-lg hover:bg-sky-600 hover:text-white transition-all flex justify-between items-center group shadow-sm"
                  >
                    <span class="font-medium">{{ author.name }}</span>
                    <span class="text-xs text-sky-500 group-hover:text-sky-100 transition-colors bg-sky-50 group-hover:bg-sky-500 px-2 py-0.5 rounded">PID: {{ author.pid }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </Transition>

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

          <!-- Submit Buttons -->
          <div class="pt-2">
            <!-- Bouton Étape 1 (Recherche DBLP par nom) -->
            <button 
              v-if="isDblpNameSearch"
              type="button" 
              @click="searchDblpAuthors"
              class="w-full flex justify-center py-2.5 px-6 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
              :disabled="isSearchingDblp"
            >
              <svg v-if="isSearchingDblp" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isSearchingDblp ? 'Recherche en cours...' : "Lister les auteurs DBLP (Étape 1)" }}
            </button>

            <!-- Bouton Étape 2 (Extraction Finale) -->
            <button 
              v-else
              type="submit" 
              class="w-full flex justify-center py-2.5 px-6 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              :disabled="isLoading"
            >
              <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isLoading ? 'Extraction en cours...' : 'Extraire les publications' }}
            </button>
          </div>

        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

export interface FilterParams {
  source: 'hal' | 'dblp';
  idType: 'structure' | 'authorId' | 'authorName';
  idValue: string;
  startYear: number;
  endYear: number;
}

const props = defineProps<{ isLoading?: boolean }>();
const emit = defineEmits<{ (e: 'search', params: FilterParams): void }>();
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

// --- LOGIQUE METIER DBLP ---

// Savoir si on est dans le mode "Étape 1" de DBLP
const isDblpNameSearch = computed(() => formData.source === 'dblp' && formData.idType === 'authorName');

const dblpCandidates = ref<{name: string, pid: string}[]>([]);
const isSearchingDblp = ref(false);

// 1. Si l'utilisateur change de source vers DBLP, on interdit 'structure'
watch(() => formData.source, (newSource) => {
  if (newSource === 'dblp' && formData.idType === 'structure') {
    formData.idType = 'authorName';
  }
});

// 2. Si l'utilisateur tape un nouveau nom, on réinitialise les candidats
watch(() => formData.idValue, () => {
  if (dblpCandidates.value.length > 0) {
    dblpCandidates.value =[];
  }
});

// 3. Gestion de la touche "Entrée"
const handleEnterKey = (e: KeyboardEvent) => {
  if (isDblpNameSearch.value) {
    e.preventDefault(); // Empêche la soumission du formulaire classique
    searchDblpAuthors(); // Lance la recherche d'auteurs (Étape 1)
  }
};

// 4. L'API Recherche d'Auteur de DBLP (Étape 1)
const searchDblpAuthors = async () => {
  if (!formData.idValue) return;
  isSearchingDblp.value = true;
  dblpCandidates.value =[];
  
  try {
    const url = `https://dblp.org/search/author/api?q=${encodeURIComponent(formData.idValue)}&format=json&h=20`;
    const res = await fetch(url);
    const data = await res.json();
    
    let hits = data.result?.hits?.hit;
    if (!hits) {
      alert("Aucun auteur trouvé avec ce nom sur DBLP.");
      return;
    }
    
    // L'API renvoie un objet s'il n'y a qu'1 résultat, et un tableau s'il y en a plusieurs
    if (!Array.isArray(hits)) hits = [hits];
    
    dblpCandidates.value = hits.map((h: any) => {
      // DBLP peut renvoyer plusieurs noms pour la même personne, on prend le premier
      const authorName = Array.isArray(h.info.author) ? h.info.author[0] : h.info.author;
      
      // L'URL DBLP est de forme: https://dblp.org/pid/12/3456.html ou /pid/l/Nom.html
      let pid = h.info.url.replace('https://dblp.org/pid/', '');
      if (pid.endsWith('.html')) pid = pid.slice(0, -5);
      
      return { 
        // On récupère le texte pur (si l'API renvoie du XML textuel, ex: "Jean Dupont")
        name: typeof authorName === 'string' ? authorName : authorName.text, 
        pid 
      };
    });
  } catch (error) {
    console.error("Erreur de recherche DBLP:", error);
    alert("Erreur lors de la communication avec l'API DBLP.");
  } finally {
    isSearchingDblp.value = false;
  }
};

// 5. Sélection d'un auteur dans la liste (Bascule vers l'Étape 2)
const selectDblpAuthor = (author: {name: string, pid: string}) => {
  // Le formulaire devient un formulaire par "Identifiant" avec le PID DBLP !
  formData.idType = 'authorId';
  formData.idValue = author.pid;
  
  // On vide la liste des candidats pour cacher la boîte bleue
  dblpCandidates.value =[]

}

const handleSubmit = () => {
  if (formData.startYear > formData.endYear) {
    alert("L'année de début ne peut pas être supérieure à l'année de fin.");
    return;
  }
  
  emit('search', { ...formData });
  
};
</script>