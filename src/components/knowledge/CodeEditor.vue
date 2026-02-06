<template>
	<div class="code-editor-wrapper">
		<!-- 工具栏 -->
		<div v-if="showToolbar" class="code-editor-toolbar">
			<div class="toolbar-left">
				<n-select
					v-model:value="selectedLanguage"
					:options="languageOptions"
					size="small"
					style="width: 120px;"
					placeholder="语言"
					@update:value="handleLanguageChange"
				/>
			</div>
			<div class="toolbar-right">
				<n-button
					text
					size="small"
					@click="handleCopy"
					:disabled="!codeValue"
				>
					<template #icon>
						<SvgIcon icon="ri:file-copy-line" />
					</template>
					复制
				</n-button>
				<n-button
					text
					size="small"
					@click="handleFormat"
					:disabled="!codeValue"
				>
					<template #icon>
						<SvgIcon icon="ri:code-s-slash-line" />
					</template>
					格式化
				</n-button>
			</div>
		</div>
		
		<!-- 代码编辑器区域 -->
		<div class="code-editor-container" :class="{ 'has-toolbar': showToolbar, 'has-line-numbers': showLineNumbers }">
			<!-- 行号 -->
			<div v-if="showLineNumbers" class="code-editor-line-numbers" :style="lineNumbersStyle">
				<span
					v-for="n in lineCount"
					:key="n"
					class="line-number"
				>{{ n }}</span>
			</div>
			
			<!-- 编辑器内容区域 -->
			<div class="code-editor-content">
				<!-- 高亮显示区域（背景层，先渲染） -->
				<pre class="code-editor-highlight" :style="highlightStyle"><code ref="highlightRef" class="hljs" :class="selectedLanguage" v-html="highlightedCode"></code></pre>
				
				<!-- 输入区域（覆盖层，后渲染） -->
				<textarea
					ref="textareaRef"
					:value="codeValue"
					@input="handleInput"
					@scroll="handleScroll"
					class="code-editor-textarea"
					:placeholder="placeholder"
					:style="textareaStyle"
					:readonly="props.readonly"
					:disabled="props.readonly"
					spellcheck="false"
				></textarea>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { NSelect, NButton, useMessage } from 'naive-ui';
import { SvgIcon } from '@/components/common';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css'; // 使用 GitHub 主题
import * as prettier from 'prettier/standalone';
import * as parserBabel from 'prettier/parser-babel';
import * as parserTypeScript from 'prettier/parser-typescript';
import * as parserHtml from 'prettier/parser-html';
import * as parserCss from 'prettier/parser-postcss';
import * as parserJson from 'prettier/parser-json';

interface Props {
	modelValue: string;
	language?: string;
	placeholder?: string;
	showToolbar?: boolean;
	showLineNumbers?: boolean;
	minHeight?: number;
	maxHeight?: number;
	readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: '',
	language: 'auto',
	placeholder: '请输入代码...',
	showToolbar: true,
	showLineNumbers: true,
	minHeight: 200,
	maxHeight: 600,
});

const emit = defineEmits<{
	'update:modelValue': [value: string];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const highlightRef = ref<HTMLElement | null>(null);
const selectedLanguage = ref<string>(props.language);
const codeValue = ref<string>(props.modelValue);

// 常用语言选项
const languageOptions = [
	{ label: '自动检测', value: 'auto' },
	{ label: 'JavaScript', value: 'javascript' },
	{ label: 'TypeScript', value: 'typescript' },
	{ label: 'Java', value: 'java' },
	{ label: 'Python', value: 'python' },
	{ label: 'C/C++', value: 'cpp' },
	{ label: 'C#', value: 'csharp' },
	{ label: 'Go', value: 'go' },
	{ label: 'HTML', value: 'xml' },
	{ label: 'CSS', value: 'css' },
	{ label: 'SQL', value: 'sql' },
	{ label: 'JSON', value: 'json' },
	{ label: 'Shell', value: 'bash' },
	{ label: 'Plain Text', value: 'plaintext' },
];

// 计算行数
const lineCount = computed(() => {
	if (!codeValue.value) return 1;
	return Math.max(1, codeValue.value.split('\n').length);
});

// 高亮代码
const highlightedCode = computed(() => {
	if (!codeValue.value) return '';
	
	try {
		if (selectedLanguage.value === 'auto' || !selectedLanguage.value) {
			const result = hljs.highlightAuto(codeValue.value);
			return result.value;
		} else {
			const result = hljs.highlight(codeValue.value, {
				language: selectedLanguage.value,
			});
			return result.value;
		}
	} catch (error) {
		// 如果高亮失败，返回原始代码（转义HTML）
		return escapeHtml(codeValue.value);
	}
});

// 转义HTML
function escapeHtml(text: string): string {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// 处理输入
function handleInput(event: Event) {
	const target = event.target as HTMLTextAreaElement;
	codeValue.value = target.value;
	emit('update:modelValue', target.value);
	syncScroll();
}

// 同步滚动
function handleScroll() {
	syncScroll();
}

function syncScroll() {
	if (textareaRef.value && highlightRef.value) {
		const scrollTop = textareaRef.value.scrollTop;
		const scrollLeft = textareaRef.value.scrollLeft;
		
		if (highlightRef.value.parentElement) {
			highlightRef.value.parentElement.scrollTop = scrollTop;
			highlightRef.value.parentElement.scrollLeft = scrollLeft;
		}
	}
}

// 处理语言变化
function handleLanguageChange() {
	// 语言变化时重新高亮
}

// 复制代码
async function handleCopy() {
	if (!codeValue.value) return;
	
	try {
		await navigator.clipboard.writeText(codeValue.value);
		// 可以添加成功提示
	} catch (error) {
		console.error('复制失败:', error);
	}
}

// 格式化代码（简单实现，可以扩展）
function handleFormat() {
	if (!codeValue.value) return;
	
	// 简单的格式化：统一缩进
	let formatted = codeValue.value;
	
	// 移除行尾空格
	formatted = formatted.split('\n').map(line => line.trimEnd()).join('\n');
	
	// 可以添加更复杂的格式化逻辑
	codeValue.value = formatted;
	emit('update:modelValue', formatted);
}

// 样式计算
const textareaStyle = computed(() => {
	return {
		minHeight: `${props.minHeight}px`,
		maxHeight: `${props.maxHeight}px`,
	};
});

const highlightStyle = computed(() => {
	return {
		minHeight: `${props.minHeight}px`,
		maxHeight: `${props.maxHeight}px`,
	};
});

const lineNumbersStyle = computed(() => {
	return {
		minHeight: `${props.minHeight}px`,
		maxHeight: `${props.maxHeight}px`,
	};
});

// 监听外部值变化
watch(() => props.modelValue, (newVal) => {
	if (newVal !== codeValue.value) {
		codeValue.value = newVal;
	}
});

// 初始化
onMounted(() => {
	selectedLanguage.value = props.language || 'auto';
});
</script>

<style scoped lang="scss">
.code-editor-wrapper {
	position: relative;
	width: 100%;
	border: 1px solid #d1d1d1;
	border-radius: 4px;
	background: #ffffff;
	overflow: hidden;
	transition: border-color 0.15s ease;
	
	&:hover {
		border-color: #0078d4;
	}
	
	&:focus-within {
		border-color: #0078d4;
		box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.1);
	}
}

.code-editor-toolbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 12px;
	border-bottom: 1px solid #e0e0e0;
	background: #faf9f8;
}

