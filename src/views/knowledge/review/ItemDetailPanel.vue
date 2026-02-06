<template>
	<div class="item-detail-panel">
		<div v-if="loading" class="loading-overlay">
			<n-spin size="large" />
		</div>
		<n-form
			v-else
			ref="formRef"
			:model="formValue"
			:rules="formRules"
			label-placement="top"
			style="margin-bottom: 0; padding-bottom: 0;"
		>
			<n-space vertical :size="16" style="margin-bottom: 0; padding-bottom: 0;">
				<!-- 基础信息 -->
				<n-card title="基础信息" size="small">
					<n-grid :cols="24" :x-gap="20">
						<n-gi :span="24">
							<n-form-item label="标题" path="title">
								<n-input
									v-model:value="formValue.title"
									:maxlength="255"
									show-count
									placeholder="请输入标题"
								/>
							</n-form-item>
						</n-gi>
						<n-gi :span="24">
							<n-form-item label="摘要">
								<n-input
									type="textarea"
									v-model:value="formValue.summary"
									:autosize="{ minRows: 2, maxRows: 5 }"
									:maxlength="500"
									show-count
									placeholder="请输入摘要"
								/>
							</n-form-item>
						</n-gi>
						<n-gi :span="12">
							<n-form-item label="漏洞类型" path="vulnerabilityTypes">
								<div class="cwe-selector-trigger">
									<n-button
										@click="openCweSelector"
										style="width: 100%; justify-content: flex-start;"
										quaternary
									>
										<template #icon>
											<SvgIcon icon="ri:file-list-line" />
										</template>
										{{ (formValue.vulnerabilityTypes && formValue.vulnerabilityTypes.length > 0)
											? `已选择 ${formValue.vulnerabilityTypes.length} 项`
											: '选择漏洞类型' }}
									</n-button>
									<div v-if="formValue.vulnerabilityTypes && formValue.vulnerabilityTypes.length > 0" class="selected-cwe-tags">
										<n-space :size="8" wrap style="margin-top: 8px;">
											<n-tag
												v-for="cweId in formValue.vulnerabilityTypes"
												:key="cweId"
												closable
												@close="removeCwe(cweId)"
												:style="{ backgroundColor: '#F5F5F5', color: '#606060' }"
											>
												{{ getCweDisplayName(cweId) }}
											</n-tag>
										</n-space>
									</div>
								</div>
							</n-form-item>
						</n-gi>
						<n-gi :span="12">
									<n-form-item label="语言">
									<n-select
										v-model:value="formValue.language"
										:options="languageOptions"
										placeholder="请选择语言"
										filterable
									/>
								</n-form-item>
							</n-gi>
							<n-gi :span="12">
								<n-form-item label="风险等级">
									<n-select
										v-model:value="formValue.severity"
										:options="severityOptions"
										placeholder="请选择风险等级"
										filterable
									/>
								</n-form-item>
						</n-gi>
						<n-gi :span="24">
							<n-form-item label="标签">
								<TagPicker
									:model-value="selectedTags"
									:system-tags="systemTags"
									:user-tags="userTags"
									placeholder="点击选择标签"
									@create="handleTagCreate"
									@update:model-value="handleTagsChange"
									@refresh="loadTagData"
								/>
							</n-form-item>
						</n-gi>
					</n-grid>
				</n-card>

				<!-- 原始片段信息 -->
				<n-card v-if="shouldShowFragmentInfo" title="原始片段信息" size="small">
					<n-space vertical :size="12">
						<div v-if="fragmentInfo.loading" style="text-align: center; padding: 20px;">
							<n-spin size="medium" />
						</div>
						<template v-else-if="fragmentInfo.data">
							<div class="fragment-info-item">
								<span class="fragment-label">片段索引：</span>
								<span class="fragment-value">{{ fragmentInfo.data.idx ?? fragmentInfo.data.chunkIndex ?? '-' }}</span>
							</div>
							<div v-if="fragmentInfo.data.docName" class="fragment-info-item">
								<span class="fragment-label">来源文档：</span>
								<span class="fragment-value">{{ fragmentInfo.data.docName }}</span>
							</div>
							<div v-if="fragmentInfo.data.content" class="fragment-content-section">
								<div class="fragment-label" style="margin-bottom: 8px;">片段内容：</div>
								<div class="fragment-content">
									{{ fragmentInfo.data.content }}
								</div>
							</div>
						</template>
						<div v-else-if="fragmentInfo.error" style="color: #f5222d; font-size: 12px;">
							加载片段信息失败：{{ fragmentInfo.error }}
						</div>
						<div v-else-if="props.item.chunkIndex !== undefined || props.item.fid !== undefined" style="color: #999; font-size: 12px;">
							无法获取片段信息（缺少文档ID）
						</div>
					</n-space>
				</n-card>

				<!-- 内容编辑 -->
				<n-card title="内容编辑" size="small">
					<n-space vertical :size="16">
						<n-form-item label="问题描述">
							<n-input
								type="textarea"
								v-model:value="formValue.problemDescription"
								:autosize="{ minRows: 4, maxRows: 10 }"
								placeholder="请输入问题描述"
								@blur="handleSave"
							/>
						</n-form-item>
						<n-form-item label="修复方案">
							<n-input
								type="textarea"
								v-model:value="formValue.fixSolution"
								:autosize="{ minRows: 4, maxRows: 10 }"
								placeholder="请输入修复方案"
								@blur="handleSave"
							/>
						</n-form-item>
						<n-form-item label="示例代码">
							<CodeEditor
								:model-value="formValue.exampleCode || ''"
								placeholder="请输入示例代码"
								:min-height="200"
								:max-height="500"
								:show-toolbar="true"
								:show-line-numbers="true"
								:language="formValue.language"
								@update:model-value="handleCodeChange"
							/>
						</n-form-item>
					</n-space>
				</n-card>

				<!-- 风险评分 -->
				<n-card title="风险评分" size="small">
					<n-grid :cols="24" :x-gap="20" :y-gap="20">
						<n-gi :span="24">
							<div class="risk-assessment-section">
								<div class="section-header">
									<span class="section-hint">选择以下维度，系统依据CVSS v4.0标准自动评估和存储风险等级</span>
								</div>
								<n-grid :cols="24" :x-gap="16" :y-gap="20" style="margin-top: 16px;">
									<n-gi :span="12">
										<n-form-item label="攻击方式" path="riskAttackVector">
											<n-select
												v-model:value="formValue.riskAttackVector"
												:options="riskAttackVectorOptions"
												placeholder="选择攻击方式"
												clearable
											>
												<template #option="{ label, description }">
													<div class="select-option">
														<div class="option-label">{{ label }}</div>
														<div class="option-desc">{{ description }}</div>
													</div>
												</template>
											</n-select>
										</n-form-item>
									</n-gi>
									<n-gi :span="12">
										<n-form-item label="利用复杂度" path="riskComplexity">
											<n-select
												v-model:value="formValue.riskComplexity"
												:options="riskComplexityOptions"
												placeholder="选择利用复杂度"
												clearable
												@update:value="handleRiskDimensionChange"
											>
												<template #option="{ label, description }">
													<div class="select-option">
														<div class="option-label">{{ label }}</div>
														<div class="option-desc">{{ description }}</div>
													</div>
												</template>
											</n-select>
										</n-form-item>
									</n-gi>
									<n-gi :span="12">
										<n-form-item label="权限需求" path="riskPrivileges">
											<n-select
												v-model:value="formValue.riskPrivileges"
												:options="riskPrivilegesOptions"
												placeholder="选择权限需求"
												clearable
												@update:value="handleRiskDimensionChange"
											>
												<template #option="{ label, description }">
													<div class="select-option">
														<div class="option-label">{{ label }}</div>
														<div class="option-desc">{{ description }}</div>
													</div>
												</template>
											</n-select>
										</n-form-item>
									</n-gi>
									<n-gi :span="12">
										<n-form-item label="用户交互" path="riskUserInteraction">
											<n-select
												v-model:value="formValue.riskUserInteraction"
												:options="riskUserInteractionOptions"
												placeholder="选择用户交互需求"
												clearable
											>
												<template #option="{ label, description }">
													<div class="select-option">
														<div class="option-label">{{ label }}</div>
														<div class="option-desc">{{ description }}</div>
													</div>
												</template>
											</n-select>
										</n-form-item>
									</n-gi>
									<n-gi :span="24">
										<n-form-item label="影响范围" path="riskImpact">
											<n-select
												v-model:value="formValue.riskImpact"
												:options="riskImpactOptions"
												placeholder="选择影响范围（可多选）"
												multiple
												clearable
											>
												<template #option="{ label, description }">
													<div class="select-option">
														<div class="option-label">{{ label }}</div>
														<div class="option-desc">{{ description }}</div>
													</div>
												</template>
											</n-select>
										</n-form-item>
									</n-gi>
								</n-grid>
							</div>
						</n-gi>
						<n-gi :span="24" v-if="calculatedRiskScore">
							<div class="risk-score-display">
								<div class="risk-score-value">
									<span class="score-number">{{ calculatedRiskScore.exact !== null ? calculatedRiskScore.exact.toFixed(1) : `${calculatedRiskScore.min?.toFixed(1)} - ${calculatedRiskScore.max?.toFixed(1)}` }}</span>
									<span class="score-label">/ 10.0</span>
								</div>
								<div v-if="calculatedRiskLevel" class="risk-level-badge">
									<n-tag :style="{ backgroundColor: calculatedRiskLevel.color, color: '#FFFFFF' }">
										{{ calculatedRiskLevel.label }}
									</n-tag>
								</div>
							</div>
						</n-gi>
					</n-grid>
				</n-card>
			</n-space>
		</n-form>

		<!-- CWE选择器 -->
		<CweSelector
			v-model="showCweSelector"
			:selected-values="tempSelectedCweIds"
			@confirm="handleCweSelectorConfirm"
			@cancel="handleCweSelectorCancel"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { NCard, NForm, NFormItem, NInput, NSelect, NGrid, NGi, NSpace, NTag, NButton, NSpin, useMessage, FormInst, FormRules } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import CweSelector from '@/components/knowledge/CweSelector.vue'
