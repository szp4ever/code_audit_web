<template>
	<div class="tag-selector">
		<!-- 已选标签展示区域 -->
		<div v-if="selectedTags.length > 0" class="selected-tags-container">
			<n-tag
				v-for="(tag, index) in selectedTags"
				:key="index"
				closable
				:color="{ color: '#f0f0f0', textColor: '#323130', borderColor: '#d1d1d1' }"
				@close="removeTag(tag)"
				class="selected-tag"
			>
				{{ tag }}
			</n-tag>
		</div>
		<!-- 输入框 + 自动补全 -->
		<div class="tag-input-wrapper">
			<n-input
				v-model:value="inputValue"
				:placeholder="selectedTags.length === 0 ? placeholder : '继续添加标签...'"
				@keydown.enter.prevent="handleInputEnter"
				@keydown.backspace="handleBackspace"
				@input="handleInput"
				@focus="showSuggestions = true"
				@blur="handleBlur"
				class="tag-input"
			/>
			<!-- 下拉建议列表 -->
			<div v-if="showSuggestions && (filteredOptions.length > 0 || canCreateNew)" class="suggestions-dropdown">
				<div
					v-for="(option, index) in filteredOptions"
					:key="index"
					class="suggestion-item"
					:class="{ 'is-highlighted': highlightedIndex === index }"
					@mousedown.prevent="selectTag(option)"
					@mouseenter="highlightedIndex = index"
				>
					<div class="suggestion-content">
						<span class="suggestion-label">{{ option }}</span>
						<span class="suggestion-hint">已有标签</span>
					</div>
				</div>
				<div
					v-if="canCreateNew && inputValue.trim()"
					class="suggestion-item create-new"
					:class="{ 'is-highlighted': highlightedIndex === filteredOptions.length }"
					@mousedown.prevent="createNewTag"
					@mouseenter="highlightedIndex = filteredOptions.length"
				>
					<div class="suggestion-content">
						<span class="suggestion-label">创建新标签：{{ inputValue.trim() }}</span>
						<span class="suggestion-hint">按回车创建</span>
					</div>
				</div>
				<div v-if="filteredOptions.length === 0 && !canCreateNew && inputValue.trim()" class="suggestion-item no-results">
					<span class="suggestion-label">未找到匹配的标签</span>
				</div>
			</div>
		</div>
		<!-- 提示文字 -->
		<div v-if="hint" class="tag-hint">{{ hint }}</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NInput, NTag } from 'naive-ui';

interface Props {
	modelValue: string[];
	options?: string[];
	placeholder?: string;
	hint?: string;
	maxTags?: number;
}

const props = withDefaults(defineProps<Props>(), {
	options: () => [],
	placeholder: '输入标签名称，按回车添加',
	hint: '',
	maxTags: undefined,
});

const emit = defineEmits<{
	'update:modelValue': [value: string[]];
	'create': [tagName: string];
}>();

const selectedTags = computed({
	get: () => props.modelValue || [],
	set: (value) => emit('update:modelValue', value),
});

const inputValue = ref('');
const showSuggestions = ref(false);
const highlightedIndex = ref(-1);

// 过滤选项（模糊匹配）
const filteredOptions = computed(() => {
	if (!inputValue.value.trim()) {
		return props.options.filter(opt => !selectedTags.value.includes(opt)).slice(0, 10);
	}
	const query = inputValue.value.trim().toLowerCase();
	return props.options
		.filter(opt => 
			!selectedTags.value.includes(opt) && 
			opt.toLowerCase().includes(query)
		)
		.slice(0, 10);
});

// 是否可以创建新标签
const canCreateNew = computed(() => {
	const trimmed = inputValue.value.trim();
	if (!trimmed) return false;
	if (selectedTags.value.includes(trimmed)) return false;
	if (props.options.includes(trimmed)) return false;
	return true;
});

// 处理输入
function handleInput() {
	showSuggestions.value = true;
	highlightedIndex.value = -1;
}

