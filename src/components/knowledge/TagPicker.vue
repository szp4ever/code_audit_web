<template>
	<div class="tag-picker">
		<!-- 触发按钮/输入框（改进版：参照CweSelector的友好显示） -->
		<div class="tag-picker-trigger" @click="openPicker">
			<div v-if="selectedTags.length === 0" class="trigger-placeholder">
				<span class="placeholder-text">{{ placeholder }}</span>
				<span class="trigger-icon">+</span>
			</div>
			<div v-else class="trigger-content">
				<!-- 已选数量提示 -->
				<div v-if="selectedTags.length > compactThreshold" class="trigger-count">
					<span class="count-text">已选择 {{ selectedTags.length }} 个标签</span>
					<n-button
						text
						type="info"
						size="small"
						@click.stop="openPicker"
						style="margin-left: 8px;"
					>
						<template #icon>
							<SvgIcon icon="ri:list-check" />
						</template>
						查看全部
					</n-button>
				</div>
				<!-- 标签列表 -->
				<div class="trigger-tags">
					<n-tag
						v-for="tag in visibleSelectedTags"
						:key="tag.name"
						:color="getTagColor(tag)"
						size="small"
						closable
						@close.stop="removeTagFromTrigger(tag)"
						class="trigger-tag"
					>
						{{ tag.name }}
						<span v-if="tag.type === 'system'" class="tag-badge-small">系统</span>
					</n-tag>
					<n-tag 
						v-if="selectedTags.length > compactThreshold" 
						:color="{ color: '#f0f0f0', textColor: '#605e5c' }" 
						size="small" 
						class="trigger-tag trigger-more-tag"
						@click.stop="openPicker"
					>
						+{{ selectedTags.length - compactThreshold }}
					</n-tag>
				</div>
			</div>
		</div>
		
		<!-- 标签选择模态框 -->
		<n-modal
			v-model:show="showModal"
			preset="card"
			title="选择标签"
			:style="{ width: '900px', maxWidth: '90vw' }"
			:mask-closable="false"
			class="tag-picker-modal"
			@update:show="handleModalShowChange"
		>
			<div class="tag-picker-content">
				<!-- 顶部：搜索栏和已选项 -->
				<div class="selector-header">
					<n-input
						v-model:value="searchKeyword"
						placeholder="搜索标签名称、描述..."
						clearable
						size="large"
						@update:value="handleSearch"
					>
						<template #prefix>
							<SvgIcon icon="ri:search-line" />
						</template>
					</n-input>
					
					<!-- 已选标签展示（参照CweSelector） -->
					<div v-if="tempSelectedTags.length > 0" class="selected-tags">
						<div class="selected-count">
							<span class="count-text">已选择 {{ tempSelectedTags.length }} 项</span>
							<n-space :size="8" style="margin-left: 12px;">
								<n-button
									text
									type="info"
									size="small"
									@click="showSelectedDetailModal = true"
								>
									<template #icon>
										<SvgIcon icon="ri:list-check" />
									</template>
									查看全部已选
								</n-button>
							</n-space>
						</div>
						<div class="selected-tags-container">
							<n-space :size="8" wrap>
								<n-tag
									v-for="tag in visibleSelectedTagsInModal"
									:key="tag.name"
									:color="getTagColor(tag)"
									closable
									@close="removeTag(tag)"
								>
									{{ tag.name }}
									<span v-if="tag.type === 'system'" class="tag-badge">系统</span>
								</n-tag>
							</n-space>
						</div>
					</div>
				</div>
				
				<!-- 筛选和排序栏 -->
				<div class="filter-sort-bar">
					<div class="filter-group">
						<span class="filter-label">
							<SvgIcon icon="ri:filter-line" class="filter-icon" />
							标签类型
						</span>
						<n-checkbox-group v-model:value="selectedTagTypes" @update:value="handleFilterChange">
							<n-space :size="12">
								<n-checkbox value="system" class="type-checkbox">
									<span class="type-label">系统标签</span>
								</n-checkbox>
								<n-checkbox value="user" class="type-checkbox">
									<span class="type-label">我的标签</span>
								</n-checkbox>
							</n-space>
						</n-checkbox-group>
					</div>
					
					<div class="sort-group">
						<span class="sort-label">排序：</span>
						<n-select
							v-model:value="sortBy"
							:options="sortOptions"
							size="small"
							style="width: 140px;"
							@update:value="handleSortChange"
						/>
					</div>
				</div>
				
				<!-- 标签列表 -->
				<div class="tags-list-section">
					<!-- 系统标签 -->
					<div v-if="sortedSystemTags.length > 0" class="tag-group">
						<div class="group-header">
							<span class="group-title">系统标签</span>
							<span class="group-count">（{{ sortedSystemTags.length }}）</span>
							<span v-if="sortedSystemTags.length > maxDisplayTags" class="group-hint">
								显示前 {{ maxDisplayTags }} 个，滚动查看更多
							</span>
						</div>
						<div class="tags-grid">
							<div
								v-for="tag in sortedSystemTags.slice(0, maxDisplayTags)"
								:key="tag.name"
								class="tag-card tag-card-system"
								:class="{ 'is-selected': isTagSelected(tag) }"
								@click="toggleTag(tag)"
							>
								<div class="tag-card-content">
									<div class="tag-name-row">
										<span class="tag-name" v-html="highlightTagName(tag.name)"></span>
										<span class="tag-type-badge tag-type-system">系统</span>
									</div>
									<span v-if="tag.description" class="tag-desc" v-html="highlightText(tag.description)"></span>
								</div>
								<div v-if="isTagSelected(tag)" class="tag-check">
									<SvgIcon icon="ri:check-line" style="font-size: 18px; color: #52C41A;" />
								</div>
							</div>
						</div>
						<div v-if="sortedSystemTags.length > maxDisplayTags" class="more-tags-hint">
							<n-button text type="info" size="small" @click="showAllSystemTags = !showAllSystemTags">
								{{ showAllSystemTags ? '收起' : `显示全部 ${sortedSystemTags.length} 个标签` }}
							</n-button>
						</div>
						<div v-if="showAllSystemTags && sortedSystemTags.length > maxDisplayTags" class="tags-grid">
							<div
								v-for="tag in sortedSystemTags.slice(maxDisplayTags)"
								:key="tag.name"
								class="tag-card tag-card-system"
								:class="{ 'is-selected': isTagSelected(tag) }"
								@click="toggleTag(tag)"
							>
								<div class="tag-card-content">
									<div class="tag-name-row">
										<span class="tag-name" v-html="highlightTagName(tag.name)"></span>
										<span class="tag-type-badge tag-type-system">系统</span>
									</div>
									<span v-if="tag.description" class="tag-desc" v-html="highlightText(tag.description)"></span>
								</div>
								<div v-if="isTagSelected(tag)" class="tag-check">
									<SvgIcon icon="ri:check-line" style="font-size: 18px; color: #52C41A;" />
								</div>
							</div>
						</div>
					</div>
					
					<!-- 用户标签 -->
					<div v-if="sortedUserTags.length > 0" class="tag-group">
						<div class="group-header">
							<span class="group-title">我的标签</span>
							<span class="group-count">（{{ sortedUserTags.length }}）</span>
							<span v-if="sortedUserTags.length > maxDisplayTags" class="group-hint">
								显示前 {{ maxDisplayTags }} 个，滚动查看更多
							</span>
						</div>
						<div class="tags-grid">
							<div
								v-for="tag in sortedUserTags.slice(0, maxDisplayTags)"
								:key="tag.name"
								class="tag-card tag-card-user"
								:class="{ 'is-selected': isTagSelected(tag) }"
								@click="toggleTag(tag)"
							>
								<div class="tag-card-content">
									<div class="tag-name-row">
										<span class="tag-name" v-html="highlightTagName(tag.name)"></span>
										<span class="tag-type-badge tag-type-user">我的</span>
									</div>
									<span v-if="tag.description" class="tag-desc" v-html="highlightText(tag.description)"></span>
								</div>
								<div v-if="isTagSelected(tag)" class="tag-check">
									<SvgIcon icon="ri:check-line" style="font-size: 18px; color: #52C41A;" />
								</div>
							</div>
						</div>
						<div v-if="sortedUserTags.length > maxDisplayTags" class="more-tags-hint">
							<n-button text type="info" size="small" @click="showAllUserTags = !showAllUserTags">
								{{ showAllUserTags ? '收起' : `显示全部 ${sortedUserTags.length} 个标签` }}
							</n-button>
						</div>
						<div v-if="showAllUserTags && sortedUserTags.length > maxDisplayTags" class="tags-grid">
							<div
								v-for="tag in sortedUserTags.slice(maxDisplayTags)"
								:key="tag.name"
								class="tag-card tag-card-user"
								:class="{ 'is-selected': isTagSelected(tag) }"
								@click="toggleTag(tag)"
							>
								<div class="tag-card-content">
									<div class="tag-name-row">
										<span class="tag-name" v-html="highlightTagName(tag.name)"></span>
										<span class="tag-type-badge tag-type-user">我的</span>
									</div>
									<span v-if="tag.description" class="tag-desc" v-html="highlightText(tag.description)"></span>
								</div>
								<div v-if="isTagSelected(tag)" class="tag-check">
									<SvgIcon icon="ri:check-line" style="font-size: 18px; color: #52C41A;" />
								</div>
							</div>
						</div>
					</div>
					
					<!-- 空状态 -->
					<div v-if="sortedSystemTags.length === 0 && sortedUserTags.length === 0" class="empty-state">
						<div class="empty-icon">
							<SvgIcon icon="ri:price-tag-line" style="font-size: 48px; color: #D9D9D9;" />
						</div>
						<div class="empty-text">未找到匹配的标签</div>
						<div v-if="searchKeyword.trim()" class="empty-hint">尝试调整搜索关键词或筛选条件</div>
					</div>
				</div>
				
				<!-- 创建新标签 -->
				<div class="create-section">
					<n-divider style="margin: 16px 0;">创建新标签</n-divider>
					<div class="create-form">
						<n-input
							v-model:value="newTagName"
							placeholder="输入新标签名称..."
							:maxlength="50"
							@keydown.enter.prevent="createNewTag"
							style="margin-bottom: 8px;"
						/>
						<n-input
							v-model:value="newTagDescription"
							type="textarea"
							placeholder="输入标签描述（可选）..."
							:maxlength="500"
							:rows="2"
							style="margin-bottom: 8px;"
						/>
						<n-button
							type="primary"
							:disabled="!canCreateNewTag"
							:loading="creatingTag"
							@click="createNewTag"
							style="width: 100%;"
						>
							创建
						</n-button>
					</div>
				</div>
			</div>
			
			<template #footer>
				<div class="modal-footer">
					<n-space>
						<n-button @click="handleSelectAll">全选</n-button>
						<n-button @click="handleClearAll">清空</n-button>
						<n-button @click="handleCancel">取消</n-button>
						<n-button type="primary" @click="handleConfirm">确定</n-button>
					</n-space>
				</div>
			</template>
		</n-modal>
		
		<!-- 已选择项详情模态框（参照CweSelector） -->
		<n-modal
			v-model:show="showSelectedDetailModal"
			preset="card"
			:style="{ width: '600px', maxWidth: '90vw' }"
			title="已选择的标签"
			:closable="true"
		>
			<div class="selected-detail-modal">
				<div class="detail-header">
					<n-input
						v-model:value="selectedDetailSearchKeyword"
						placeholder="搜索已选择的标签"
						clearable
						size="medium"
					>
						<template #prefix>
							<SvgIcon icon="ri:search-line" />
						</template>
					</n-input>
					<div class="detail-count">共 {{ filteredSelectedItems.length }} 项</div>
				</div>
				<div class="detail-content">
					<n-empty v-if="filteredSelectedItems.length === 0" description="没有匹配的项" />
					<n-space v-else :size="8" wrap>
						<n-tag
							v-for="tag in filteredSelectedItems"
							:key="tag.name"
							:color="getTagColor(tag)"
							closable
							@close="removeTag(tag)"
						>
							{{ tag.name }}
							<span v-if="tag.type === 'system'" class="tag-badge">系统</span>
						</n-tag>
					</n-space>
				</div>
			</div>
			<template #footer>
				<div class="detail-footer">
					<n-space>
						<n-button @click="handleClearAll">清空全部</n-button>
						<n-button type="primary" @click="showSelectedDetailModal = false">关闭</n-button>
					</n-space>
				</div>
			</template>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { 
	NModal, 
	NInput, 
	NTag, 
	NButton, 
	NDivider, 
	NSpace, 
	NCheckbox, 
	NCheckboxGroup, 
	NSelect, 
	NEmpty 
} from 'naive-ui';
import { SvgIcon } from '@/components/common';
import { useMessage } from 'naive-ui';