import TagPicker from '@/components/knowledge/TagPicker.vue'
import CodeEditor from '@/components/knowledge/CodeEditor.vue'
import { getKnowledgeTagList, createKnowledgeTag } from '@/api/knowledgeTag'
import { getDictDataByType } from '@/api/dict'
import { getCweReferenceListAll } from '@/api/cwe'
import { getFragmentBatch } from '@/api/knowledge'
import { updateKnowledgeItem, type KnowledgeItemReq } from '@/api/knowledgeItem'

interface Props {
	item: any
	docId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
	update: [item: any]
	dirty: [isDirty: boolean]
	valid: [isValid: boolean]
}>()

const message = useMessage()
const formRef = ref<FormInst | null>(null)
const formValue = ref<any>({})
const originalFormValue = ref<any>({})
const selectedTags = ref<any[]>([])
const originalSelectedTags = ref<any[]>([])
const systemTags = ref<any[]>([])
const userTags = ref<any[]>([])

const formRules: FormRules = {
	title: [
		{ required: true, message: '请输入标题', trigger: ['blur', 'input'] },
		{ min: 1, max: 255, message: '标题长度应在 1-255 个字符之间', trigger: ['blur', 'input'] },
	],
	vulnerabilityTypes: [
		{ 
			required: true, 
			message: '请至少选择一个漏洞类型', 
			trigger: ['blur', 'change'],
			validator: (rule: any, value: any) => {
				const vulnTypes = formValue.value.vulnerabilityTypes;
				if (!vulnTypes || vulnTypes.length === 0) {
					return new Error('请至少选择一个漏洞类型');
				}
				return true;
			}
		},
	],
	problemDescription: [
		{ required: true, message: '请输入问题描述', trigger: ['blur', 'input'] },
		{ min: 1, message: '问题描述不能为空', trigger: ['blur', 'input'] },
	],
	fixSolution: [
		{ required: true, message: '请输入修复方案', trigger: ['blur', 'input'] },
		{ min: 1, message: '修复方案不能为空', trigger: ['blur', 'input'] },
	],
	riskAttackVector: [
		{ required: true, message: '请选择攻击方式', trigger: ['blur', 'change'] },
	],
	riskComplexity: [
		{ required: true, message: '请选择攻击复杂度', trigger: ['blur', 'change'] },
	],
	riskPrivileges: [
		{ required: true, message: '请选择所需权限', trigger: ['blur', 'change'] },
	],
	riskUserInteraction: [
		{ required: true, message: '请选择用户交互', trigger: ['blur', 'change'] },
	],
	riskImpact: [
		{ 
			required: true, 
			message: '请至少选择一项影响', 
			trigger: ['blur', 'change'],
			validator: (rule: any, value: any) => {
				const impact = formValue.value.riskImpact;
				if (!impact || impact.length === 0) {
					return new Error('请至少选择一项影响');
				}
				return true;
			}
		},
	],
}