// 处理回车
function handleInputEnter() {
	if (highlightedIndex.value >= 0) {
		if (highlightedIndex.value < filteredOptions.value.length) {
			selectTag(filteredOptions.value[highlightedIndex.value]);
		} else {
			createNewTag();
		}
	} else if (canCreateNew.value) {
		createNewTag();
	} else if (filteredOptions.value.length > 0) {
		selectTag(filteredOptions.value[0]);
	}
}

// 处理退格键（删除最后一个标签）
function handleBackspace(e: KeyboardEvent) {
	if (inputValue.value === '' && selectedTags.value.length > 0) {
		removeTag(selectedTags.value[selectedTags.value.length - 1]);
	}
}

// 处理失焦
function handleBlur() {
	setTimeout(() => {
		showSuggestions.value = false;
		highlightedIndex.value = -1;
	}, 200);
}

// 选择标签
function selectTag(tag: string) {
	if (props.maxTags && selectedTags.value.length >= props.maxTags) {
		return;
	}
	if (!selectedTags.value.includes(tag)) {
		selectedTags.value = [...selectedTags.value, tag];
	}
	inputValue.value = '';
	showSuggestions.value = false;
}

// 创建新标签
function createNewTag() {
	const trimmed = inputValue.value.trim();
	if (!trimmed) return;
	if (props.maxTags && selectedTags.value.length >= props.maxTags) {
		return;
	}
	if (!selectedTags.value.includes(trimmed)) {
		selectedTags.value = [...selectedTags.value, trimmed];
		emit('create', trimmed);
	}
	inputValue.value = '';
	showSuggestions.value = false;
}

// 移除标签
function removeTag(tag: string) {
	selectedTags.value = selectedTags.value.filter(t => t !== tag);
}

// 监听键盘上下箭头
watch(() => showSuggestions.value, (show) => {
	if (show) {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!showSuggestions.value) return;
			const totalItems = filteredOptions.value.length + (canCreateNew.value ? 1 : 0);
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				highlightedIndex.value = (highlightedIndex.value + 1) % totalItems;
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				highlightedIndex.value = highlightedIndex.value <= 0 ? totalItems - 1 : highlightedIndex.value - 1;
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}
});
</script>

<style scoped lang="scss">
.tag-selector {
	width: 100%;
}

.selected-tags-container {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-bottom: 8px;
	min-height: 32px;
	padding: 4px;
	border: 1px solid #d1d1d1;
	border-radius: 4px;
	background: #faf9f8;
}

.selected-tag {
	margin: 0;
	font-size: 13px;
	line-height: 1.5;
}

.tag-input-wrapper {
	position: relative;
}

.tag-input {
	width: 100%;
}

.suggestions-dropdown {
	position: absolute;
	top: 100%;
	left: 0;
	right: 0;
	z-index: 1000;
	margin-top: 4px;
	background: #ffffff;
	border: 1px solid #d1d1d1;
	border-radius: 4px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	max-height: 240px;
	overflow-y: auto;
}

.suggestion-item {
	padding: 8px 12px;
	cursor: pointer;
	transition: background-color 0.15s ease;
	border-bottom: 1px solid #f0f0f0;
	
	&:last-child {
		border-bottom: none;
	}
	
	&:hover,
	&.is-highlighted {
		background-color: #f3f2f1;
	}
	
	&.create-new {
		border-top: 1px solid #e1dfdd;
		background-color: #faf9f8;
		
		&:hover,
		&.is-highlighted {
			background-color: #f3f2f1;
		}
	}
	
	&.no-results {
		cursor: default;
		color: #8a8886;
		
		&:hover {
			background-color: transparent;
		}
	}
}

.suggestion-content {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.suggestion-label {
	font-size: 14px;
	color: #323130;
	flex: 1;
}

.suggestion-hint {
	font-size: 12px;
	color: #8a8886;
	margin-left: 8px;
}

.tag-hint {
	margin-top: 4px;
	font-size: 12px;
	color: #605e5c;
	line-height: 1.4;
}
</style>
