<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const props = defineProps<{
  content: string;
  components?: Record<string, any>;
  className?: string;
  enableCopy?: boolean;
  enableAnchors?: boolean;
  enableHighlight?: boolean;
}>();

const containerRef = ref<HTMLElement>();
const copiedStates = ref<Record<string, boolean>>({});

// Configuration de markdown-it
const md :any = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch (__) {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

// Plugins personnalisés
md.renderer.rules.heading_open = (tokens:any, idx:any) => {
  const token = tokens[idx];
  const level = token.tag;
  const text = tokens[idx + 1].content;
  const id = generateId(text);
  
  token.attrSet('id', id);
  
  let classes = `group flex items-center gap-2 mt-8 mb-4 text-gray-900 dark:text-white`;
  if (level === 'h2') classes += ' text-2xl font-bold';
  if (level === 'h3') classes += ' text-xl font-semibold';
  if (level === 'h4') classes += ' text-lg font-medium';
  
  token.attrSet('class', classes);
  
  return `<${level} ${tokens[idx].attrs ? formatAttrs(tokens[idx].attrs!) : ''}>`;
};

md.renderer.rules.heading_close = (tokens:any, idx:any) => {
  const level = tokens[idx].tag;
  const textToken = tokens[idx - 1];
  if (textToken && textToken.type === 'inline') {
    const id = generateId(textToken.content);
    return `
      <a href="#${id}" class="opacity-0 group-hover:opacity-100 text-violet-500 hover:text-violet-600 transition-opacity ml-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
      </a>
    </${level}>`;
  }
  return `</${level}>`;
};

md.renderer.rules.image = (tokens:any, idx:any) => {
  const token = tokens[idx];
  const src = token.attrGet('src') || '';
  const alt = token.content;
  
  return `
    <figure class="my-8">
      <a href="${src}" target="_blank" rel="noopener noreferrer" class="block" @click.prevent="openLightbox('${src}')">
        <img src="${src}" alt="${alt}" class="rounded-xl shadow-lg w-full hover:shadow-2xl transition-all duration-300 cursor-pointer" loading="lazy" />
      </a>
      ${alt ? `<figcaption class="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">${alt}</figcaption>` : ''}
    </figure>
  `;
};

md.renderer.rules.link_open = (tokens:any, idx:any) => {
  const token = tokens[idx];
  const href = token.attrGet('href') || '';
  
  if (href.startsWith('http')) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
    token.attrSet('class', 'text-violet-600 dark:text-violet-400 hover:underline font-medium inline-flex items-center gap-1');
  } else {
    token.attrSet('class', 'text-violet-600 dark:text-violet-400 hover:underline font-medium');
  }
  
  return `<a ${formatAttrs(token.attrs!)}>`;
};

md.renderer.rules.blockquote_open = () => {
  return `<blockquote class="border-l-4 border-violet-500 bg-violet-50 dark:bg-violet-900/20 my-6 p-4 rounded-r-xl">
    <div class="flex gap-3">
      <div class="flex-shrink-0 mt-0.5">
        <svg class="w-5 h-5 text-violet-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <div class="text-gray-700 dark:text-gray-300">`;
};

md.renderer.rules.blockquote_close = () => `
      </div>
    </div>
  </blockquote>`;

md.renderer.rules.table_open = () => `
  <div class="overflow-x-auto my-6 rounded-xl border border-gray-200 dark:border-gray-700">
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">`;

md.renderer.rules.table_close = () => `
    </table>
  </div>`;

md.renderer.rules.th_open = () => `
  <th class="bg-gray-100 dark:bg-gray-800 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">`;

md.renderer.rules.td_open = () => `
  <td class="border-t border-gray-200 dark:border-gray-700 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">`;

// Fonctions utilitaires
function generateId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u017F]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatAttrs(attrs: [string, string][]): string {
  return attrs.map(([key, value]) => `${key}="${value}"`).join(' ');
}