.toolbar-left {
	display: flex;
	align-items: center;
	gap: 8px;
}

.toolbar-right {
	display: flex;
	align-items: center;
	gap: 4px;
}

.code-editor-container {
	position: relative;
	display: flex;
	width: 100%;
	overflow: hidden;
	
	&.has-toolbar {
		border-top: none;
	}
}

.code-editor-content {
	position: relative;
	flex: 1;
	display: flex;
	width: 100%;
	overflow: hidden;
}

.code-editor-line-numbers {
	flex-shrink: 0;
	width: 50px;
	padding: 12px 8px;
	box-sizing: border-box;
	font-family: Menlo, Monaco, 'Courier New', monospace;
	font-size: 14px;
	line-height: 1.5;
	letter-spacing: 0;
	word-spacing: 0;
	color: #8a8886;
	background: #faf9f8;
	border-right: 1px solid #e0e0e0;
	text-align: right;
	user-select: none;
	pointer-events: none;
	overflow: hidden;
	
	.line-number {
		display: block;
		min-height: 1.5em;
		line-height: 1.5;
	}
}

.code-editor-textarea {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	padding: 12px;
	margin: 0;
	border: none;
	outline: none;
	resize: none;
	box-sizing: border-box;
	font-family: Menlo, Monaco, 'Courier New', monospace;
	font-size: 14px;
	line-height: 1.5;
	letter-spacing: 0;
	word-spacing: 0;
	color: transparent;
	background: transparent;
	caret-color: #323130;
	tab-size: 4;
	white-space: pre;
	overflow-wrap: normal;
	word-wrap: normal;
	overflow-x: auto;
	z-index: 2;
	
	&::placeholder {
		color: #a8a6a4;
	}
	
	&::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}
	
	&::-webkit-scrollbar-track {
		background: transparent;
	}
	
	&::-webkit-scrollbar-thumb {
		background: #d1d1d1;
		border-radius: 4px;
		
		&:hover {
			background: #a8a6a4;
		}
	}
}

.code-editor-highlight {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	margin: 0;
	padding: 12px;
	box-sizing: border-box;
	font-family: Menlo, Monaco, 'Courier New', monospace;
	font-size: 14px;
	line-height: 1.5;
	letter-spacing: 0;
	word-spacing: 0;
	background: #ffffff;
	overflow: auto;
	pointer-events: none;
	z-index: 1;
	
	code {
		display: block;
		white-space: pre;
		overflow-wrap: normal;
		word-wrap: normal;
		color: #323130;
		margin: 0;
		padding: 0 !important;
		background: transparent !important;
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
		letter-spacing: inherit;
		word-spacing: inherit;
	}
	
	&::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}
	
	&::-webkit-scrollbar-track {
		background: transparent;
	}
	
	&::-webkit-scrollbar-thumb {
		background: #d1d1d1;
		border-radius: 4px;
		
		&:hover {
			background: #a8a6a4;
		}
	}
}

// 高亮主题覆盖（使用 highlight.js 的 GitHub 主题）
:deep(.hljs) {
	background: #ffffff;
	color: #24292e;
}

:deep(.hljs-keyword) {
	color: #d73a49;
	font-weight: 600;
}

:deep(.hljs-string) {
	color: #032f62;
}

:deep(.hljs-comment) {
	color: #6a737d;
	font-style: italic;
}

:deep(.hljs-number) {
	color: #005cc5;
}

:deep(.hljs-function) {
	color: #6f42c1;
}

:deep(.hljs-variable) {
	color: #e36209;
}
</style>