const isFormDirty = computed(() => {
	if (!props.item) return false
	const current = formValue.value
	const original = originalFormValue.value
	const currentVulnTypes = current.vulnerabilityTypes || []
	const originalVulnTypes = original.vulnerabilityTypes || []
	const currentRiskImpact = current.riskImpact || []
	const originalRiskImpact = original.riskImpact || []
	const currentTags = selectedTags.value.map(t => t.name).sort()
	const originalTags = originalSelectedTags.value.map(t => t.name).sort()
	
	return (
		current.title !== original.title ||
		current.summary !== original.summary ||
		current.problemDescription !== original.problemDescription ||
		current.fixSolution !== original.fixSolution ||
		current.exampleCode !== original.exampleCode ||
		JSON.stringify(currentVulnTypes.sort()) !== JSON.stringify(originalVulnTypes.sort()) ||
		current.language !== original.language ||
		current.severity !== original.severity ||
		JSON.stringify(currentTags) !== JSON.stringify(originalTags) ||
		current.riskAttackVector !== original.riskAttackVector ||
		current.riskComplexity !== original.riskComplexity ||
		current.riskPrivileges !== original.riskPrivileges ||
		current.riskUserInteraction !== original.riskUserInteraction ||
		JSON.stringify(currentRiskImpact.sort()) !== JSON.stringify(originalRiskImpact.sort())
	)
})

