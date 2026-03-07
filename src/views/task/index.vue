<script setup lang='ts'>
import { h, onMounted, onUnmounted, ref, watch, computed } from 'vue'
import type {
	DataTableColumns, UploadInst, UploadFileInfo
} from 'naive-ui';
import {
	NButton, NCard, NDataTable, NDivider, NEmpty, NForm, NFormItem, NGrid,
	NGridItem, NIcon, NInput, NMessageProvider, NModal, NPopconfirm, NProgress,
	NScrollbar, NSelect, NSpace, NSpin, NTag, NText, NUpload,
	NStatistic, NNumberAnimation,
	useMessage
} from 'naive-ui'
import { SvgIcon } from '@/components/common'
import {
	createTask, fetchTaskList, updateTask, deleteTask, downloadTaskFile,
	getTaskFileUploadUrl, uploadTaskFilesBatch, Task, TaskPriority, TaskStatus,
	TaskType, TaskFile, getTaskVulnerabilities, TaskVulnerabilityDetail,
	cancelTask, retryTask, fetchSysTemplateList
} from '@/api/task'
import { fetchProjectList, Project } from '@/api/project'
import {
	AddOutline, TrashOutline, CreateOutline, ArrowBackOutline, StopOutline,
	RefreshOutline, DocumentTextOutline, CheckmarkCircleOutline, SearchOutline, DownloadOutline,
	ExpandOutline, ContractOutline
} from '@vicons/ionicons5'
import { getToken } from '@/store/modules/auth/helper'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const ms = useMessage()
const token = getToken()
const headers = { Authorization: `Bearer ${token}` }

// --- 状态定义 ---
const projects = ref<Project[]>([])
const projectOptions = ref<Array<{ label: string; value: string | number }>>([])
const filterProjectId = ref<string | number | null>(null)
const selectedProjectId = ref<string | number | null>(null)

const uploadRef = ref<UploadInst | null>(null)
const folderUploadInputRef = ref<HTMLInputElement | null>(null)
const uploadedFiles = ref<TaskFile[]>([])
const uploadAction = getTaskFileUploadUrl()
const isUploadingFolder = ref(false)

const tasks = ref<Task[]>([])
const loading = ref(false)
const total = ref(0)
const pollingTimer = ref<NodeJS.Timeout | null>(null)
const progressTimer = ref<NodeJS.Timeout | null>(null)
const pollingInterval = ref(5000)
const progressInterval = ref(1000)
const enablePolling = ref(true)

const taskProgressMap = ref<Map<string | number, number>>(new Map())
const taskVulnerabilityCountMap = ref<Map<string | number, number>>(new Map())
const prevTaskStatusMap = ref<Map<string | number, TaskStatus>>(new Map())

const pagination = ref({
	page: 1,
	pageSize: 10,
	showSizePicker: true,
	pageSizes: [10, 20, 50],
	onChange: (page: number) => {
		pagination.value.page = page
		loadTasks()
	},
	onUpdatePageSize: (pageSize: number) => {
		pagination.value.pageSize = pageSize
		pagination.value.page = 1
		loadTasks()
	}
})

// 筛选条件
const filterStatus = ref<TaskStatus | null>(null)
const filterPriority = ref<TaskPriority | null>(null)
const filterTaskType = ref<TaskType | null>(null)
const searchKeyword = ref('')

// 任务模态框
const showModal = ref(false)
const isEdit = ref(false)
const currentTask = ref<Task>({
	title: '',
	description: '',
	priority: TaskPriority.MEDIUM,
	taskType: TaskType.OTHER,
	projectId: null,
	tags: [],
	inputFiles: []
})


// 漏洞详情与放大状态
const showVulnerabilityModal = ref(false)
const vulnerabilityLoading = ref(false)
const vulnerabilityDetail = ref<TaskVulnerabilityDetail | null>(null)
const currentTaskId = ref<number | string | null>(null)
const isFullscreen = ref(false)

// 模板库相关
const showTemplateModal = ref(false)
const templateLoading = ref(false)
const templateData = ref<any[]>([])
const searchTemplateName = ref('')
const searchTemplateType = ref<string | null>(null)

// --- 选项与标签配置 ---
const templateTypeOptions = [
	{ label: '文本内容', value: '1' },
	{ label: 'Word 模板', value: '2' }
]

const priorityOptions = [
	{ label: '低', value: TaskPriority.LOW },
	{ label: '中', value: TaskPriority.MEDIUM },
	{ label: '高', value: TaskPriority.HIGH },
	{ label: '紧急', value: TaskPriority.URGENT }
]

const taskTypeOptions = [
	{ label: '编码规范检查', value: TaskType.CODE_STANDARD_CHECK },
	{ label: '数据安全审计', value: TaskType.DATA_SECURITY_AUDIT },
	{ label: '依赖关系分析', value: TaskType.DEPENDENCY_ANALYSIS },
	{ label: '合规审计', value: TaskType.COMPLIANCE_AUDIT },
	{ label: '其他', value: TaskType.OTHER }
]

