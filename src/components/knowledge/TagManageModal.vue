<template>
	<n-modal
		v-model:show="show"
		preset="card"
		title="标签管理"
		:style="{ width: '930px', maxWidth: '90vw' }"
		:mask-closable="true"
		class="tag-manage-modal"
		@update:show="handleShowChange"
	>
		<div class="tag-manage-content">
			<!-- 顶部：搜索栏和操作按钮 -->
			<div class="manage-header">
				<n-input
					v-model:value="searchKeyword"
					placeholder="搜索标签名称、描述..."
					clearable
					size="large"
					style="flex: 1; max-width: 400px;"
				>
					<template #prefix>
						<SvgIcon icon="ri:search-line" />
					</template>
				</n-input>
				<n-space :size="8">
					<n-select
						v-model:value="filterType"
						:options="typeOptions"
						placeholder="标签类型"
						style="width: 150px"
						clearable
					/>
					<n-button type="primary" @click="handleCreate">
						<template #icon>
							<SvgIcon icon="ri:add-line" />
						</template>
						新建标签
					</n-button>
				</n-space>
			</div>

			<!-- 标签列表 -->
			<div class="tag-list-container">
				<n-empty v-if="systemTags.length === 0 && userTags.length === 0" description="暂无标签" />
				<div v-else>
					<!-- 系统标签 -->
					<div v-if="systemTags.length > 0" class="tag-group">
						<div class="group-header">
							<span class="group-title">系统标签</span>
							<span class="group-count">（{{ systemTags.length }}）</span>
						</div>
						<n-space :size="12" wrap>
							<n-card
								v-for="tag in systemTags"
								:key="tag.id"
								class="tag-card tag-card-system"
								hoverable
							>
								<div class="tag-card-content">
									<div class="tag-card-header">
										<n-tag
											:color="getTagColor(tag.tagType)"
											size="small"
											:bordered="false"
										>
											{{ tag.tagName }}
											<span class="tag-badge">系统</span>
										</n-tag>
									</div>
									<div v-if="tag.description" class="tag-card-description">
										{{ tag.description }}
									</div>
									<div class="tag-card-footer">
										<n-text depth="3" style="font-size: 12px;">
											使用次数: {{ tag.usageCount || 0 }}
										</n-text>
									</div>
								</div>
							</n-card>
						</n-space>
					</div>

					<!-- 用户标签 -->
					<div v-if="userTags.length > 0" class="tag-group">
						<div class="group-header">
							<span class="group-title">我的标签</span>
							<span class="group-count">（{{ userTags.length }}）</span>
						</div>
						<n-space :size="12" wrap>
							<n-card
								v-for="tag in userTags"
								:key="tag.id"
								class="tag-card tag-card-user"
								hoverable
							>
								<div class="tag-card-content">
									<div class="tag-card-header">
										<n-tag
											:color="getTagColor(tag.tagType)"
											size="small"
											:bordered="false"
										>
											{{ tag.tagName }}
										</n-tag>
										<n-space :size="4">
											<n-button
												text
												size="small"
												@click="handleEdit(tag)"
											>
												<template #icon>
													<SvgIcon icon="ri:edit-line" />
												</template>
											</n-button>
											<n-button
												text
												type="error"
												size="small"
												:disabled="(tag.usageCount || 0) > 0"
												@click="handleDelete(tag)"
											>
												<template #icon>
													<SvgIcon icon="ri:delete-bin-line" />
												</template>
											</n-button>
										</n-space>
									</div>
									<div v-if="tag.description" class="tag-card-description">
										{{ tag.description }}
									</div>
									<div class="tag-card-footer">
										<n-text depth="3" style="font-size: 12px;">
											使用次数: {{ tag.usageCount || 0 }}
										</n-text>
									</div>
								</div>
							</n-card>
						</n-space>
					</div>
				</div>
			</div>
		</div>

		<template #footer>
			<div class="modal-footer">
				<n-space>
					<n-button @click="handleClose">关闭</n-button>
				</n-space>
			</div>
		</template>
	</n-modal>

	<!-- 创建/编辑标签模态框 -->
	<n-modal
		v-model:show="showEditModal"
		preset="card"
		:title="editingTag ? '编辑标签' : '新建标签'"
		:style="{ width: '500px', maxWidth: '90vw' }"
		:mask-closable="true"
	>
		<n-form
			ref="editFormRef"
			:model="editFormValue"
			:rules="editFormRules"
			label-placement="left"
			label-width="80px"
		>
			<n-form-item path="tagName" label="标签名称">
				<n-input
					v-model:value="editFormValue.tagName"
					placeholder="请输入标签名称"
					:disabled="editingTag?.tagType === 'system'"
				/>
			</n-form-item>
			<n-form-item v-if="editingTag" path="tagType" label="标签类型">
				<n-text depth="3">
					{{ editingTag.tagType === 'system' ? '系统标签' : '用户标签' }}
				</n-text>
			</n-form-item>
			<n-form-item path="description" label="描述">
				<n-input
					v-model:value="editFormValue.description"
					type="textarea"
					placeholder="请输入描述（可选）"
					:rows="3"
				/>
			</n-form-item>
		</n-form>

		<template #footer>
			<div class="modal-footer">
				<n-space>
					<n-button @click="showEditModal = false">取消</n-button>
					<n-button type="primary" @click="handleSave" :loading="saving">
						保存
					</n-button>
				</n-space>
			</div>
		</template>
	</n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
	NModal,
	NInput,
	NTag,
	NButton,
	NSpace,
	NCard,
	NEmpty,
	NSelect,
	NForm,
	NFormItem,
	NText,
	FormInst,
	FormRules,
	useMessage,
	useDialog,
} from 'naive-ui';
import { SvgIcon } from '@/components/common';
import {
	getKnowledgeTagList,
	createKnowledgeTag,
	updateKnowledgeTag,
	deleteKnowledgeTag,
	type KnowledgeTagReq,
} from '@/api/knowledgeTag';