const isFormValid = ref(false)

const languageOptions = ref<any[]>([])
const severityOptions = ref<any[]>([])
const vulnerabilityTypeOptions = ref<any[]>([])

const showCweSelector = ref(false)
const tempSelectedCweIds = ref<string[]>([])

const loading = ref(false)

const fragmentInfo = ref<{
	loading: boolean
	data: any | null
	error: string | null
}>({
	loading: false,
	data: null,
	error: null
})

const shouldShowFragmentInfo = computed(() => {
	return props.item && (props.item.chunkIndex !== undefined || props.item.fid !== undefined) && props.docId
})

function getCweDisplayName(cweId: string): string {
	const option = vulnerabilityTypeOptions.value.find((opt: any) => opt.value === cweId)
	return option ? option.label : cweId
}

function openCweSelector() {
	tempSelectedCweIds.value = [...(formValue.value.vulnerabilityTypes || [])]
	showCweSelector.value = true
}

function handleCweSelectorConfirm(selectedCweIds: string[]) {
	formValue.value.vulnerabilityTypes = selectedCweIds
	showCweSelector.value = false
}

function handleCweSelectorCancel() {
	showCweSelector.value = false
}

function removeCwe(cweId: string) {
	const vulnTypes = formValue.value.vulnerabilityTypes || []
	formValue.value.vulnerabilityTypes = vulnTypes.filter((id: string) => id !== cweId)
}

const riskAttackVectorOptions = [
	{ label: '远程', value: 'N', description: '可通过网络远程利用' },
	{ label: '本地', value: 'L', description: '需要本地访问' },
	{ label: '网络相邻', value: 'A', description: '需要同一网络环境' },
	{ label: '物理', value: 'P', description: '需要物理接触' },
]

const riskComplexityOptions = [
	{ label: '低', value: 'L', description: '利用条件简单，容易触发' },
	{ label: '高', value: 'H', description: '利用条件复杂，难以触发' },
]

const riskPrivilegesOptions = [
	{ label: '无需权限', value: 'N', description: '普通用户即可利用' },
	{ label: '需要权限', value: 'L', description: '需要登录或基本权限' },
	{ label: '高级权限', value: 'H', description: '需要管理员或系统权限' },
]

const riskUserInteractionOptions = [
	{ label: '无需交互', value: 'N', description: '无需用户操作即可利用' },
	{ label: '需要交互', value: 'R', description: '需要用户执行某些操作' },
]

const riskImpactOptions = [
	{ label: '机密性', value: 'C', description: '可能泄露敏感信息' },
	{ label: '完整性', value: 'I', description: '可能篡改数据或系统' },
	{ label: '可用性', value: 'A', description: '可能导致服务中断' },
]