const statusOptions = [
	{ label: '待处理', value: TaskStatus.PENDING },
	{ label: '进行中', value: TaskStatus.IN_PROGRESS },
	{ label: '已完成', value: TaskStatus.COMPLETED },
	{ label: '已取消', value: TaskStatus.CANCELLED }
]

const priorityTagType = (p: TaskPriority) => ({ [TaskPriority.LOW]: 'default', [TaskPriority.MEDIUM]: 'info', [TaskPriority.HIGH]: 'warning', [TaskPriority.URGENT]: 'error' }[p] || 'default')
const statusTagType = (s: TaskStatus) => ({ [TaskStatus.PENDING]: 'default', [TaskStatus.IN_PROGRESS]: 'info', [TaskStatus.COMPLETED]: 'success', [TaskStatus.CANCELLED]: 'error' }[s] || 'default')
const taskTypeTagType = (t: TaskType) => ({ [TaskType.CODE_STANDARD_CHECK]: 'info', [TaskType.DATA_SECURITY_AUDIT]: 'warning', [TaskType.DEPENDENCY_ANALYSIS]: 'success', [TaskType.COMPLIANCE_AUDIT]: 'error', [TaskType.OTHER]: 'default' }[t] || 'default')

const priorityLabel = (p: TaskPriority) => ({ [TaskPriority.LOW]: '低', [TaskPriority.MEDIUM]: '中', [TaskPriority.HIGH]: '高', [TaskPriority.URGENT]: '紧急' }[p] || p)
const taskTypeLabel = (t: TaskType) => ({ [TaskType.CODE_STANDARD_CHECK]: '编码规范检查', [TaskType.DATA_SECURITY_AUDIT]: '数据安全审计', [TaskType.DEPENDENCY_ANALYSIS]: '依赖关系分析', [TaskType.COMPLIANCE_AUDIT]: '合规审计', [TaskType.OTHER]: '其他' }[t] || t)

// --- 核心逻辑 ---
const loadProjects = async () => {
	try {
		const response = await fetchProjectList({ currentPage: 1, pageSize: 1000 })
		if (response && response.code === 200) {
			const list = response.data?.rows || response.data?.list || response.data || []
			projects.value = list
			projectOptions.value = list.map((p: any) => ({ label: p.name, value: p.id! }))
		}
	} catch (error) { console.error(error) }
}

const loadTasks = async () => {
	try {
		loading.value = true
		const params: any = {
			currentPage: pagination.value.page,
			pageSize: pagination.value.pageSize,
		}
		if (filterStatus.value) params.status = filterStatus.value
		if (filterPriority.value) params.priority = filterPriority.value
		if (filterTaskType.value) params.taskType = filterTaskType.value
		if (filterProjectId.value) params.projectId = filterProjectId.value

		const response = await fetchTaskList(params)
		if (response && (response.code === 200 || response.success)) {
			let taskList = response.data?.rows || response.rows || response.data || []

			if (searchKeyword.value) {
				const kw = searchKeyword.value.toLowerCase()
				taskList = taskList.filter((t: any) => t.title.toLowerCase().includes(kw))
			}

			taskList.forEach((task: Task) => {
				if (!task.id) return
				const prevStatus = prevTaskStatusMap.value.get(task.id)
				if (task.status === TaskStatus.COMPLETED && [TaskStatus.IN_PROGRESS, TaskStatus.PENDING].includes(prevStatus || '')) {
					ms.success(`任务「${task.title}」已完成`)
				}
				prevTaskStatusMap.value.set(task.id, task.status)

				if (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.PENDING) {
					if (!taskProgressMap.value.has(task.id)) taskProgressMap.value.set(task.id, 0)
				}
			})

			tasks.value = taskList
			total.value = response.data?.total || response.total || taskList.length

			taskVulnerabilityCountMap.value.clear()
			await Promise.all(taskList.map(async (task) => {
				if (!task.id) return 0
				try {
					const res = await getTaskVulnerabilities(task.id)
					const count = res?.code === 200 ? (res.data?.totalCount || 0) : 0
					taskVulnerabilityCountMap.value.set(task.id, count)
					return count
				} catch (e) { return 0 }
			}))

			const hasInProgressTasks = taskList.some(task => task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.PENDING)
			if (hasInProgressTasks && enablePolling.value) {
				startPolling(); startProgressTimer()
			} else {
				stopPolling()
			}
		} else {
			loadTasksFromLocal()
		}
	} catch (error) {
		console.error(error)
		loadTasksFromLocal()
	} finally { loading.value = false }
}

const loadTasksFromLocal = () => {
	try {
		const localTasks = localStorage.getItem('tasks')
		if (localTasks) {
			const taskList = JSON.parse(localTasks) as Task[]
			tasks.value = taskList
			total.value = taskList.length
		}
	} catch (e) {}
}

const openTemplateModal = () => {
	searchTemplateName.value = ''
	searchTemplateType.value = null
	showTemplateModal.value = true
	fetchTemplateList()
}