interface Tag {
	id: number;
	tagName: string;
	tagType: 'system' | 'user';
	description?: string;
	usageCount?: number;
}

const props = defineProps<{
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	'refresh': [];
}>();

const message = useMessage();
const dialog = useDialog();

const show = computed({
	get: () => props.modelValue,
	set: (value) => emit('update:modelValue', value),
});

const searchKeyword = ref('');
const filterType = ref<'system' | 'user' | null>(null);
const tags = ref<Tag[]>([]);
const loading = ref(false);
const showEditModal = ref(false);
const editingTag = ref<Tag | null>(null);
const editFormRef = ref<FormInst | null>(null);
const saving = ref(false);

const editFormValue = ref<KnowledgeTagReq & { id?: number }>({
	tagName: '',
	tagType: 'user',
	description: '',
});

const editFormRules: FormRules = {
	tagName: [
		{ required: true, message: '请输入标签名称', trigger: 'blur' },
		{ max: 50, message: '标签名称不能超过50个字符', trigger: 'blur' },
	],
};

const typeOptions = [
	{ label: '系统标签', value: 'system' },
	{ label: '用户标签', value: 'user' },
];

const filteredTags = computed(() => {
	let result = tags.value;
	if (searchKeyword.value.trim()) {
		const keyword = searchKeyword.value.trim().toLowerCase();
		result = result.filter(tag =>
			tag.tagName.toLowerCase().includes(keyword) ||
			(tag.description && tag.description.toLowerCase().includes(keyword))
		);
	}
	if (filterType.value) {
		result = result.filter(tag => tag.tagType === filterType.value);
	}
	return result;
});

const systemTags = computed(() => {
	return filteredTags.value.filter(tag => tag.tagType === 'system');
});

const userTags = computed(() => {
	return filteredTags.value.filter(tag => tag.tagType === 'user');
});

function getTagColor(tagType: 'system' | 'user') {
	if (tagType === 'system') {
		return { color: '#0078d4', textColor: '#ffffff', borderColor: '#0078d4' };
	}
	return { color: '#f0f0f0', textColor: '#323130', borderColor: '#d1d1d1' };
}