const riskDimensionsStatus = computed(() => {
	const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = formValue.value
	const filled = []
	const missing = []
	if (riskAttackVector) filled.push('攻击方式')
	else missing.push('攻击方式')
	if (riskComplexity) filled.push('利用复杂度')
	else missing.push('利用复杂度')
	if (riskPrivileges) filled.push('权限需求')
	else missing.push('权限需求')
	if (riskUserInteraction) filled.push('用户交互')
	else missing.push('用户交互')
	if (riskImpact && riskImpact.length > 0) filled.push('影响范围')
	else missing.push('影响范围')
	return { filled, missing, isComplete: missing.length === 0 }
})

const calculatedRiskScore = computed(() => {
	const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = formValue.value
	const { isComplete } = riskDimensionsStatus.value

	if (!riskAttackVector && !riskComplexity && !riskPrivileges && !riskUserInteraction && (!riskImpact || riskImpact.length === 0)) {
		return null
	}

	let baseScore = 0
	const avScores: Record<string, number> = { 'N': 0.85, 'A': 0.62, 'L': 0.55, 'P': 0.2 }
	const acScores: Record<string, number> = { 'L': 0.77, 'H': 0.44 }
	const prScores: Record<string, number> = { 'N': 0.85, 'L': 0.62, 'H': 0.27 }
	const uiScores: Record<string, number> = { 'N': 0.85, 'R': 0.62 }
	const impactScores: Record<string, number> = { 'C': 0.22, 'I': 0.22, 'A': 0.22 }

	if (riskAttackVector) baseScore += avScores[riskAttackVector] || 0
	if (riskComplexity) baseScore += acScores[riskComplexity] || 0
	if (riskPrivileges) baseScore += prScores[riskPrivileges] || 0
	if (riskUserInteraction) baseScore += uiScores[riskUserInteraction] || 0

	let maxImpact = 0
	if (riskImpact && riskImpact.length > 0) {
		riskImpact.forEach((imp: string) => {
			maxImpact = Math.max(maxImpact, impactScores[imp] || 0)
		})
		baseScore += maxImpact * 3
	}

	const score = Math.min(10, Math.max(0, baseScore * 1.08))

	if (isComplete) {
		return { exact: Math.round(score * 10) / 10, min: null, max: null, isComplete: true }
	} else {
		let maxPossibleScore = score
		const { missing } = riskDimensionsStatus.value
		if (missing.includes('攻击方式')) maxPossibleScore += avScores['N'] * 1.08
		if (missing.includes('利用复杂度')) maxPossibleScore += acScores['L'] * 1.08
		if (missing.includes('权限需求')) maxPossibleScore += prScores['N'] * 1.08
		if (missing.includes('用户交互')) maxPossibleScore += uiScores['N'] * 1.08
		if (missing.includes('影响范围')) maxPossibleScore += impactScores['C'] * 3 * 1.08
		maxPossibleScore = Math.min(10, maxPossibleScore)

		return {
			exact: null,
			min: Math.round(score * 10) / 10,
			max: Math.round(maxPossibleScore * 10) / 10,
			isComplete: false
		}
	}
})

const calculatedRiskLevel = computed(() => {
	const score = calculatedRiskScore.value
	if (score === null) return null

	const scoreValue = score.exact !== null ? score.exact : (score.max !== null ? score.max : 0)

	if (scoreValue >= 9.0) return { value: 'critical', label: '极高', color: '#d13438' }
	if (scoreValue >= 7.0) return { value: 'high', label: '高', color: '#ff8c00' }
	if (scoreValue >= 4.0) return { value: 'medium', label: '中', color: '#ffaa44' }
	if (scoreValue >= 0.1) return { value: 'low', label: '低', color: '#107c10' }
	return { value: 'none', label: '无', color: '#8a8886' }
})

function generateCvssVector() {
	const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = formValue.value
	if (!riskAttackVector || !riskComplexity || !riskPrivileges || !riskUserInteraction || !riskImpact || riskImpact.length === 0) {
		return undefined
	}
	const impactStr = riskImpact.sort().join('')
	return `CVSS:4.0/AV:${riskAttackVector}/AC:${riskComplexity}/PR:${riskPrivileges}/UI:${riskUserInteraction}/VC:${impactStr}/VI:${impactStr}/VA:${impactStr}`
}