interface Tag {
	name: string;
	type: 'system' | 'user';
	description?: string;
	category?: string;
	usageCount?: number;
	createTime?: string;
}

interface Props {
	modelValue: Tag[];
	systemTags?: Tag[];
	userTags?: Tag[];
	placeholder?: string;
	maxDisplayTags?: number;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: () => [],
	systemTags: () => [],
	userTags: () => [],
	placeholder: '点击选择标签',
	maxDisplayTags: 3,
});

const emit = defineEmits<{
	'update:modelValue': [value: Tag[]];
	'create': [tagName: string, description?: string];
	'refresh': [];
}>();

const message = useMessage();
const showModal = ref(false);
const searchKeyword = ref('');
const newTagName = ref('');
const newTagDescription = ref('');
const tempSelectedTags = ref<Tag[]>([]);
const creatingTag = ref(false);
const showSelectedDetailModal = ref(false);
const selectedDetailSearchKeyword = ref('');
const selectedTagTypes = ref<string[]>(['system', 'user']);
const sortBy = ref<string>('relevance');
const compactThreshold = 5;
const maxDisplayTags = 50; // 最多显示50个标签，超出部分需要滚动查看
const showAllSystemTags = ref(false);
const showAllUserTags = ref(false);

// 排序选项（动态计算：只在有搜索关键词时显示相关性排序）
const sortOptions = computed(() => {
	const options = [
		{ label: '名称', value: 'name' },
		{ label: '使用次数', value: 'usage' },
		{ label: '创建时间', value: 'time' },
	];
	// 如果有搜索关键词，添加相关性排序选项（放在最前面）
	if (searchKeyword.value.trim()) {
		options.unshift({ label: '相关性', value: 'relevance' });
	}
	return options;
});

