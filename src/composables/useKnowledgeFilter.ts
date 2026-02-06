import { ref, reactive, computed, watch } from 'vue';
import type { KnowledgeItemListQuery } from '@/api/knowledgeItem';

export function useKnowledgeFilter(initialState?: Partial<KnowledgeItemListQuery>) {
	const filterState = reactive<KnowledgeItemListQuery>({
		kid: undefined,
		title: undefined,
		vulnerabilityTypes: [],
		languages: [],
		severities: [],
		statuses: [],
		tags: [],
		orderBy: 'create_time',
		order: 'desc',
		...initialState,
	});
	
	const searchKeyword = ref('');
	
	const facetSeverities = ref<string[]>([]);
	const facetLanguages = ref<string[]>([]);
	const facetStatuses = ref<string[]>([]);
	const facetVulnerabilityTypes = ref<string[]>([]);
	const facetTags = ref<string[]>([]);
	
	function applyFacetFilters() {
		filterState.severities = facetSeverities.value;
		filterState.languages = facetLanguages.value;
		filterState.statuses = facetStatuses.value;
		filterState.vulnerabilityTypes = facetVulnerabilityTypes.value;
		filterState.tags = facetTags.value;
	}
	
	function clearFacetFilters() {
		facetSeverities.value = [];
		facetLanguages.value = [];
		facetStatuses.value = [];
		facetVulnerabilityTypes.value = [];
		facetTags.value = [];
		applyFacetFilters();
	}
	
	return {
		filterState,
		searchKeyword,
		facetSeverities,
		facetLanguages,
		facetStatuses,
		facetVulnerabilityTypes,
		facetTags,
		applyFacetFilters,
		clearFacetFilters,
	};
}