async function copyToClipboard(code: string, codeId: string) {
  try {
    await navigator.clipboard.writeText(code);
    copiedStates.value[codeId] = true;
    
    setTimeout(() => {
      copiedStates.value[codeId] = false;
    }, 2000);
  } catch (err) {
    console.error('Erreur lors de la copie:', err);
  }
}

function addCopyButtons() {
  if (!containerRef.value || !props.enableCopy) return;
  
  const preElements = containerRef.value.querySelectorAll('pre');
  preElements.forEach((pre, index) => {
    const code = pre.querySelector('code');
    if (!code) return;
    
    const codeId = `code-block-${index}`;
    pre.setAttribute('data-code-id', codeId);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'relative group/code my-6';
    
    const copyButton = document.createElement('button');
    copyButton.className = 'absolute top-2 right-2 z-10 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-lg opacity-0 group-hover/code:opacity-100 transition-all duration-200 flex items-center gap-1.5';
    copyButton.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
      </svg>
      Copier
    `;
    
    copyButton.addEventListener('click', () => {
      copyToClipboard(code.textContent || '', codeId);
    });
    
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    wrapper.appendChild(copyButton);
  });
}

function addAnchorLinks() {
  if (!containerRef.value || !props.enableAnchors) return;
  
  const headings = containerRef.value.querySelectorAll('h2, h3, h4');
  headings.forEach(heading => {
    const id = generateId(heading.textContent || '');
    heading.id = id;
    
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.className = 'opacity-0 group-hover:opacity-100 text-violet-500 hover:text-violet-600 transition-opacity ml-2';
    link.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
      </svg>
    `;
    
    heading.appendChild(link);
  });
}

const renderedHTML = computed(() => {
  return md.render(props.content);
});

// Émettre les titres pour la table des matières
const emit = defineEmits<{
  headings: [headings: Array<{ level: number; title: string; id: string }>];
}>();

function extractHeadings() {
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const headings: Array<{ level: number; title: string; id: string }> = [];
  let match;
  
  while ((match = headingRegex.exec(props.content)) !== null) {
    const level = match[1].length;
    const title = match[2];
    headings.push({
      level,
      title,
      id: generateId(title)
    });
  }
  
  emit('headings', headings);
  return headings;
}

// Lifecycle
onMounted(() => {
  nextTick(() => {
    addCopyButtons();
    addAnchorLinks();
    extractHeadings();
  });
});

onUnmounted(() => {
  // Nettoyage si nécessaire
});

// Observer pour les mises à jour
watch(() => props.content, () => {
  nextTick(() => {
    addCopyButtons();
    addAnchorLinks();
    extractHeadings();
  });
});
</script>

<template>
  <div 
    ref="containerRef"
    :class="[
      'mdx-content prose dark:prose-invert max-w-none',
      'prose-headings:scroll-mt-20',
      'prose-img:rounded-xl prose-img:shadow-lg',
      'prose-a:no-underline hover:prose-a:underline',
      className
    ]"
    v-html="renderedHTML"
  />
</template>

<style>
@reference "../styles/global.css";
/* Styles globaux pour le contenu MDX */
.mdx-content pre {
  @apply bg-gray-900 dark:bg-gray-950 border border-gray-700 rounded-xl overflow-x-auto;
  margin: 1.5rem 0;
}

.mdx-content pre code {
  @apply text-sm text-gray-100;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
}

.mdx-content code:not(pre code) {
  @apply text-violet-600 dark:text-violet-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md text-sm;
}

.mdx-content blockquote p {
  @apply m-0;
}

/* Animations */
.mdx-content .group\/code {
  @apply relative;
}

.mdx-content .group\/code:hover .copy-button {
  opacity: 1 !important;
}

/* Responsive */
@media (max-width: 640px) {
  .mdx-content pre {
    @apply text-xs;
  }
}

/* Print styles */
@media print {
  .mdx-content pre {
    @apply bg-white border border-gray-300 text-black;
  }
  
  .mdx-content .copy-button {
    display: none !important;
  }
}
</style>