// 提取搜索关键词（参照知识库搜索）
function extractKeywords(query: string): string[] {
	if (!query || !query.trim()) return [];
	
	const stopWords = ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];
	
	const words = query.trim()
		.split(/[\s,，。、；;：:！!？?]+/)
		.map(w => w.trim())
		.filter(w => w.length > 0 && !stopWords.includes(w));
	
	if (words.length === 0) {
		return [query.trim()];
	}
	
	const result: string[] = [];
	if (query.trim().length > 2) {
		result.push(query.trim());
	}
	result.push(...words);
	
	return result;
}

// 计算标签的相关性分数（参照知识库搜索算法）
function calculateTagRelevance(tag: Tag, keywords: string[]): number {
	if (!keywords || keywords.length === 0) return 0;
	
	const tagName = (tag.name || '').toLowerCase();
	const tagDesc = (tag.description || '').toLowerCase();
	
	let score = 0;
	
	for (const keyword of keywords) {
		const lowerKeyword = keyword.toLowerCase().trim();
		if (!lowerKeyword) continue;
		
		// 名称完全匹配（权重最高）
		if (tagName === lowerKeyword) {
			score += 100;
		}
		// 名称开头匹配
		else if (tagName.startsWith(lowerKeyword)) {
			score += 50;
		}
		// 名称包含
		else if (tagName.includes(lowerKeyword)) {
			score += 30;
		}
		
		// 描述包含（权重较低）
		if (tagDesc.includes(lowerKeyword)) {
			score += 10;
		}
	}
	
	return score;
}