const fetchTemplateList = async () => {
	templateLoading.value = true
	try {
		const res = await fetchSysTemplateList({
			pageNum: 1,
			pageSize: 100,
			status: '0',
			templateName: searchTemplateName.value,
			templateType: searchTemplateType.value
		})
		templateData.value = res.rows || res.data || []
	} catch (e) {
		ms.error('获取模板列表失败')
	} finally {
		templateLoading.value = false
	}
}

const handleSelectTemplate = (tpl: any) => {
	const now = new Date().toISOString()
	let fileName = tpl.template_name || '未命名模板'
	let fileUrl = tpl.file_path || ''
	let fileType = ''
	let fileSize = 0

	if (tpl.template_type === '2') {
		if (!tpl.file_path) { ms.warning('该模板未关联文件'); return }
		if (!fileName.endsWith('.docx')) fileName += '.docx'
		fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	} else {
		fileName += '.txt'
		fileType = 'text/plain'
		const content = tpl.template_content || ''
		const blob = new Blob([content], { type: 'text/plain' })
		fileUrl = URL.createObjectURL(blob)
		fileSize = blob.size
	}

	uploadedFiles.value = uploadedFiles.value.filter(f => !f.id.toString().startsWith('tpl_'))

	const newFile: TaskFile = {
		id: `tpl_${tpl.template_id}`,
		name: `[模板] ${fileName}`,
		url: fileUrl,
		type: fileType,
		size: fileSize,
		uploadTime: now
	}

	uploadedFiles.value.push(newFile)
	currentTask.value.inputFiles = [...uploadedFiles.value]
	ms.success(`已加载模板：${fileName}`)
	showTemplateModal.value = false
}

const currentTemplateId = computed(() => {
	const tplFile = uploadedFiles.value.find(f => f.id && f.id.toString().startsWith('tpl_'))
	return tplFile ? tplFile.id.toString().replace('tpl_', '') : null
})

const openCreateModal = () => {
	isEdit.value = false; uploadedFiles.value = []
	currentTask.value = { title: '', description: '', priority: TaskPriority.MEDIUM, taskType: TaskType.OTHER, projectId: filterProjectId.value || null, tags: [], inputFiles: [] }
	if (uploadRef.value) uploadRef.value.clear()
	showModal.value = true
}

const openEditModal = (task: Task) => {
	isEdit.value = true
	uploadedFiles.value = task.inputFiles ? JSON.parse(JSON.stringify(task.inputFiles)) : []

	const tplId = (task as any).templateId || (task as any).template_id
	const tplName = (task as any).templateName || (task as any).template_name

	if (tplId) {
		const displayName = tplName ? `[模板] ${tplName}` : `[模板] 编号:${tplId}`
		if (!uploadedFiles.value.some(f => f.id === `tpl_${tplId}`)) {
			uploadedFiles.value.push({
				id: `tpl_${tplId}`,
				name: displayName,
				url: '', type: 'template', size: 0, uploadTime: ''
			})
		}
	}

	currentTask.value = { ...task, inputFiles: uploadedFiles.value, projectId: task.projectId || null, id: task.id }
	if (uploadRef.value) uploadRef.value.clear()
	showModal.value = true
}

const handleUploadFinish = ({ file, event }: any) => {
	const xhr = event?.target as XMLHttpRequest
	if (xhr) {
		try {
			const res = JSON.parse(xhr.responseText)
			if (res.code === 200 || res.success) {
				const d = res.data || res
				const newFile: TaskFile = {
					id: d.id || `file_${Date.now()}`,
					name: file.name,
					url: d.url || '',
					size: file.file?.size,
					type: file.file?.type,
					uploadTime: new Date().toISOString()
				}
				if (!uploadedFiles.value.find(f => f.id === newFile.id)) {
					uploadedFiles.value.push(newFile)
					currentTask.value.inputFiles = [...uploadedFiles.value]
				}
				ms.success('文件上传成功')
			} else { ms.error('文件上传失败') }
		} catch (e) { }
	}
	return file
}

const handleBeforeUpload = () => true
const handleFolderUpload = () => folderUploadInputRef.value?.click()
const handleFolderChange = async (event: Event) => {
	const input = event.target as HTMLInputElement
	if (!input.files?.length) return
	isUploadingFolder.value = true
	try {
		const fileArray: File[] = []
		const paths: string[] = []
		for (let i = 0; i < input.files.length; i++) {
			const f = input.files[i]
			fileArray.push(f)
			paths.push(f.webkitRelativePath || f.name)
		}
		const res = await uploadTaskFilesBatch(fileArray, paths)
		if (res?.code === 200) {
			(res.data || []).forEach((d: any) => {
				uploadedFiles.value.push({
					id: d.id || `file_${Date.now()}`,
					name: d.name,
					url: d.url,
					size: d.size,
					type: d.type,
					uploadTime: new Date().toISOString()
				})
			})
			currentTask.value.inputFiles = [...uploadedFiles.value]
			ms.success(`成功上传 ${res.data?.length} 个文件`)
		}
	} catch (e) { ms.error('上传失败') }
	finally { isUploadingFolder.value = false; input.value = '' }
}

