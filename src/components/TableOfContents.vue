<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200">
    
    <!-- En-tête / Bouton de bascule -->
    <button 
      @click="isCollapsed = !isCollapsed"
      class="w-full flex items-center justify-between p-5 md:p-6 text-left rounded-xl focus:outline-none focus:bg-slate-50 hover:bg-slate-50 transition-colors"
      :class="{ 'pb-4 rounded-b-none': !isCollapsed }"
    >
      <div class="flex items-center gap-3">
        <div class="p-1.5 bg-sky-50 rounded-lg text-sky-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path>
          </svg>
        </div>
        <h3 class="text-base font-semibold text-slate-900">Sommaire</h3>
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

    <!-- Corps du Sommaire avec animation Grid -->
    <div 
      class="grid transition-all duration-300 ease-in-out"
      :class="isCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'"
    >
      <div class="overflow-hidden">
        <nav class="p-5 md:p-6 pt-0 space-y-6">
          
          <!-- Conférences -->
          <div>
            <h4 class="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Conférences (CORE)</h4>
            <ul class="space-y-2.5 border-l-2 border-slate-100 ml-2 pl-4 text-sm">
              <li><a href="#conférences-a-top-tier" class="block text-slate-600 hover:text-indigo-600 hover:translate-x-1 transition-all">Conférences A*</a></li>
               <li><a href="#conférences-a" class="block text-slate-600 hover:text-indigo-600 hover:translate-x-1 transition-all">Conférences A </a></li>
               <li><a href="#conférences-b" class="block text-slate-600 hover:text-indigo-600 hover:translate-x-1 transition-all">Conférences B</a></li>
              <li><a href="#conférences-c" class="block text-slate-600 hover:text-indigo-600 hover:translate-x-1 transition-all">Conférences C</a></li>
              <li><a href="#conférences-unranked" class="block text-slate-600 hover:text-indigo-600 hover:translate-x-1 transition-all">Non classées</a></li>
            </ul>
          </div>

          <!-- Journaux -->
          <div>
            <h4 class="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Journaux (SCIMAGO)</h4>
            <ul class="space-y-2.5 border-l-2 border-slate-100 ml-2 pl-4 text-sm">
              <li><a href="#journaux-q1-top-25" class="block text-slate-600 hover:text-indigo-600 hover:translate-x-1 transition-all">Journaux Q1 (Top 25%)</a></li>
              <li><a href="#journaux-q2" class="block text-slate-600 hover:text-indigo-600 hover:translate-x-1 transition-all">Journaux Q2</a></li>
              <li><a href="#journaux-q3" class="block text-slate-600 hover:text-indigo-600 hover:translate-x-1 transition-all">Journaux Q3</a></li>
              <li><a href="#journaux-q4" class="block text-slate-600 hover:text-indigo-600 hover:translate-x-1 transition-all">Journaux Q4</a></li>
              <li><a href="#journaux-unranked" class="block text-slate-600 hover:text-indigo-600 hover:translate-x-1 transition-all">Non classés</a></li>
            </ul>
          </div>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// On le laisse ouvert par défaut
const isCollapsed = ref(false);
</script>