// 高亮文本（参照知识库搜索）
function highlightText(text: string): string {
	if (!text || !searchKeyword.value.trim()) return escapeHtml(text);
	
	const keywords = extractKeywords(searchKeyword.value.trim());
	const escapedText = escapeHtml(text);
	
	let result = escapedText;
	
	// 按长度排序关键词（长的优先，避免短关键词覆盖长关键词）
	const sortedKeywords = keywords.sort((a, b) => b.length - a.length);
	
	for (const keyword of sortedKeywords) {
		const lowerKeyword = keyword.toLowerCase().trim();
		if (!lowerKeyword) continue;
		
		// 使用不区分大小写的正则匹配
		const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
		result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
	}
	
	return result;
}

// 高亮标签名称
function highlightTagName(name: string): string {
	return highlightText(name);
}

// 转义HTML
function escapeHtml(text: string): string {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// 转义正则表达式特殊字符
function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 打开选择器
function openPicker() {
	console.log('[TagPicker] openPicker 调用', { modelValue: props.modelValue, modelValueLength: props.modelValue?.length });
	tempSelectedTags.value = [...props.modelValue];
	console.log('[TagPicker] openPicker 设置 tempSelectedTags', { tempSelectedTags: tempSelectedTags.value });
	searchKeyword.value = '';
	newTagName.value = '';
	selectedTagTypes.value = ['system', 'user'];
	sortBy.value = 'name';
	showModal.value = true;
}

// 过滤系统标签（带搜索和筛选）
const filteredSystemTags = computed(() => {
	let tags = props.systemTags.filter(tag => {
		// 筛选：只显示未选中的标签
		if (isTagSelected(tag)) return false;
		
		// 类型筛选
		if (!selectedTagTypes.value.includes('system')) return false;
		
		// 搜索过滤
		if (searchKeyword.value.trim()) {
			const keywords = extractKeywords(searchKeyword.value.trim());
			const tagName = (tag.name || '').toLowerCase();
			const tagDesc = (tag.description || '').toLowerCase();
			
			// 多关键词匹配
			const matches = keywords.some(kw => {
				const lowerKw = kw.toLowerCase();
				return tagName.includes(lowerKw) || tagDesc.includes(lowerKw);
			});
			
			if (!matches) return false;
		}
		
		return true;
	});
	
	return tags;
});

// 过滤用户标签（带搜索和筛选）
const filteredUserTags = computed(() => {
	let tags = props.userTags.filter(tag => {
		// 筛选：只显示未选中的标签
		if (isTagSelected(tag)) return false;
		
		// 类型筛选
		if (!selectedTagTypes.value.includes('user')) return false;
		
		// 搜索过滤
		if (searchKeyword.value.trim()) {
			const keywords = extractKeywords(searchKeyword.value.trim());
			const tagName = (tag.name || '').toLowerCase();
			const tagDesc = (tag.description || '').toLowerCase();
			
			// 多关键词匹配
			const matches = keywords.some(kw => {
				const lowerKw = kw.toLowerCase();
				return tagName.includes(lowerKw) || tagDesc.includes(lowerKw);
			});
			
			if (!matches) return false;
		}
		
		return true;
	});
	
	return tags;
});

// 排序后的系统标签
const sortedSystemTags = computed(() => {
	const tags = [...filteredSystemTags.value].filter(tag => tag && tag.name);
	const keywords = searchKeyword.value.trim() ? extractKeywords(searchKeyword.value.trim()) : [];
	
	return tags.sort((a, b) => {
		if (!a || !b || !a.name || !b.name) return 0;
		if (sortBy.value === 'relevance') {
			const scoreA = calculateTagRelevance(a, keywords);
			const scoreB = calculateTagRelevance(b, keywords);
			if (scoreA !== scoreB) return scoreB - scoreA;
			// 相同分数时，用户标签优先
			if (a.type !== b.type) return a.type === 'user' ? -1 : 1;
			// 再按名称排序
			return a.name.localeCompare(b.name, 'zh-CN');
		} else if (sortBy.value === 'name') {
			return a.name.localeCompare(b.name, 'zh-CN');
		} else if (sortBy.value === 'usage') {
			const usageA = a.usageCount || 0;
			const usageB = b.usageCount || 0;
			if (usageA !== usageB) return usageB - usageA;
			return a.name.localeCompare(b.name, 'zh-CN');
		} else if (sortBy.value === 'time') {
			const timeA = a.createTime ? new Date(a.createTime).getTime() : 0;
			const timeB = b.createTime ? new Date(b.createTime).getTime() : 0;
			if (timeA !== timeB) return timeB - timeA;
			return a.name.localeCompare(b.name, 'zh-CN');
		}
		return 0;
	});
});

// 排序后的用户标签
const sortedUserTags = computed(() => {
	const tags = [...filteredUserTags.value].filter(tag => tag && tag.name);
	const keywords = searchKeyword.value.trim() ? extractKeywords(searchKeyword.value.trim()) : [];
	
	return tags.sort((a, b) => {
		if (!a || !b || !a.name || !b.name) return 0;
		if (sortBy.value === 'relevance') {
			const scoreA = calculateTagRelevance(a, keywords);
			const scoreB = calculateTagRelevance(b, keywords);
			if (scoreA !== scoreB) return scoreB - scoreA;
			// 相同分数时，用户标签优先
			if (a.type !== b.type) return a.type === 'user' ? -1 : 1;
			// 再按名称排序
			return a.name.localeCompare(b.name, 'zh-CN');
		} else if (sortBy.value === 'name') {
			return a.name.localeCompare(b.name, 'zh-CN');
		} else if (sortBy.value === 'usage') {
			const usageA = a.usageCount || 0;
			const usageB = b.usageCount || 0;
			if (usageA !== usageB) return usageB - usageA;
			return a.name.localeCompare(b.name, 'zh-CN');
		} else if (sortBy.value === 'time') {
			const timeA = a.createTime ? new Date(a.createTime).getTime() : 0;
			const timeB = b.createTime ? new Date(b.createTime).getTime() : 0;
			if (timeA !== timeB) return timeB - timeA;
			return a.name.localeCompare(b.name, 'zh-CN');
		}
		return 0;
	});
});

// 检查标签是否已选
function isTagSelected(tag: Tag): boolean {
	return tempSelectedTags.value.some(t => t.name === tag.name);
}

// 切换标签选择
function toggleTag(tag: Tag) {
	const index = tempSelectedTags.value.findIndex(t => t.name === tag.name);
	if (index >= 0) {
		tempSelectedTags.value.splice(index, 1);
	} else {
		tempSelectedTags.value.push(tag);
	}
}

// 移除标签（从触发区域移除，直接更新 modelValue）
function removeTagFromTrigger(tag: Tag) {
	const newTags = selectedTags.value.filter(t => t.name !== tag.name);
	emit('update:modelValue', newTags);
}
// 移除标签（从模态框内移除，更新临时选择）
function removeTag(tag: Tag) {
	const index = tempSelectedTags.value.findIndex(t => t.name === tag.name);
	if (index >= 0) {
		tempSelectedTags.value.splice(index, 1);
	} else {
		removeTagFromTrigger(tag);
	}
}

// 创建新标签（创建后立即刷新列表）
async function createNewTag() {
	const trimmed = newTagName.value.trim();
	if (!trimmed) return;
	
	// 检查是否已存在
	if (tempSelectedTags.value.some(t => t.name === trimmed)) {
		message.warning('该标签已选择');
		return;
	}
	if (props.systemTags.some(t => t.name === trimmed) || props.userTags.some(t => t.name === trimmed)) {
		message.warning('该标签已存在');
		return;
	}
	
	creatingTag.value = true;
	try {
		const trimmedDesc = newTagDescription.value.trim();
		// 先添加到临时选择列表（乐观更新）
		const newTag: Tag = {
			name: trimmed,
			type: 'user',
			description: trimmedDesc || undefined,
		};
		tempSelectedTags.value.push(newTag);
		
		// 触发创建事件，让父组件处理API调用
		emit('create', trimmed, trimmedDesc || undefined);
		
		newTagName.value = '';
		newTagDescription.value = '';
		message.success(`标签"${trimmed}"创建成功`);
	} catch (error) {
		// 如果创建失败，移除临时添加的标签
		const index = tempSelectedTags.value.findIndex(t => t.name === trimmed);
		if (index >= 0) {
			tempSelectedTags.value.splice(index, 1);
		}
		message.error('创建标签失败');
	} finally {
		creatingTag.value = false;
	}
}

// 是否可以创建新标签
const canCreateNewTag = computed(() => {
	const trimmed = newTagName.value.trim();
	if (!trimmed) return false;
	if (tempSelectedTags.value.some(t => t.name === trimmed)) return false;
	if (props.systemTags.some(t => t.name === trimmed)) return false;
	if (props.userTags.some(t => t.name === trimmed)) return false;
	return true;
});

// 处理搜索
function handleSearch() {
	// 搜索逻辑已在 computed 中实现
}

// 处理筛选变化
function handleFilterChange() {
	// 筛选逻辑已在 computed 中实现
}

// 处理排序变化
function handleSortChange() {
	// 排序逻辑已在 computed 中实现
}

// 全选
function handleSelectAll() {
	const allTags = [...sortedSystemTags.value, ...sortedUserTags.value];
	const allTagNames = allTags.map(t => t.name);
	tempSelectedTags.value = [...new Set([...tempSelectedTags.value.map(t => t.name), ...allTagNames])]
		.map(name => {
			const tag = allTags.find(t => t.name === name);
			return tag || { name, type: 'user' as const };
		});
}

// 清空
function handleClearAll() {
	tempSelectedTags.value = [];
}

// 确认选择
function handleConfirm() {
	console.log('[TagPicker] handleConfirm 调用', { tempSelectedTags: tempSelectedTags.value, tempSelectedTagsLength: tempSelectedTags.value.length });
	emit('update:modelValue', [...tempSelectedTags.value]);
	console.log('[TagPicker] handleConfirm 已发送 update:modelValue 事件');
	showModal.value = false;
}

// 取消
function handleCancel() {
	showModal.value = false;
}

// 处理模态框显示变化
function handleModalShowChange(show: boolean) {
	if (!show) {
		tempSelectedTags.value = [...props.modelValue];
		searchKeyword.value = '';
		newTagName.value = '';
		newTagDescription.value = '';
		showSelectedDetailModal.value = false;
		selectedDetailSearchKeyword.value = '';
		selectedTagTypes.value = ['system', 'user'];
		sortBy.value = 'name';
		showAllSystemTags.value = false;
		showAllUserTags.value = false;
	}
}

// 监听搜索关键词变化，如果搜索框清空且当前是相关性排序，切换到名称排序
watch(() => searchKeyword.value, (newVal) => {
	if (!newVal.trim() && sortBy.value === 'relevance') {
		sortBy.value = 'name';
	}
});

// 获取标签颜色
function getTagColor(tag: Tag) {
	if (tag.type === 'system') {
		return { color: '#0078d4', textColor: '#ffffff', borderColor: '#0078d4' };
	}
	return { color: '#f0f0f0', textColor: '#323130', borderColor: '#d1d1d1' };
}

// 已选标签（用于显示）
const selectedTags = computed(() => props.modelValue || []);

// 显示的标签（触发区域，最多显示 compactThreshold 个）
const visibleSelectedTags = computed(() => {
	return selectedTags.value.slice(0, compactThreshold);
});

// 模态框内显示的已选标签（最多显示 compactThreshold 个）
const visibleSelectedTagsInModal = computed(() => {
	return tempSelectedTags.value.slice(0, compactThreshold);
});

// 已选标签详情（过滤后的）
const filteredSelectedItems = computed(() => {
	if (!selectedDetailSearchKeyword.value.trim()) {
		return tempSelectedTags.value;
	}
	const keyword = selectedDetailSearchKeyword.value.toLowerCase();
	return tempSelectedTags.value.filter(tag => {
		return tag.name.toLowerCase().includes(keyword) ||
			(tag.description || '').toLowerCase().includes(keyword);
	});
});
</script>

<style scoped lang="scss">
.tag-picker {
	width: 100%;
}

.tag-picker-trigger {
	min-height: 36px;
	padding: 8px 12px;
	border: 1px solid #d1d1d1;
	border-radius: 4px;
	background: #ffffff;
	cursor: pointer;
	transition: all 0.15s ease;
	
	&:hover {
		border-color: #0078d4;
		background: #faf9f8;
	}
	
	&:focus-within {
		border-color: #0078d4;
		box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.1);
	}
}