const saveTask = async () => {
	if (!currentTask.value.title.trim()) return ms.warning('请输入标题')
	if (!currentTask.value.taskType) return ms.warning('请选择类型')

	const realFiles: TaskFile[] = []
	let selectedTemplateId: string | number | null = null

	uploadedFiles.value.forEach((f) => {
		if (f.id && f.id.toString().startsWith('tpl_')) {
			selectedTemplateId = f.id.toString().replace('tpl_', '')
		} else {
			realFiles.push(f)
		}
	})

	const taskData: any = {
		...currentTask.value,
		inputFiles: realFiles,
		templateId: selectedTemplateId
	}

	try {
		const res = isEdit.value && currentTask.value.id
			? await updateTask(currentTask.value.id, taskData)
			: await createTask(taskData)

		if (res?.code === 200) {
			ms.success(isEdit.value ? '更新成功' : '创建成功')
			showModal.value = false; uploadedFiles.value = []; await loadTasks()
		} else { ms.error(res?.msg || '操作失败') }
	} catch (e: any) { ms.error('操作失败') }
}

const handleDelete = async (task: Task) => { if(task.id && await deleteTask(task.id)) { ms.success('删除成功'); loadTasks() } }
const handleDownloadFile = async (file: TaskFile) => {
	if(file.id) await downloadTaskFile(file.id, file.name); else if(file.url) window.open(file.url, '_blank')
}

// 进度逻辑
const getTaskProgress = (task: Task) => {
	if (task.status === TaskStatus.COMPLETED) return 100
	if (task.status === TaskStatus.CANCELLED) return 0
	return taskProgressMap.value.get(task.id!) || 0
}
const getProgressText = (p: number, s?: TaskStatus) => {
	if (s === TaskStatus.COMPLETED) return '已完成'
	return p < 30 ? '正在分析代码' : p < 70 ? '调用智能体分析' : '生成报告'
}
const startProgressTimer = () => {
	if (progressTimer.value) clearInterval(progressTimer.value)
	progressTimer.value = setInterval(() => {
		tasks.value.forEach(t => {
			if (t.id && [TaskStatus.IN_PROGRESS, TaskStatus.PENDING].includes(t.status)) {
				const cur = taskProgressMap.value.get(t.id) || 0
				if (cur < 99) {
					let nextVal = cur + Math.random() * 2 + 1
					taskProgressMap.value.set(t.id, Number(Math.min(99, nextVal).toFixed(1)))
				}
			}
		})
	}, progressInterval.value)
}
const startPolling = () => {
	if (pollingTimer.value) clearInterval(pollingTimer.value)
	pollingTimer.value = setInterval(() => loadTasks(), pollingInterval.value)
}
const stopPolling = () => { if (pollingTimer.value) clearInterval(pollingTimer.value); stopProgressTimer() }
const stopProgressTimer = () => { if (progressTimer.value) clearInterval(progressTimer.value) }
const handleCancelTask = async (t: Task) => { if(t.id) await cancelTask(t.id); loadTasks() }
const handleRetryTask = async (t: Task) => { if(t.id) await retryTask(t.id); loadTasks() }

const getSeverityClass = (s: string) => ({ 严重: 'critical', 高: 'high', 中: 'medium', 低: 'low' }[s] || 'low')
const getSeverityTagType = (s: string) => ({ 严重: 'error', 高: 'warning', 中: 'info', 低: 'default' }[s] || 'default')

const openVulnerabilityModal = async (task: Task) => {
	if (!task.id) return
	currentTaskId.value = task.id
	isFullscreen.value = false // 每次打开弹窗重置为常规大小
	showVulnerabilityModal.value = true
	vulnerabilityLoading.value = true
	try {
		const res = await getTaskVulnerabilities(task.id)
		vulnerabilityDetail.value = res?.data || { taskTitle: task.title, totalCount: 0, vulnerabilities: [] }
	} catch (e) { } finally { vulnerabilityLoading.value = false }
}

const fileMetricsColumns = [
	{
		title: '文件名称',
		key: 'fileName',
		ellipsis: { tooltip: true }
	},
	{
		title: '质量评分',
		key: 'score',
		width: 100,
		align: 'right' as const,
		render: (row: any) => {
			const score = Number(row.score);
			let color = '#d03050';
			if (score >= 90) color = '#18a058';
			else if (score >= 60) color = '#f0a020';
			return h('span', { style: { color, fontWeight: 'bold' } }, score.toFixed(2));
		}
	},
	{
		title: '规范检查',
		key: 'isPassed',
		width: 100,
		align: 'center' as const,
		render: (row: any) => {
			return h(
				NTag,
				{ type: row.isPassed ? 'success' : 'error', size: 'small', round: true },
				{ default: () => row.isPassed ? '通过' : '未通过' }
			);
		}
	}
];