watch(() => calculatedRiskScore.value, (score) => {
	if (score && score.isComplete && score.exact !== null) {
		formValue.value.cvssScore = score.exact
		formValue.value.cvssVector = generateCvssVector()
		if (calculatedRiskLevel.value) {
			formValue.value.severity = calculatedRiskLevel.value.value
		}
	}
}, { deep: true })

function handleTagsChange(tags: any[]) {
	selectedTags.value = tags
	formValue.value.tags = tags.map(t => t.name)
}

async function handleTagCreate(tagName: string, description?: string) {
	const trimmedName = tagName.trim()
	if (!trimmedName) return

	if (systemTags.value.some(t => t.name === trimmedName) || userTags.value.some(t => t.name === trimmedName)) {
		return
	}

	try {
		const response: any = await createKnowledgeTag({
			tagName: trimmedName,
			tagType: 'user',
			description: description?.trim() || undefined,
		})
		if (response.code === 200) {
			userTags.value.push({
				name: trimmedName,
				type: 'user',
				description: description?.trim() || undefined,
			})
			message.success(`标签"${trimmedName}"创建成功`)
		} else {
			message.error(response.msg || "创建标签失败")
		}
	} catch (error: any) {
		console.error("创建标签失败:", error)
		message.error("创建标签失败")
	}
}

async function loadTagData() {
	try {
		const response = await getKnowledgeTagList({ pageNum: 1, pageSize: 1000 })
		if (response.code === 200 && response.rows) {
			const allTags = response.rows.map((tag: any) => ({
				name: tag.tagName || '',
				type: (tag.tagType || 'user') as 'system' | 'user',
				description: tag.description || '',
				category: tag.tagCategory || '',
			}))
			systemTags.value = allTags.filter((tag: { type: string }) => tag.type === 'system')
			userTags.value = allTags.filter((tag: { type: string }) => tag.type === 'user')
		}
	} catch (error) {
		console.error('加载标签失败:', error)
	}
}

async function loadOptions() {
	try {
		const [languagesRes, severitiesRes, cweRes] = await Promise.all([
			getDictDataByType('knowledge_language'),
			getDictDataByType('knowledge_severity'),
			getCweReferenceListAll(),
		])

		languageOptions.value = ((languagesRes as any)?.data || []).map((opt: any) => ({
			label: opt.dictLabel || opt.label || '',
			value: opt.dictValue || opt.value || '',
		}))

		severityOptions.value = ((severitiesRes as any)?.data || []).map((opt: any) => ({
			label: opt.dictLabel || opt.label || '',
			value: opt.dictValue || opt.value || '',
		}))

		vulnerabilityTypeOptions.value = ((cweRes as any)?.data || []).map((cwe: any) => ({
			label: `${cwe.cweId}: ${cwe.nameZh || cwe.nameEn || cwe.cweId}`,
			value: cwe.cweId,
		}))
	} catch (error) {
		console.error('加载选项数据失败:', error)
	}
}

function parseCvssVector(cvssVector?: string): {
	av?: string
	ac?: string
	pr?: string
	ui?: string
	vc?: string
	vi?: string
	va?: string
} | null {
	if (!cvssVector) return null
	const result: any = {}
	const parts = cvssVector.split('/')
	parts.forEach(part => {
		const [key, value] = part.split(':')
		if (key && value) {
			result[key.toLowerCase()] = value
		}
	})
	return result
}

function extractCvssImpactFromVector(cvssVector?: string): string[] {
	if (!cvssVector) return []
	const parsed = parseCvssVector(cvssVector)
	if (!parsed) return []
	const impacts: string[] = []
	if (parsed.vc === 'H') impacts.push('C')
	if (parsed.vi === 'H') impacts.push('I')
	if (parsed.va === 'H') impacts.push('A')
	return impacts
}