.trigger-placeholder {
	display: flex;
	justify-content: space-between;
	align-items: center;
	color: #8a8886;
	font-size: 14px;
}

.placeholder-text {
	flex: 1;
}

.trigger-icon {
	font-size: 18px;
	font-weight: 300;
	color: #0078d4;
}

.trigger-content {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.trigger-count {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 12px;
	color: #808080;
	padding-bottom: 4px;
	border-bottom: 1px solid #f0f0f0;
}

.count-text {
	font-weight: 500;
	color: #202020;
}

.trigger-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	align-items: center;
	min-height: 28px;
	max-height: 120px;
	overflow-y: auto;
	padding: 2px 0;
	
	/* 自定义滚动条样式 */
	&::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}
	
	&::-webkit-scrollbar-track {
		background: #f5f5f5;
		border-radius: 3px;
	}
	
	&::-webkit-scrollbar-thumb {
		background: #d1d1d1;
		border-radius: 3px;
		
		&:hover {
			background: #a8a8a8;
		}
	}
}

.trigger-tag {
	margin: 0;
}

.trigger-more-tag {
	cursor: pointer;
	transition: all 0.15s ease;
	
	&:hover {
		background: #e0e0e0 !important;
		border-color: #c0c0c0 !important;
	}
}

.tag-badge-small {
	margin-left: 4px;
	padding: 1px 4px;
	background: rgba(255, 255, 255, 0.3);
	border-radius: 2px;
	font-size: 10px;
}