async function loadTags() {
	loading.value = true;
	try {
		const response: any = await getKnowledgeTagList({ pageSize: 1000 });
		if (response.code === 200 && response.rows) {
			tags.value = response.rows.map((tag: any) => ({
				id: tag.id,
				tagName: tag.tagName || '',
				tagType: (tag.tagType || 'user') as 'system' | 'user',
				description: tag.description || '',
				usageCount: tag.usageCount || 0,
			}));
		}
	} catch (error) {
		console.error('加载标签列表失败:', error);
		message.error('加载标签列表失败');
	} finally {
		loading.value = false;
	}
}

function handleCreate() {
	editingTag.value = null;
	editFormValue.value = {
		tagName: '',
		tagType: 'user',
		description: '',
	};
	showEditModal.value = true;
}

function handleEdit(tag: Tag) {
	editingTag.value = tag;
	editFormValue.value = {
		id: tag.id,
		tagName: tag.tagName,
		tagType: tag.tagType,
		description: tag.description || '',
	};
	showEditModal.value = true;
}

function handleDelete(tag: Tag) {
	if ((tag.usageCount || 0) > 0) {
		message.warning(`标签"${tag.tagName}"正在被${tag.usageCount}个知识条目使用，无法删除`);
		return;
	}
	dialog.warning({
		title: '确认删除',
		content: `确定要删除标签"${tag.tagName}"吗？删除后无法恢复。`,
		positiveText: '确定',
		negativeText: '取消',
		onPositiveClick: async () => {
			try {
				const response: any = await deleteKnowledgeTag([tag.id]);
				if (response.code === 200) {
					message.success('删除成功');
					await loadTags();
					emit('refresh');
				} else {
					message.error(response.msg || '删除失败');
				}
			} catch (error: any) {
				message.error(error?.message || '删除失败');
			}
		},
	});
}

async function handleSave() {
	if (!editFormRef.value) return;
	try {
		await editFormRef.value.validate();
		saving.value = true;
		const { id, ...params } = editFormValue.value;
		let response: any;
		if (id) {
			response = await updateKnowledgeTag(id, params);
		} else {
			response = await createKnowledgeTag(params);
		}
		if (response.code === 200) {
			message.success(id ? '更新成功' : '创建成功');
			showEditModal.value = false;
			await loadTags();
			emit('refresh');
		} else {
			message.error(response.msg || (id ? '更新失败' : '创建失败'));
		}
	} catch (error: any) {
		if (error?.errors) {
			return;
		}
		message.error(error?.message || (editingTag.value ? '更新失败' : '创建失败'));
	} finally {
		saving.value = false;
	}
}

function handleClose() {
	show.value = false;
}

function handleShowChange(value: boolean) {
	if (value) {
		loadTags();
	} else {
		searchKeyword.value = '';
		filterType.value = null;
	}
}

watch(() => props.modelValue, (newVal) => {
	if (newVal) {
		loadTags();
	}
});
</script>

<style scoped lang="scss">
.tag-manage-content {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.manage-header {
	display: flex;
	align-items: center;
	gap: 12px;
}

.tag-list-container {
	min-height: 300px;
	max-height: 500px;
	overflow-y: auto;
}

.tag-group {
	margin-bottom: 24px;
}

.tag-group:last-child {
	margin-bottom: 0;
}

.group-header {
	display: flex;
	align-items: center;
	margin-bottom: 12px;
	padding-bottom: 8px;
	border-bottom: 1px solid var(--n-border-color);
}

.group-title {
	font-size: 16px;
	font-weight: 600;
	color: var(--n-text-color);
}

.group-count {
	font-size: 14px;
	color: var(--n-text-color-2);
	margin-left: 8px;
}

.tag-card {
	width: 280px;
	transition: all 0.2s;
}

.tag-card-system {
	border-color: #0078d4;
}

.tag-card-content {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.tag-card-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.tag-card-description {
	color: var(--n-text-color-2);
	font-size: 13px;
	line-height: 1.5;
}

.tag-card-footer {
	margin-top: 4px;
	padding-top: 8px;
	border-top: 1px solid var(--n-border-color);
}

.tag-badge {
	margin-left: 4px;
	padding: 0 4px;
	font-size: 10px;
	background: rgba(255, 255, 255, 0.3);
	border-radius: 2px;
}

.modal-footer {
	display: flex;
	justify-content: flex-end;
}
</style>
