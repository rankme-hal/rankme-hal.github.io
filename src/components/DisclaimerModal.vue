<template>
  <div>
    <!-- Bouton déclencheur (Warning) -->
    <button 
      @click="openModal" 
      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
      aria-label="Lire l'avertissement sur les données"
    >
      <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
      </svg>
      Avertissement
    </button>

    <!-- Overlay / Modale -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          
          <!-- Arrière-plan sombre (clic pour fermer) -->
          <div 
            class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            @click="closeModal"
          ></div>

          <!-- Boîte de dialogue -->
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to-class="opacity-100 translate-y-0 sm:scale-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0 sm:scale-100"
            leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div v-if="isOpen" class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden text-left border border-slate-100">
              
              <!-- En-tête de la modale -->
              <div class="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center gap-3">
                <div class="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-amber-900">À lire avant utilisation</h3>
              </div>

              <!-- Contenu -->
              <div class="px-6 py-5 text-slate-600 space-y-4 text-sm md:text-base leading-relaxed">
                <p>
                  <strong>Prudence avec les données générées :</strong> L'algorithme de <em>matching</em> entre les noms des conférences issues de HAL et ceux de la base CORE est très complexe à fiabiliser à 100% (variations orthographiques, acronymes, etc.). Il est donc jugé <strong>peu robuste</strong> dans sa forme automatisée.
                </p>
                <p>
                  Il est indispensable de procéder à une <strong>vérification humaine</strong> de la classification. Les chiffres et classements fournis par cette application ne doivent <strong>en aucun cas</strong> être pris de manière brute pour des évaluations officielles.
                </p>
                <p class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 italic">
                  💡 Ce site a avant tout été conçu comme un outil d'exploration rapide. Son but est de parcourir la base bibliographique d'une structure de recherche en informatique afin d'y déceler facilement de belles réalisations et des publications majeures.
                </p>
              </div>

              <!-- Pied de modale -->
              <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  @click="closeModal" 
                  class="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                >
                  J'ai compris
                </button>
              </div>
            </div>
          </Transition>

        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isOpen = ref(false);

const openModal = () => {
  isOpen.value = true;
  // Empêche le scroll de la page quand la modale est ouverte
  document.body.style.overflow = 'hidden';
};

const closeModal = () => {
  isOpen.value = false;
  // Rétablit le scroll
  document.body.style.overflow = '';
};

// Fermer la modale avec la touche Echap
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isOpen.value) {
    closeModal();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = ''; // Sécurité
});
</script>