.tag-picker-modal {
	:deep(.n-card__content) {
		padding: 0;
	}
}

.tag-picker-content {
	padding: 20px;
	max-height: 600px;
	overflow-y: auto;
}

.selector-header {
	margin-bottom: 16px;
}

.selected-tags {
	margin-top: 12px;
	padding-top: 12px;
	border-top: 1px solid #E0E0E0;
}

.selected-count {
	font-size: 12px;
	color: #808080;
	margin-bottom: 8px;
	display: flex;
	align-items: center;
}

.count-text {
	font-weight: 500;
	color: #202020;
}

.selected-tags-container {
	max-height: 80px;
	overflow-y: auto;
	padding: 4px 0;
}

.tag-badge {
	margin-left: 6px;
	padding: 2px 6px;
	background: rgba(255, 255, 255, 0.3);
	border-radius: 2px;
	font-size: 11px;
}

.filter-sort-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 16px;
	margin-bottom: 16px;
	background: #faf9f8;
	border-radius: 4px;
	border: 1px solid #e0e0e0;
}

.filter-group {
	display: flex;
	align-items: center;
	gap: 12px;
}

.filter-label {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	color: #606060;
	font-weight: 500;
	white-space: nowrap;
}

.filter-icon {
	font-size: 16px;
	color: #808080;
}