const columns = [
	{ title: '任务标题', key: 'title', width: 150, ellipsis: { tooltip: true }, render: (row: Task) => h('span', { style: { cursor: 'pointer', color: '#18a058', textDecoration: 'underline' }, onClick: () => openVulnerabilityModal(row) }, row.title) },
	{ title: '任务要求', key: 'description', width: 100, ellipsis: { tooltip: true }, render: (row: Task) => row.description || '-' },
	{ title: '任务类型', key: 'taskType', width: 150, render: (row: Task) => h(NTag, { type: taskTypeTagType(row.taskType) as any, size: 'small' }, { default: () => taskTypeLabel(row.taskType) }) },
	{ title: '优先级', key: 'priority', width: 100, render: (row: Task) => h(NTag, { type: priorityTagType(row.priority) as any, size: 'small' }, { default: () => priorityLabel(row.priority) }) },
	{ title: '状态/进度', key: 'status', width: 100, render: (row: Task) => {
			if (row.status === TaskStatus.COMPLETED) return h(NTag, { type: 'success', size: 'small' }, { default: () => '已完成' })
			if (row.status === TaskStatus.CANCELLED) return h(NTag, { type: 'error', size: 'small' }, { default: () => '已取消' })
			const rawProgress = getTaskProgress(row)
			const p = Number(rawProgress.toFixed(1))
			return h('div', { style: 'display: flex; flex-direction: column; gap: 4px; width: 100%' }, [
				h(NProgress, { percentage: p, height: 8, showIndicator: true }),
				h('span', { style: 'font-size: 12px; color: #666' }, `${getProgressText(p, row.status)} ${p}%`)
			])
		}},
	{ title: '漏洞总数', key: 'vulnerability_num', width: 100, render: (row: Task) => h('span', { style: { color: '#D03050', fontWeight: '800' } }, taskVulnerabilityCountMap.value.get(row.id!) || 0) },

	{
		title: '上传文件',
		key: 'inputFiles',
		width: 150,
		render: (row: Task) => {
			const files = row.inputFiles || []
			const displayFiles = files.slice(0, 5)
			const tags = displayFiles.map(f =>
				h(NTag, { size: 'small', type: 'info' }, { default: () => f.name })
			)
			if (files.length > 5) {
				tags.push(
					h(NTag, { size: 'small', type: 'default', style: 'border-style: dashed; color: #666;' }, {
						default: () => `共 ${files.length} 个文件`
					})
				)
			}
			return h(NSpace, { size: 'small', vertical: true }, { default: () => tags })
		}
	},
	{
		title: '返回文件',
		key: 'outputFiles',
		width: 150,
		render: (row: Task) => {
			const files = row.outputFiles || []
			const displayFiles = files.slice(0, 5)
			const btns = displayFiles.map(f =>
				h(NButton, { size: 'small', type: 'primary', onClick: () => handleDownloadFile(f) }, {
					icon: () => h(NIcon, null, { default: () => h(DownloadOutline) }),
					default: () => '下载'
				})
			)
			if (files.length > 5) {
				btns.push(
					h(NTag, { size: 'small', type: 'default', style: 'border-style: dashed; color: #666;' }, {
						default: () => `共 ${files.length} 个文件`
					})
				)
			}
			return h(NSpace, { size: 'small', vertical: true }, { default: () => btns })
		}
	},

	{ title: '创建时间', key: 'createdAt', width: 150, render: (row: Task) => row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' },
	{ title: '操作', key: 'actions', width: 320, render: (row: Task) => {
			const btns = [h(NButton, { size: 'small', type: 'primary', onClick: () => openEditModal(row) }, { icon: () => h(NIcon, null, { default: () => h(CreateOutline) }), default: () => '编辑' })]
			if (row.status === TaskStatus.IN_PROGRESS || row.status === TaskStatus.PENDING) {
				btns.push(h(NPopconfirm, { onPositiveClick: () => handleCancelTask(row) }, { trigger: () => h(NButton, { size: 'small', type: 'warning' }, { icon: () => h(NIcon, null, { default: () => h(StopOutline) }), default: () => '中断' }), default: () => '确定中断？' }))
			} else {
				btns.push(h(NButton, { size: 'small', type: 'info', onClick: () => handleRetryTask(row) }, { icon: () => h(NIcon, null, { default: () => h(RefreshOutline) }), default: () => '重试' }))
			}
			btns.push(h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, { trigger: () => h(NButton, { size: 'small', type: 'error' }, { icon: () => h(NIcon, null, { default: () => h(TrashOutline) }), default: () => '删除' }), default: () => '确定删除？' }))
			return h(NSpace, { size: 'small' }, { default: () => btns })
		}}
]

const goBackToProject = () => {
	filterProjectId.value = null
	router.back()
}

onMounted(async () => {
	const queryProjectId = route.query.projectId
	if (queryProjectId) filterProjectId.value = String(queryProjectId)
	await loadProjects()
	await loadTasks()
})
onUnmounted(() => stopPolling())
</script>