watch(() => props.item, async (newItem) => {
	if (newItem) {
		console.log('[ItemDetailPanel] 接收到 item prop:', {
			itemUuid: newItem.itemUuid,
			itemTitle: newItem.title
		})
		loading.value = true
		try {
			let riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact
			if (newItem.cvssVector) {
				const cvssParsed = parseCvssVector(newItem.cvssVector)
				riskAttackVector = cvssParsed?.av
				riskComplexity = cvssParsed?.ac
				riskPrivileges = cvssParsed?.pr
				riskUserInteraction = cvssParsed?.ui
				riskImpact = extractCvssImpactFromVector(newItem.cvssVector)
			}
			const finalRiskImpact = (newItem.cvssImpact && newItem.cvssImpact.length > 0)
				? newItem.cvssImpact
				: ((newItem.riskImpact && newItem.riskImpact.length > 0)
					? newItem.riskImpact
					: (riskImpact && riskImpact.length > 0
						? riskImpact
						: []))
			formValue.value = {
				...newItem,
				vulnerabilityTypes: newItem.vulnerabilityTypes || (newItem.vulnerabilityType ? [newItem.vulnerabilityType] : []),
				riskImpact: finalRiskImpact,
				riskAttackVector: newItem.riskAttackVector || riskAttackVector || newItem.cvssAttackVector || undefined,
				riskComplexity: newItem.riskComplexity || riskComplexity || newItem.cvssAttackComplexity || undefined,
				riskPrivileges: newItem.riskPrivileges || riskPrivileges || newItem.cvssPrivilegesRequired || undefined,
				riskUserInteraction: newItem.riskUserInteraction || riskUserInteraction || newItem.cvssUserInteraction || undefined,
			}
			console.log('[ItemDetailPanel] formValue 赋值完成')
			selectedTags.value = (newItem.tags || []).map((name: string) => ({ name }))
			await Promise.all([loadOptions(), loadTagData(), loadFragmentInfo()])
			await nextTick()
			originalFormValue.value = JSON.parse(JSON.stringify(formValue.value))
			originalSelectedTags.value = JSON.parse(JSON.stringify(selectedTags.value))
			if (formRef.value) {
				formRef.value.restoreValidation()
				try {
					await formRef.value.validate()
					isFormValid.value = true
				} catch {
					isFormValid.value = false
				}
				emit('valid', isFormValid.value)
			}
			emit('dirty', false)
		} finally {
			loading.value = false
		}
	}
}, { immediate: true })

async function handleSave() {
	if (!formRef.value) return
	if (!props.item?.itemUuid) {
		message.error('缺少条目UUID，无法保存')
		return
	}
	try {
		await formRef.value.validate()
		const vulnTypes = formValue.value.vulnerabilityTypes
		if (!vulnTypes || vulnTypes.length === 0) {
			message.error('请至少选择一个漏洞类型')
			return
		}
		if (!formValue.value.problemDescription?.trim()) {
			message.error('请输入问题描述')
			return
		}
		if (!formValue.value.fixSolution?.trim()) {
			message.error('请输入修复方案')
			return
		}
		const currentCvssVector = generateCvssVector()
		const currentCvssScore = calculatedRiskScore.value?.exact
		const currentSeverity = calculatedRiskLevel.value?.value || formValue.value.severity
		if (currentCvssVector) {
			formValue.value.cvssVector = currentCvssVector
		}
		if (currentCvssScore !== null && currentCvssScore !== undefined) {
			formValue.value.cvssScore = currentCvssScore
		}
		if (currentSeverity) {
			formValue.value.severity = currentSeverity
		}
		const params: KnowledgeItemReq = {
			itemUuid: props.item.itemUuid,
			title: formValue.value.title,
			summary: formValue.value.summary,
			problemDescription: formValue.value.problemDescription,
			fixSolution: formValue.value.fixSolution,
			exampleCode: formValue.value.exampleCode,
			vulnerabilityTypes: formValue.value.vulnerabilityTypes,
			language: formValue.value.language,
			severity: formValue.value.severity,
			cvssVector: formValue.value.cvssVector,
			cvssScore: formValue.value.cvssScore,
			tags: selectedTags.value.map(t => t.name),
		}
		if (props.item.kid) {
			params.kid = props.item.kid
		}
		const response: any = await updateKnowledgeItem(props.item.itemUuid, params)
		if (response.code === 200) {
			const updatedItem = { ...props.item, ...formValue.value, tags: selectedTags.value.map(t => t.name) }
			emit('update', updatedItem)
			originalFormValue.value = JSON.parse(JSON.stringify(formValue.value))
			originalSelectedTags.value = JSON.parse(JSON.stringify(selectedTags.value))
			message.success('保存成功')
		} else {
			message.error(response.msg || '保存失败')
		}
	} catch (error: any) {
		if (error && typeof error === 'object' && error.message) {
			message.error(error.message || '保存失败')
		} else {
			message.error('保存失败')
		}
	}
}