.type-checkbox {
	:deep(.n-checkbox__label) {
		padding-left: 6px;
	}
}

.type-label {
	font-size: 13px;
	color: #606060;
}

.sort-group {
	display: flex;
	align-items: center;
	gap: 8px;
}

.sort-label {
	font-size: 13px;
	color: #606060;
	white-space: nowrap;
}

.tags-list-section {
	margin-bottom: 20px;
}

.tag-group {
	margin-bottom: 24px;
	
	&:last-child {
		margin-bottom: 0;
	}
}

.group-header {
	display: flex;
	align-items: center;
	margin-bottom: 12px;
}

.group-title {
	font-size: 14px;
	font-weight: 600;
	color: #323130;
}

.group-count {
	font-size: 13px;
	color: #8a8886;
	margin-left: 4px;
}

.group-hint {
	font-size: 12px;
	color: #a8a6a4;
	margin-left: 8px;
	font-style: italic;
}

.more-tags-hint {
	margin-top: 8px;
	text-align: center;
	padding: 8px;
}

.tags-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	gap: 8px;
}

.tag-card {
	position: relative;
	padding: 12px;
	border: 1px solid #d1d1d1;
	border-radius: 4px;
	background: #ffffff;
	cursor: pointer;
	transition: all 0.15s ease;
	
	&:hover {
		border-color: #0078d4;
		background: #f3f2f1;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}
	
	&.is-selected {
		border-color: #0078d4;
		background: #e8f4f8;
	}
}

.tag-card-content {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.tag-name-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 8px;
}

.tag-name {
	font-size: 14px;
	font-weight: 500;
	color: #323130;
	flex: 1;
	
	:deep(mark.search-highlight) {
		background: #fff3cd;
		color: #856404;
		padding: 0 2px;
		border-radius: 2px;
		font-weight: 600;
	}
}

.tag-type-badge {
	font-size: 11px;
	padding: 2px 6px;
	border-radius: 2px;
	font-weight: 500;
	white-space: nowrap;
	flex-shrink: 0;
}

.tag-type-system {
	background: #0078d4;
	color: #ffffff;
}

.tag-type-user {
	background: #f0f0f0;
	color: #605e5c;
}

.tag-card-system {
	border-left: 3px solid #0078d4;
}

.tag-card-user {
	border-left: 3px solid #d1d1d1;
}

.tag-desc {
	font-size: 12px;
	color: #8a8886;
	line-height: 1.4;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	
	:deep(mark.search-highlight) {
		background: #fff3cd;
		color: #856404;
		padding: 0 2px;
		border-radius: 2px;
		font-weight: 600;
	}
}

.tag-check {
	position: absolute;
	top: 8px;
	right: 8px;
	width: 20px;
	height: 20px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #0078d4;
	color: #ffffff;
	border-radius: 50%;
	font-size: 12px;
	font-weight: bold;
}

.empty-state {
	text-align: center;
	padding: 40px 20px;
	color: #8a8886;
}

.empty-icon {
	font-size: 48px;
	margin-bottom: 12px;
}

.empty-text {
	font-size: 14px;
	margin-bottom: 8px;
}

.empty-hint {
	font-size: 12px;
	color: #a8a6a4;
}

.create-section {
	margin-top: 20px;
}

.create-form {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.modal-footer {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
}

.selected-detail-modal {
	display: flex;
	flex-direction: column;
	height: 500px;
}

.detail-header {
	margin-bottom: 16px;
	display: flex;
	align-items: center;
	gap: 12px;
}

.detail-count {
	font-size: 12px;
	color: #808080;
	white-space: nowrap;
}

.detail-content {
	flex: 1;
	overflow-y: auto;
	padding: 8px;
	border: 1px solid #E0E0E0;
	border-radius: 4px;
	background-color: #FAFAFA;
}

.detail-footer {
	display: flex;
	justify-content: flex-end;
	padding-top: 16px;
	border-top: 1px solid #E0E0E0;
}
</style>