<template>
	<NMessageProvider>
		<div class="h-full flex flex-col p-4 dark:bg-[#24272e]">
			<NCard class="flex-1 flex flex-col" title="任务管理">
				<template #header-extra>
					<NSpace>
						<NButton v-if="filterProjectId" @click="goBackToProject"><template #icon><NIcon><ArrowBackOutline /></NIcon></template>返回项目管理</NButton>
						<NButton type="primary" @click="openCreateModal"><template #icon><NIcon><AddOutline /></NIcon></template>创建任务</NButton>
					</NSpace>
				</template>

				<div class="mb-4">
					<NGrid :cols="5" :x-gap="12">
						<NGridItem><NInput v-model:value="searchKeyword" placeholder="搜索任务..." @keyup.enter="loadTasks"><template #prefix><NIcon><SvgIcon icon="ri:search-line" /></NIcon></template></NInput></NGridItem>
						<NGridItem><NSelect v-model:value="filterTaskType" placeholder="筛选任务类型" clearable :options="taskTypeOptions" @update:value="handleFilterChange" /></NGridItem>
						<NGridItem><NSelect v-model:value="filterStatus" placeholder="筛选状态" clearable :options="statusOptions" @update:value="handleFilterChange" /></NGridItem>
						<NGridItem><NSelect v-model:value="filterPriority" placeholder="筛选优先级" clearable :options="priorityOptions" @update:value="handleFilterChange" /></NGridItem>
						<NGridItem><NButton type="primary" block @click="loadTasks">刷新</NButton></NGridItem>
					</NGrid>
				</div>

				<div class="flex-1 overflow-hidden">
					<NDataTable :columns="columns" :data="tasks" :loading="loading" :pagination="pagination" :max-height="600" striped />
					<NEmpty v-if="!loading && tasks.length === 0" description="暂无任务" />
				</div>
			</NCard>

			<NModal v-model:show="showModal" :title="isEdit ? '编辑任务' : '创建任务'" preset="dialog" style="width: 600px">
				<NForm :model="currentTask" label-placement="left" label-width="80">
					<NFormItem label="任务标题" required><NInput v-model:value="currentTask.title" placeholder="请输入任务标题" /></NFormItem>
					<NFormItem label="任务要求"><NInput v-model:value="currentTask.description" type="textarea" placeholder="请输入任务要求" :rows="4" /></NFormItem>
					<NFormItem label="任务类型" required><NSelect v-model:value="currentTask.taskType" :options="taskTypeOptions" placeholder="请选择任务类型" /></NFormItem>
					<NFormItem label="优先级"><NSelect v-model:value="currentTask.priority" :options="priorityOptions" /></NFormItem>
					<NFormItem label="所属项目"><NSelect v-model:value="currentTask.projectId" :options="projectOptions" placeholder="请选择项目（可选）" clearable /></NFormItem>
					<NFormItem label="上传文件">
						<NSpace vertical :size="12" class="w-full">
							<NSpace>
								<NUpload ref="uploadRef" :action="uploadAction" :headers="headers" multiple :max="10" @finish="handleUploadFinish" @before-upload="handleBeforeUpload" :show-file-list="false">
									<NButton type="primary"><template #icon><NIcon><SvgIcon icon="mage:upload" /></NIcon></template>上传文件</NButton>
								</NUpload>
								<NButton type="default" :loading="isUploadingFolder" @click="handleFolderUpload"><template #icon><NIcon><SvgIcon icon="material-symbols:folder-open" /></NIcon></template>上传文件夹</NButton>

								<NButton type="info" dashed @click="openTemplateModal">
									<template #icon><NIcon><DocumentTextOutline /></NIcon></template>
									从模板库选择
								</NButton>

								<input ref="folderUploadInputRef" type="file" webkitdirectory multiple style="display: none" @change="handleFolderChange">
							</NSpace>

							<div v-if="uploadedFiles.length > 0" class="mt-2">
								<NText depth="3" style="font-size: 12px">已上传文件：</NText>
								<NSpace class="mt-1" size="small" :wrap="true">
									<NTag v-for="file in uploadedFiles" :key="file.id || file.name" size="small" type="info" closable
												@close="() => { uploadedFiles = uploadedFiles.filter(f => (f.id && file.id ? f.id !== file.id : f.name !== file.name)); currentTask.inputFiles = [...uploadedFiles] }">
										{{ file.name }}
									</NTag>
								</NSpace>
							</div>

							<div v-if="currentTemplateId" class="mt-1 pl-1">
								<NText depth="3" style="font-size: 12px; color: #18a058; font-weight: bold;">
									已选模板编号：{{ currentTemplateId }}
								</NText>
							</div>
						</NSpace>
					</NFormItem>
				</NForm>
				<template #action>
					<NSpace>
						<NButton @click="showModal = false">取消</NButton>
						<NButton type="primary" @click="saveTask">保存</NButton>
					</NSpace>
				</template>
			</NModal>

			<NModal v-model:show="showTemplateModal" title="选择标准模板" preset="card" style="width: 750px">
				<div class="flex flex-col gap-4">
					<NGrid :cols="3" :x-gap="12">
						<NGridItem><NInput v-model:value="searchTemplateName" placeholder="模板名称..." /></NGridItem>
						<NGridItem><NSelect v-model:value="searchTemplateType" :options="templateTypeOptions" placeholder="类型" clearable /></NGridItem>
						<NGridItem><NButton type="primary" @click="fetchTemplateList">查询</NButton></NGridItem>
					</NGrid>
					<NDataTable
						:columns="[
              { title: '模板名称', key: 'template_name' },
              { title: '类型', key: 'template_type', render: (r) => h(NTag, { type: r.template_type==='2'?'success':'info', size:'small' }, { default: () => r.template_type==='2'?'Word':'文本' }) },
              { title: '操作', key: 'op', render: (r) => h(NButton, { size:'small', onClick: () => handleSelectTemplate(r) }, { icon:()=>h(NIcon,null,{default:()=>h(CheckmarkCircleOutline)}), default:()=>'选择' }) }
            ]"
						:data="templateData" :loading="templateLoading" :max-height="400"
					/>
				</div>
			</NModal>

			<NModal
				v-model:show="showVulnerabilityModal"
				title="任务漏洞详情"
				preset="card"
				:style="isFullscreen ? { width: '100vw', height: '100vh', margin: 0, borderRadius: 0 } : { width: '900px' }"
				:mask-closable="false"
				class="vulnerability-modal compact-modal"
			>
				<template #header-extra>
					<NButton text style="font-size: 20px; margin-right: 8px" @click="isFullscreen = !isFullscreen" title="切换全屏">
						<NIcon><component :is="isFullscreen ? ContractOutline : ExpandOutline" /></NIcon>
					</NButton>
				</template>

				<NSpin :show="vulnerabilityLoading">
					<div v-if="vulnerabilityDetail">

						<div class="flex items-center justify-between mb-2 p-3 bg-gray-50 dark:bg-[#1f1f1f] border border-gray-200 dark:border-gray-700 rounded-md">
							<div>
								<NText strong style="font-size: 16px">{{ vulnerabilityDetail.taskTitle }}</NText>
								<div class="mt-2" v-if="vulnerabilityDetail.severityCount">
									<NSpace :size="8">
										<NTag v-if="vulnerabilityDetail.severityCount?.['严重']" type="error" size="small">严重: {{ vulnerabilityDetail.severityCount['严重'] }}</NTag>
										<NTag v-if="vulnerabilityDetail.severityCount?.['高']" type="warning" size="small">高: {{ vulnerabilityDetail.severityCount['高'] }}</NTag>
										<NTag v-if="vulnerabilityDetail.severityCount?.['中']" type="info" size="small">中: {{ vulnerabilityDetail.severityCount['中'] }}</NTag>
										<NTag v-if="vulnerabilityDetail.severityCount?.['低']" type="default" size="small">低: {{ vulnerabilityDetail.severityCount['低'] }}</NTag>
									</NSpace>
								</div>
							</div>
							<div class="text-center">
								<NText depth="3" style="font-size: 12px">漏洞总数</NText>
								<div class="text-xl font-bold" :style="{ color: vulnerabilityDetail.totalCount > 0 ? '#d03050' : '#18a058', lineHeight: 1 }">{{ vulnerabilityDetail.totalCount }}</div>
							</div>
						</div>

						<NCard size="small" class="mb-2">
							<template #header>代码质量与规范分析</template>
							<NGrid :cols="2" :x-gap="16" class="mb-2">
								<NGridItem>
									<NStatistic label="总体代码质量评分 (加权)">
										<template #prefix><NIcon><SvgIcon icon="mdi:star-outline" color="#2080f0"/></NIcon></template>
										<NNumberAnimation :from="0" :to="vulnerabilityDetail.overallScore || 0" :precision="2" />
										<template #suffix><NText depth="3" style="font-size: 13px;">/ 100</NText></template>
									</NStatistic>
								</NGridItem>
								<NGridItem>
									<NStatistic label="代码规范遵循通过率">
										<template #prefix><NIcon><SvgIcon icon="mdi:checkbox-marked-circle-outline" color="#18a058"/></NIcon></template>
										<NNumberAnimation :from="0" :to="(vulnerabilityDetail.complianceRate || 0) * 100" :precision="1" />
										<template #suffix><NText depth="3" style="font-size: 13px;">%</NText></template>
										<template #suffix-extra>
											<NText depth="3" style="font-size: 12px; margin-left: 8px;">(通过: {{ vulnerabilityDetail.passedFileCount || 0 }} / 总: {{ vulnerabilityDetail.totalFileCount || 0 }})</NText>
										</template>
									</NStatistic>
								</NGridItem>
							</NGrid>
							<NDivider style="margin: 8px 0; font-size: 12px;" dashed title-placement="left">各文件详情</NDivider>
							<NDataTable size="small" :columns="fileMetricsColumns" :data="vulnerabilityDetail.fileMetrics || []" :max-height="120" striped virtual-scroll />
						</NCard>

						<div v-if="vulnerabilityDetail.vulnerabilities?.length > 0">
							<NDivider style="margin: 12px 0 8px 0; font-size: 13px;">漏洞列表</NDivider>

							<div class="border border-gray-200 dark:border-gray-700 rounded-md bg-[#fafafa] dark:bg-[#141414]">
								<NScrollbar :style="{ maxHeight: isFullscreen ? 'calc(100vh - 380px)' : '250px' }" class="p-2">
									<div class="vulnerability-list">
										<div v-for="(vuln, index) in vulnerabilityDetail.vulnerabilities" :key="vuln.id || index" :class="`vulnerability-item severity-${getSeverityClass(vuln.severity)}`">
											<div class="vulnerability-header">
												<div class="flex items-center gap-2">
													<NTag :type="getSeverityTagType(vuln.severity)" size="small">{{ vuln.severity }}</NTag>
													<NText strong style="font-size: 14px">{{ vuln.title }}</NText>
												</div>
												<NText v-if="vuln.category" depth="3" style="font-size: 12px">{{ vuln.category }}</NText>
											</div>
											<div class="vulnerability-content">
												<div class="vulnerability-section"><NText strong style="font-size: 13px; color: #666">漏洞描述：</NText><div class="vulnerability-text"><NText style="font-size: 13px">{{ vuln.description }}</NText></div></div>
												<div v-if="vuln.filePath" class="vulnerability-section"><NText strong style="font-size: 13px; color: #666">文件位置：</NText><div class="vulnerability-text"><NText code style="font-size: 12px">{{ vuln.filePath }}{{ vuln.lineNumber ? `:${vuln.lineNumber}` : '' }}</NText></div></div>
												<div v-if="vuln.codeSnippet" class="vulnerability-section"><NText strong style="font-size: 13px; color: #666">相关代码：</NText><div class="vulnerability-text"><pre class="code-snippet"><code>{{ vuln.codeSnippet }}</code></pre></div></div>
												<div class="vulnerability-section fix-suggestion"><NText strong style="font-size: 13px; color: #18a058">修复建议：</NText><div class="vulnerability-text"><NText style="font-size: 13px">{{ vuln.fixSuggestion }}</NText></div></div>
											</div>
										</div>
									</div>
								</NScrollbar>
							</div>

						</div>
						<NEmpty v-else description="该任务暂未发现漏洞" class="py-4" />

					</div>
				</NSpin>
			</NModal>
		</div>
	</NMessageProvider>