function handleRestore() {
	formValue.value = JSON.parse(JSON.stringify(originalFormValue.value))
	selectedTags.value = JSON.parse(JSON.stringify(originalSelectedTags.value))
	formRef.value?.restoreValidation()
}

defineExpose({
	save: handleSave,
	restore: handleRestore,
	isDirty: isFormDirty,
	isValid: isFormValid
})

watch(() => isFormDirty.value, (dirty) => {
	emit('dirty', dirty)
})

function checkFormValidation() {
	if (!formRef.value) {
		isFormValid.value = false
		return
	}
	formRef.value.validate((errors) => {
		if (errors && errors.length > 0) {
			isFormValid.value = false
		} else {
			const vulnTypes = formValue.value.vulnerabilityTypes
			const riskImpact = formValue.value.riskImpact
			const hasRequiredFields = 
				formValue.value.title?.trim() &&
				vulnTypes && vulnTypes.length > 0 &&
				formValue.value.problemDescription?.trim() &&
				formValue.value.fixSolution?.trim() &&
				formValue.value.riskAttackVector &&
				formValue.value.riskComplexity &&
				formValue.value.riskPrivileges &&
				formValue.value.riskUserInteraction &&
				riskImpact && riskImpact.length > 0
			isFormValid.value = !!hasRequiredFields
		}
		emit('valid', isFormValid.value)
	})
}

watch(() => formRef.value, () => {
	checkFormValidation()
})

watch(() => formValue.value, () => {
	checkFormValidation()
}, { deep: true })

async function loadFragmentInfo() {
	if (!props.item || !props.docId) {
		fragmentInfo.value = { loading: false, data: null, error: null }
		return
	}
	
	const chunkIndex = props.item.chunkIndex
	if (chunkIndex === undefined && props.item.fid === undefined) {
		fragmentInfo.value = { loading: false, data: null, error: null }
		return
	}
	
	fragmentInfo.value = { loading: true, data: null, error: null }
	
	try {
		const response = await getFragmentBatch([{
			docId: props.docId,
			idx: chunkIndex ?? 0
		}])
		
		if (response.code === 200 && response.data && response.data.length > 0) {
			fragmentInfo.value = { loading: false, data: response.data[0], error: null }
		} else {
			fragmentInfo.value = { loading: false, data: null, error: '未找到片段信息' }
		}
	} catch (error: any) {
		fragmentInfo.value = { loading: false, data: null, error: error.message || '加载失败' }
	}
}

watch(() => props.docId, () => {
	if (props.item) {
		loadFragmentInfo()
	}
})

onMounted(async () => {
	if (props.item) {
		loading.value = true
		try {
			await Promise.all([loadOptions(), loadTagData(), loadFragmentInfo()])
		} finally {
			loading.value = false
		}
	}
})
</script>

<style scoped>
.item-detail-panel {
	padding: 16px;
	position: relative;
	min-height: 200px;
}

.loading-overlay {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(255, 255, 255, 0.9);
	z-index: 10;
}

.fragment-info-item {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 13px;
}

.fragment-label {
	font-weight: 500;
	color: #666;
	min-width: 80px;
}

.fragment-value {
	color: #333;
}

.fragment-content-section {
	margin-top: 12px;
}

.fragment-content {
	padding: 12px;
	background: #f5f5f5;
	border-radius: 4px;
	font-size: 13px;
	line-height: 1.6;
	color: #333;
	max-height: 300px;
	overflow-y: auto;
	white-space: pre-wrap;
	word-break: break-word;
}

.risk-assessment-section {
	margin-top: 8px;
}

.section-header {
	margin-bottom: 8px;
}

.section-hint {
	font-size: 12px;
	color: #666;
}

.select-option {
	padding: 4px 0;
}

.option-label {
	font-weight: 500;
	font-size: 14px;
}

.option-desc {
	font-size: 12px;
	color: #999;
	margin-top: 2px;
}

.risk-score-display {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 16px;
	background: #F5F5F5;
	border-radius: 8px;
}

.risk-score-value {
	display: flex;
	align-items: baseline;
	gap: 4px;
}

.score-number {
	font-size: 24px;
	font-weight: 600;
	color: #333;
}

.score-label {
	font-size: 14px;
	color: #666;
}

.risk-level-badge {
	display: flex;
	align-items: center;
}

.cwe-selector-trigger {
	width: 100%;
}

.selected-cwe-tags {
	margin-top: 8px;
}
</style>