</template>

<style scoped>
:deep(.n-data-table) { height: 100%; }

/* --- 压缩间距 --- */
.compact-modal :deep(.n-card > .n-card-header) { padding-bottom: 4px; padding-top: 10px; font-size: 15px; }
.compact-modal :deep(.n-card > .n-card__content) { padding-top: 4px; padding-bottom: 10px; }

/* 漏洞列表紧凑化 */
.vulnerability-list { display: flex; flex-direction: column; gap: 6px; }
.vulnerability-item { padding: 12px; border-left: 3px solid #e5e7eb; background-color: #ffffff; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

.vulnerability-item.severity-critical { border-left-color: #d03050; }
.vulnerability-item.severity-high { border-left-color: #f0a020; }
.vulnerability-item.severity-medium { border-left-color: #2080f0; }
.vulnerability-item.severity-low { border-left-color: #909399; }

.dark .vulnerability-item { background-color: #1a1a1a; border-left-color: #404040; }
.dark .vulnerability-item.severity-critical { border-left-color: #d03050; }
.dark .vulnerability-item.severity-high { border-left-color: #f0a020; }
.dark .vulnerability-item.severity-medium { border-left-color: #2080f0; }
.dark .vulnerability-item.severity-low { border-left-color: #606060; }

.vulnerability-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed rgba(0, 0, 0, 0.08); }
.dark .vulnerability-header { border-bottom-color: rgba(255, 255, 255, 0.1); }
.vulnerability-content { padding: 0; }
.vulnerability-section { margin-bottom: 8px; }
.vulnerability-section:last-child { margin-bottom: 0; }
.vulnerability-text { margin-top: 4px; line-height: 1.5; }
.code-snippet { background-color: #f5f5f5; padding: 8px 12px; border-radius: 4px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; margin: 4px 0 0 0; }
.dark .code-snippet { background-color: #2d2d2d; color: #f8f8f2; }
.fix-suggestion { padding: 8px 12px; background-color: #f6ffed; border-left: 3px solid #52c41a; border-radius: 4px; margin-top: 6px; }
.dark .fix-suggestion { background-color: #162312; border-left-color: #73d13d; }

/* 缩小 NStatistic 字体 */
:deep(.n-statistic .n-statistic-value .n-statistic-value__prefix .n-icon) { font-size: 18px; margin-right: 6px; }
:deep(.n-statistic .n-statistic-value .n-statistic-value__content) { font-weight: 700; font-size: 20px; }
</style>
