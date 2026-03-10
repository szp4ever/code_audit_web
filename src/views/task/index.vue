<script setup lang='ts'>
import { h, onMounted, onUnmounted, ref, watch, computed } from 'vue'
import type {
	DataTableColumns, UploadInst, UploadFileInfo
} from 'naive-ui';
import {
	NButton, NCard, NCheckbox, NDataTable, NDivider, NEmpty, NForm, NFormItem, NGrid,
	NGridItem, NIcon, NInput, NMessageProvider, NModal, NPopconfirm, NProgress,
	NScrollbar, NSelect, NSpace, NSpin, NTag, NText, NUpload,
	NStatistic, NNumberAnimation, NDrawer, NDrawerContent,
	useMessage, NTabs, NTabPane
} from 'naive-ui'
import { SvgIcon } from '@/components/common'
import {
	createTask, fetchTaskList, updateTask, deleteTask, downloadTaskFile,
	getTaskFileUploadUrl, uploadTaskFilesBatch, Task, TaskPriority, TaskStatus,
	TaskType, TaskFile, getTaskVulnerabilities, TaskVulnerabilityDetail,
	cancelTask, retryTask, fetchSysTemplateList
} from '@/api/task'
import { fetchProjectList, Project } from '@/api/project'
import { updateFalsePositiveStatus, archiveToKnowledgeBase } from '@/api/task'
import {
	AddOutline, TrashOutline, CreateOutline, ArrowBackOutline, StopOutline,
	RefreshOutline, DocumentTextOutline, CheckmarkCircleOutline, SearchOutline, DownloadOutline,
	ExpandOutline, ContractOutline, SparklesOutline, AddCircleOutline, TimeOutline, CodeWorkingOutline
} from '@vicons/ionicons5'
import { getToken } from '@/store/modules/auth/helper'
import { useRoute, useRouter } from 'vue-router'

// 引入 RuoYi 封装的 request 工具，用于自动创建和查询知识库
import request from '@/utils/request'

const route = useRoute()
const router = useRouter()
const ms = useMessage()
const token = getToken()
const headers = { Authorization: `Bearer ${token}` }

// ==========================================
// ✨ 自动知识库管家 (已补全后端校验必填字段) ✨
// ==========================================
const KB_NAME_FALSE_POSITIVE = '误报特征知识库'
const KB_NAME_RECOMMENDATION = '推荐修复方案知识库'

const kidFalsePositive = ref('')
const kidRecommendation = ref('')

const initKnowledgeBases = async () => {
	try {
		const res = await request({
			url: '/knowledge/list',
			method: 'GET',
			params: { pageNum: 1, pageSize: 1000 }
		})

		const kbList = res.rows || res.data || []

		// 查找或创建函数
		const ensureKB = async (name, desc) => {
			let target = kbList.find(kb => kb.kname === name);
			if (!target) {
				// 严格按照后端 KnowledgeInfoBo 的必填字段传参
				const saveRes = await request({
					url: '/knowledge/save',
					method: 'POST',
					data: {
						kname: name,             // 对应数据库 kname
						share: 0,                // 必填：0-私有，1-公开
						description: desc,
						vectorModelName: 'text2vec', // 必填：需确保后端配置了此模型
						retrieveLimit: 5,        // 必填：检索条数
						textBlockSize: 500       // 必填：分块大小
					}
				})
				// 创建后重新获取一下 ID
				const refreshRes = await request({ url: '/knowledge/list', method: 'GET' })
				target = (refreshRes.rows || refreshRes.data || []).find(kb => kb.kname === name)
			}
			return target ? (target.kid || target.id) : ''
		}

		kidFalsePositive.value = await ensureKB(KB_NAME_FALSE_POSITIVE, '自动归档的代码扫描误报特征')
		kidRecommendation.value = await ensureKB(KB_NAME_RECOMMENDATION, '自动归档的漏洞推荐修复方案')

		console.log('✅ 知识库管家初始化完毕')
	} catch (error) {
		// 如果报 Weaviate 连接失败，说明向量数据库没开
		if (error.message && error.message.includes('Weaviate')) {
			ms.error('后端向量数据库（Weaviate）未启动，无法自动创建知识库。请联系管理员启动服务。')
		} else {
			console.error('初始化失败', error)
		}
	}
}
// ==========================================

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

// --- ✨ 误报标记功能相关的状态 ---
const isMarkingMode = ref(false)

const hasPendingChanges = computed(() => {
	if (!vulnerabilityDetail.value?.vulnerabilities) return false
	return vulnerabilityDetail.value.vulnerabilities.some((item: any) => item._pendingFP || item._pendingRestore)
})

const enterMarkingMode = () => { isMarkingMode.value = true }
const cancelMarking = () => {
	isMarkingMode.value = false
	if (vulnerabilityDetail.value?.vulnerabilities) {
		vulnerabilityDetail.value.vulnerabilities.forEach((item: any) => {
			item._pendingFP = false
			item._pendingRestore = false
		})
	}
}

// ✨ 提交误报并自动归档至【误报知识库】 ✨
const handleSaveFalsePositives = async () => {
	if (!vulnerabilityDetail.value?.vulnerabilities || !currentTaskId.value) return

	const markVulns = vulnerabilityDetail.value.vulnerabilities.filter((item: any) => item._pendingFP)
	const markIds = markVulns.map((item: any) => item.id)
	const restoreIds = vulnerabilityDetail.value.vulnerabilities.filter((item: any) => item._pendingRestore).map((item: any) => item.id)

	try {
		const loadingMsg = ms.loading('正在同步状态并归档...', { duration: 0 })

		// 1. 同步原有的任务/漏洞状态
		await updateFalsePositiveStatus({ markIds, restoreIds, taskId: currentTaskId.value })

		// 2. 将标记为误报的漏洞自动写入【误报知识库】
		if (markVulns.length > 0) {
			if (!kidFalsePositive.value) {
				ms.warning('未能获取到误报知识库，特征未能自动入库！请刷新页面重试。', { duration: 5000 })
			} else {
				for (const vuln of markVulns) {
					try {
						await archiveToKnowledgeBase({
							kid: kidFalsePositive.value,
							title: `[误报] ${vuln.title || '未知漏洞'}`,
							summary: '系统/人工判定为误报的特征规则',
							vulnerabilityType: vuln.category || '未分类', // 对应 vulnerability_type
							language: vuln.language || '未知',            // 对应 language
							severity: vuln.severity || '低',              // 对应 severity
							cvssScore: Number(vuln.cvssScore) || 0,       // 对应 cvss_score
							problemDescription: vuln.description || '',   // 对应 problem_description
							status: 'published',                          // 对应 status
							sourceType: 'manual'                          // 对应 source_type
						})
					} catch (e) { console.error('单条误报入库失败', e) }
				}
			}
		}

		vulnerabilityDetail.value.vulnerabilities.forEach((item: any) => {
			if (item._pendingFP) item.isFalsePositive = true
			if (item._pendingRestore) item.isFalsePositive = false
			item._pendingFP = false
			item._pendingRestore = false
		})

		isMarkingMode.value = false
		loadingMsg.destroy()
		ms.success('操作成功！误报特征已生效并同步至误报知识库。')

		vulnerabilityLoading.value = true
		const res = await getTaskVulnerabilities(currentTaskId.value!)
		if (res?.data) vulnerabilityDetail.value = res.data
		vulnerabilityLoading.value = false
	} catch (error) { ms.error('后端保存失败，请检查网络或权限') }
}

// 模板库相关
const showTemplateModal = ref(false)
const templateLoading = ref(false)
const templateData = ref<any[]>([])
const searchTemplateName = ref('')
const searchTemplateType = ref<string | null>(null)

const templateTypeOptions = [{ label: '文本内容', value: '1' }, { label: 'Word 模板', value: '2' }]
const priorityOptions = [{ label: '低', value: TaskPriority.LOW }, { label: '中', value: TaskPriority.MEDIUM }, { label: '高', value: TaskPriority.HIGH }, { label: '紧急', value: TaskPriority.URGENT }]
const taskTypeOptions = [{ label: '编码规范检查', value: TaskType.CODE_STANDARD_CHECK }, { label: '数据安全审计', value: TaskType.DATA_SECURITY_AUDIT }, { label: '依赖关系分析', value: TaskType.DEPENDENCY_ANALYSIS }, { label: '合规审计', value: TaskType.COMPLIANCE_AUDIT }, { label: '其他', value: TaskType.OTHER }]
const statusOptions = [{ label: '待处理', value: TaskStatus.PENDING }, { label: '进行中', value: TaskStatus.IN_PROGRESS }, { label: '已完成', value: TaskStatus.COMPLETED }, { label: '已取消', value: TaskStatus.CANCELLED }]

const priorityTagType = (p: TaskPriority) => ({ [TaskPriority.LOW]: 'default', [TaskPriority.MEDIUM]: 'info', [TaskPriority.HIGH]: 'warning', [TaskPriority.URGENT]: 'error' }[p] || 'default')
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
	} catch (error) {}
}

const loadTasks = async () => {
	try {
		loading.value = true
		const params: any = { currentPage: pagination.value.page, pageSize: pagination.value.pageSize }
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
				if (task.status === TaskStatus.COMPLETED && [TaskStatus.IN_PROGRESS, TaskStatus.PENDING].includes(prevStatus || '')) ms.success(`任务「${task.title}」已完成`)
				prevTaskStatusMap.value.set(task.id, task.status)
				if (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.PENDING) if (!taskProgressMap.value.has(task.id)) taskProgressMap.value.set(task.id, 0)
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
			if (hasInProgressTasks && enablePolling.value) { startPolling(); startProgressTimer() } else stopPolling()
		} else loadTasksFromLocal()
	} catch (error) { loadTasksFromLocal() } finally { loading.value = false }
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

const handleFilterChange = () => { pagination.value.page = 1; loadTasks() }

const openTemplateModal = () => {
	searchTemplateName.value = ''; searchTemplateType.value = null
	showTemplateModal.value = true; fetchTemplateList()
}

const fetchTemplateList = async () => {
	templateLoading.value = true
	try {
		const res = await fetchSysTemplateList({ pageNum: 1, pageSize: 100, status: '0', templateName: searchTemplateName.value, templateType: searchTemplateType.value })
		templateData.value = res.rows || res.data || []
	} catch (e) { ms.error('获取模板列表失败') } finally { templateLoading.value = false }
}

const handleSelectTemplate = (tpl: any) => {
	const now = new Date().toISOString()
	let fileName = tpl.template_name || '未命名模板', fileUrl = tpl.file_path || '', fileType = '', fileSize = 0
	if (tpl.template_type === '2') {
		if (!tpl.file_path) return ms.warning('该模板未关联文件')
		if (!fileName.endsWith('.docx')) fileName += '.docx'
		fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	} else {
		fileName += '.txt'; fileType = 'text/plain'
		const blob = new Blob([tpl.template_content || ''], { type: 'text/plain' })
		fileUrl = URL.createObjectURL(blob); fileSize = blob.size
	}
	uploadedFiles.value = uploadedFiles.value.filter(f => !f.id.toString().startsWith('tpl_'))
	uploadedFiles.value.push({ id: `tpl_${tpl.template_id}`, name: `[模板] ${fileName}`, url: fileUrl, type: fileType, size: fileSize, uploadTime: now })
	currentTask.value.inputFiles = [...uploadedFiles.value]
	ms.success(`已加载模板：${fileName}`); showTemplateModal.value = false
}

const currentTemplateId = computed(() => { const tplFile = uploadedFiles.value.find(f => f.id && f.id.toString().startsWith('tpl_')); return tplFile ? tplFile.id.toString().replace('tpl_', '') : null })

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
	if (tplId && !uploadedFiles.value.some(f => f.id === `tpl_${tplId}`)) {
		uploadedFiles.value.push({ id: `tpl_${tplId}`, name: `[模板]编号:${tplId}`, url: '', type: 'template', size: 0, uploadTime: '' })
	}
	currentTask.value = { ...task, inputFiles: uploadedFiles.value, projectId: task.projectId || null, id: task.id }
	if (uploadRef.value) uploadRef.value.clear(); showModal.value = true
}

const handleUploadFinish = ({ file, event }: any) => {
	const xhr = event?.target as XMLHttpRequest
	if (xhr) {
		try {
			const res = JSON.parse(xhr.responseText)
			if (res.code === 200 || res.success) {
				const d = res.data || res
				const newFile: TaskFile = { id: d.id || `file_${Date.now()}`, name: file.name, url: d.url || '', size: file.file?.size, type: file.file?.type, uploadTime: new Date().toISOString() }
				if (!uploadedFiles.value.find(f => f.id === newFile.id)) { uploadedFiles.value.push(newFile); currentTask.value.inputFiles = [...uploadedFiles.value] }
				ms.success('文件上传成功')
			} else ms.error('文件上传失败')
		} catch (e) { }
	}
	return file
}

const handleBeforeUpload = () => true
const handleFolderUpload = () => folderUploadInputRef.value?.click()
const handleFolderChange = async (event: Event) => {
	const input = event.target as HTMLInputElement; if (!input.files?.length) return
	isUploadingFolder.value = true
	try {
		const fileArray: File[] = [], paths: string[] = []
		for (let i = 0; i < input.files.length; i++) { fileArray.push(input.files[i]); paths.push(input.files[i].webkitRelativePath || input.files[i].name) }
		const res = await uploadTaskFilesBatch(fileArray, paths)
		if (res?.code === 200) {
			(res.data || []).forEach((d: any) => uploadedFiles.value.push({ id: d.id || `file_${Date.now()}`, name: d.name, url: d.url, size: d.size, type: d.type, uploadTime: new Date().toISOString() }))
			currentTask.value.inputFiles = [...uploadedFiles.value]; ms.success(`成功上传 ${res.data?.length} 个文件`)
		}
	} catch (e) { ms.error('上传失败') } finally { isUploadingFolder.value = false; input.value = '' }
}

const saveTask = async () => {
	if (!currentTask.value.title.trim()) return ms.warning('请输入标题')
	if (!currentTask.value.taskType) return ms.warning('请选择类型')
	const realFiles: TaskFile[] = []
	let selectedTemplateId: string | number | null = null
	uploadedFiles.value.forEach((f) => { if (f.id && f.id.toString().startsWith('tpl_')) selectedTemplateId = f.id.toString().replace('tpl_', ''); else realFiles.push(f) })
	const taskData: any = { ...currentTask.value, inputFiles: realFiles, templateId: selectedTemplateId }
	try {
		const res = isEdit.value && currentTask.value.id ? await updateTask(currentTask.value.id, taskData) : await createTask(taskData)
		if (res?.code === 200) { ms.success(isEdit.value ? '更新成功' : '创建成功'); showModal.value = false; uploadedFiles.value = []; await loadTasks() } else ms.error(res?.msg || '操作失败')
	} catch (e: any) { ms.error('操作失败') }
}

const handleDelete = async (task: Task) => { if(task.id && await deleteTask(task.id)) { ms.success('删除成功'); loadTasks() } }
const handleDownloadFile = async (file: TaskFile) => { if(file.id) await downloadTaskFile(file.id, file.name); else if(file.url) window.open(file.url, '_blank') }

// 进度逻辑
const getTaskProgress = (task: Task) => { if (task.status === TaskStatus.COMPLETED) return 100; if (task.status === TaskStatus.CANCELLED) return 0; return taskProgressMap.value.get(task.id!) || 0 }
const getProgressText = (p: number, s?: TaskStatus) => { if (s === TaskStatus.COMPLETED) return '已完成'; return p < 30 ? '正在分析代码' : p < 70 ? '调用智能体分析' : '生成报告' }
const startProgressTimer = () => {
	if (progressTimer.value) clearInterval(progressTimer.value)
	progressTimer.value = setInterval(() => {
		tasks.value.forEach(t => {
			if (t.id && [TaskStatus.IN_PROGRESS, TaskStatus.PENDING].includes(t.status)) {
				const cur = taskProgressMap.value.get(t.id) || 0
				if (cur < 99) taskProgressMap.value.set(t.id, Number(Math.min(99, cur + Math.random() * 2 + 1).toFixed(1)))
			}
		})
	}, progressInterval.value)
}
const startPolling = () => { if (pollingTimer.value) clearInterval(pollingTimer.value); pollingTimer.value = setInterval(() => loadTasks(), pollingInterval.value) }
const stopPolling = () => { if (pollingTimer.value) clearInterval(pollingTimer.value); stopProgressTimer() }
const handleCancelTask = async (t: Task) => { if(t.id) await cancelTask(t.id); loadTasks() }
const handleRetryTask = async (t: Task) => { if(t.id) await retryTask(t.id); loadTasks() }

const getSeverityClass = (s: string) => ({ 严重: 'critical', 高: 'high', 中: 'medium', 低: 'low' }[s] || 'low')
const getSeverityTagType = (s: string) => ({ 严重: 'error', 高: 'warning', 中: 'info', 低: 'default' }[s] || 'default')

const openVulnerabilityModal = async (task: Task) => {
	if (!task.id) return
	currentTaskId.value = task.id; isFullscreen.value = false; isMarkingMode.value = false
	showVulnerabilityModal.value = true; vulnerabilityLoading.value = true
	try {
		const res = await getTaskVulnerabilities(task.id)
		vulnerabilityDetail.value = res?.data || { taskTitle: task.title, totalCount: 0, vulnerabilities: [] }
	} catch (e) { } finally { vulnerabilityLoading.value = false }
}

const fileMetricsColumns = [
	{ title: '文件名称', key: 'fileName', ellipsis: { tooltip: true } },
	{ title: '质量评分', key: 'score', width: 100, align: 'right' as const, render: (row: any) => { const score = Number(row.score); let color = '#d03050'; if (score >= 90) color = '#18a058'; else if (score >= 60) color = '#f0a020'; return h('span', { style: { color, fontWeight: 'bold' } }, score.toFixed(2)); } },
	{ title: '规范检查', key: 'isPassed', width: 100, align: 'center' as const, render: (row: any) => h(NTag, { type: row.isPassed ? 'success' : 'error', size: 'small', round: true }, { default: () => row.isPassed ? '通过' : '未通过' }) }
];

const columns = [
	{ title: '任务标题', key: 'title', width: 150, ellipsis: { tooltip: true }, render: (row: Task) => h('span', { style: { cursor: 'pointer', color: '#18a058', textDecoration: 'underline' }, onClick: () => openVulnerabilityModal(row) }, row.title) },
	{ title: '任务要求', key: 'description', width: 100, ellipsis: { tooltip: true }, render: (row: Task) => row.description || '-' },
	{ title: '任务类型', key: 'taskType', width: 150, render: (row: Task) => h(NTag, { type: taskTypeTagType(row.taskType) as any, size: 'small' }, { default: () => taskTypeLabel(row.taskType) }) },
	{ title: '优先级', key: 'priority', width: 100, render: (row: Task) => h(NTag, { type: priorityTagType(row.priority) as any, size: 'small' }, { default: () => priorityLabel(row.priority) }) },
	{ title: '状态/进度', key: 'status', width: 100, render: (row: Task) => {
			if (row.status === TaskStatus.COMPLETED) return h(NTag, { type: 'success', size: 'small' }, { default: () => '已完成' })
			if (row.status === TaskStatus.CANCELLED) return h(NTag, { type: 'error', size: 'small' }, { default: () => '已取消' })
			const p = Number(getTaskProgress(row).toFixed(1))
			return h('div', { style: 'display: flex; flex-direction: column; gap: 4px; width: 100%' }, [h(NProgress, { percentage: p, height: 8, showIndicator: true }), h('span', { style: 'font-size: 12px; color: #666' }, `${getProgressText(p, row.status)} ${p}%`)])
		}},
	{ title: '漏洞总数', key: 'vulnerability_num', width: 100, render: (row: Task) => h('span', { style: { color: '#D03050', fontWeight: '800' } }, taskVulnerabilityCountMap.value.get(row.id!) || 0) },
	{ title: '上传文件', key: 'inputFiles', width: 150, render: (row: Task) => {
			const files = row.inputFiles || [], displayFiles = files.slice(0, 5)
			const tags = displayFiles.map(f => h(NTag, { size: 'small', type: 'info' }, { default: () => f.name }))
			if (files.length > 5) tags.push(h(NTag, { size: 'small', type: 'default', style: 'border-style: dashed; color: #666;' }, { default: () => `共 ${files.length} 个文件` }))
			return h(NSpace, { size: 'small', vertical: true }, { default: () => tags })
		}
	},
	{ title: '返回文件', key: 'outputFiles', width: 150, render: (row: Task) => {
			const files = row.outputFiles || [], displayFiles = files.slice(0, 5)
			const btns = displayFiles.map(f => h(NButton, { size: 'small', type: 'primary', onClick: () => handleDownloadFile(f) }, { icon: () => h(NIcon, null, { default: () => h(DownloadOutline) }), default: () => '下载' }))
			if (files.length > 5) btns.push(h(NTag, { size: 'small', type: 'default', style: 'border-style: dashed; color: #666;' }, { default: () => `共 ${files.length} 个文件` }))
			return h(NSpace, { size: 'small', vertical: true }, { default: () => btns })
		}
	},
	{ title: '创建时间', key: 'createdAt', width: 150, render: (row: Task) => row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' },
	{ title: '操作', key: 'actions', width: 320, render: (row: Task) => {
			const btns = [h(NButton, { size: 'small', type: 'primary', onClick: () => openEditModal(row) }, { icon: () => h(NIcon, null, { default: () => h(CreateOutline) }), default: () => '编辑' })]
			if (row.status === TaskStatus.IN_PROGRESS || row.status === TaskStatus.PENDING) btns.push(h(NPopconfirm, { onPositiveClick: () => handleCancelTask(row) }, { trigger: () => h(NButton, { size: 'small', type: 'warning' }, { icon: () => h(NIcon, null, { default: () => h(StopOutline) }), default: () => '中断' }), default: () => '确定中断？' }))
			else btns.push(h(NButton, { size: 'small', type: 'info', onClick: () => handleRetryTask(row) }, { icon: () => h(NIcon, null, { default: () => h(RefreshOutline) }), default: () => '重试' }))
			btns.push(h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, { trigger: () => h(NButton, { size: 'small', type: 'error' }, { icon: () => h(NIcon, null, { default: () => h(TrashOutline) }), default: () => '删除' }), default: () => '确定删除？' }))
			return h(NSpace, { size: 'small' }, { default: () => btns })
		}}
]

const goBackToProject = () => { filterProjectId.value = null; router.back() }

onMounted(async () => {
	const queryProjectId = route.query.projectId
	if (queryProjectId) filterProjectId.value = String(queryProjectId)

	// 🚀 初始化检测与绑定双知识库
	await initKnowledgeBases()

	await loadProjects()
	await loadTasks()
})
onUnmounted(() => stopPolling())

// --- ✨ 知识库沉淀表单状态 (人工推荐方案) ---
const showArchiveDrawer = ref(false)
const currentVuln = ref<any>(null)

// 结构化的归档表单数据
const archiveForm = ref({
	kid: '',
	title: '',
	summary: '',
	content: '',
	cvssScore: '4.3',
	cvssLevel: '中',
	severity: '高',
	cwe: '20: 不正确的输入验证',
	language: 'JavaScript'
})

// ✨ 打开【推荐方案】抽屉
const openArchiveDrawer = (vuln: any) => {
	currentVuln.value = vuln
	showArchiveDrawer.value = true

	archiveForm.value = {
		kid: kidRecommendation.value, // 动态绑定推荐库ID
		title: vuln.title || '未知漏洞',
		summary: vuln.summary || '',
		content: vuln.description || '',
		cvssScore: vuln.cvssScore || '4.3',
		cvssLevel: vuln.cvssLevel || '中',
		severity: vuln.severity || '高',
		cwe: vuln.category || '未分类漏洞',
		language: vuln.language || 'JavaScript'
	}
}

// ✨ 提交表单归档至【推荐方案知识库】
const handleArchiveSolution = async () => {
	if (!currentVuln.value) return

	if (!archiveForm.value.kid) {
		ms.warning('系统正在初始化知识库或初始化失败，请稍后再试或刷新页面！')
		return
	}

	try {
		const loadingMsg = ms.loading('正在按标准格式归档至企业知识库...', { duration: 0 })

		// 严格按照 knowledge_item 表的驼峰命名对应字段
		const payload = {
			kid: archiveForm.value.kid,
			title: archiveForm.value.title,
			summary: archiveForm.value.summary,
			vulnerabilityType: archiveForm.value.cwe, // 对应 vulnerability_type
			language: archiveForm.value.language,     // 对应 language
			severity: archiveForm.value.severity,     // 对应 severity
			cvssScore: Number(archiveForm.value.cvssScore) || 0, // 对应 cvss_score，转为数字

			// 数据库没有 content，我们将其映射到问题描述或修复方案中
			problemDescription: archiveForm.value.content, // 对应 problem_description
			fixSolution: archiveForm.value.content,        // 对应 fix_solution (既然是推荐方案，建议传这个)

			// 补充一些数据库需要的默认状态字段
			status: 'published',      // 对应 status
			sourceType: 'manual'      // 对应 source_type (手动录入)
		}

		const res = await archiveToKnowledgeBase(payload)

		loadingMsg.destroy()
		if (res && (res.code === 200 || res.success)) {
			ms.success('🎉 漏洞特征已结构化沉淀至【推荐方案知识库】！')
			showArchiveDrawer.value = false
		} else {
			ms.error(res?.msg || '归档失败，后端返回异常')
		}
	} catch (error) {
		ms.error('请求失败，请检查网络或联系后端研发')
	}
}

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

							<div class="relative flex items-center justify-center mt-6 mb-3">
								<div class="absolute w-full h-px bg-gray-200 dark:bg-gray-700"></div>
								<span class="bg-white dark:bg-[#18181c] px-4 z-10 text-gray-500 text-sm">漏洞列表</span>
								<div class="absolute right-0 z-10 bg-white dark:bg-[#18181c] pl-4 flex gap-2">
									<NButton size="small" color="#ff8a8a" v-if="!isMarkingMode" @click="enterMarkingMode">标记误报</NButton>
									<NButton size="small" v-if="isMarkingMode" @click="cancelMarking">取消</NButton>

									<NButton
										size="small"
										type="primary"
										v-show="isMarkingMode || hasPendingChanges"
										:disabled="!hasPendingChanges"
										@click="handleSaveFalsePositives"
									>
										确认标记并归档规则
									</NButton>
								</div>
							</div>

							<div class="border border-gray-200 dark:border-gray-700 rounded-md bg-[#fafafa] dark:bg-[#141414]">
								<NScrollbar :style="{ maxHeight: isFullscreen ? 'calc(100vh - 380px)' : '250px' }" class="p-2">
									<div class="vulnerability-list">
										<div
											v-for="(vuln, index) in vulnerabilityDetail.vulnerabilities"
											:key="vuln.id || index"
											class="flex items-stretch gap-3 transition-all duration-300 mb-1"
										>
											<div v-if="isMarkingMode && !vuln.isFalsePositive" class="flex items-center pt-3 pl-2">
												<NCheckbox v-model:checked="vuln._pendingFP" size="large" />
											</div>

											<div
												:class="[
													'vulnerability-item', `severity-${getSeverityClass(vuln.severity)}`, 'flex-1 m-0 transition-all duration-300',
													vuln.isFalsePositive && !vuln._pendingRestore ? 'opacity-50 grayscale bg-gray-100 dark:bg-gray-800' : '',
													vuln._pendingRestore ? 'border-blue-400 opacity-100 grayscale-0' : ''
												]"
											>
												<div class="vulnerability-header">
													<div class="flex items-center gap-2">
														<NTag :type="getSeverityTagType(vuln.severity)" size="small">{{ vuln.severity }}</NTag>
														<NText
															strong
															style="font-size: 14px"
															:class="{'line-through text-gray-400': vuln.isFalsePositive && !vuln._pendingRestore}"
														>
															{{ vuln.title }}
														</NText>
														<NTag v-if="vuln.isFalsePositive" type="default" size="small" class="ml-2">
															已标记误报
														</NTag>
													</div>

													<div class="flex items-center gap-2">
														<NText v-if="vuln.category" depth="3" style="font-size: 12px">{{ vuln.category }}</NText>

														<NButton
															v-if="vuln.isFalsePositive"
															size="tiny"
															:type="vuln._pendingRestore ? 'default' : 'warning'"
															strong
															@click="vuln._pendingRestore = !vuln._pendingRestore"
														>
															{{ vuln._pendingRestore ? '取消恢复' : '恢复漏洞' }}
														</NButton>

														<NButton
															size="tiny"
															color="#6366f1"
															class="ai-fix-btn"
															@click.stop="openArchiveDrawer(vuln)"
														>
															<template #icon><NIcon><DocumentTextOutline /></NIcon></template>
															编辑并归档
														</NButton>
													</div>
												</div>
												<div class="vulnerability-content">
													<div class="vulnerability-section"><NText strong style="font-size: 13px; color: #666">漏洞描述：</NText><div class="vulnerability-text"><NText style="font-size: 13px">{{ vuln.description }}</NText></div></div>
													<div v-if="vuln.filePath" class="vulnerability-section"><NText strong style="font-size: 13px; color: #666">文件位置：</NText><div class="vulnerability-text"><NText code style="font-size: 12px">{{ vuln.filePath }}{{ vuln.lineNumber ? `:${vuln.lineNumber}` : '' }}</NText></div></div>
													<div v-if="vuln.codeSnippet" class="vulnerability-section"><NText strong style="font-size: 13px; color: #666">相关代码：</NText><div class="vulnerability-text"><pre class="code-snippet"><code>{{ vuln.codeSnippet }}</code></pre></div></div>
												</div>
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

			<NDrawer v-model:show="showArchiveDrawer" :width="700" placement="right">
				<NDrawerContent title="📚 沉淀至知识库" closable>
					<NTabs type="segment" animated>

						<NTabPane name="edit" tab="📝 内容审核与编辑">
							<NForm :model="archiveForm" label-placement="top" class="mt-4">

								<NFormItem label="归档目标">
									<NTag type="success" size="large">
										🚀 推荐方案知识库
									</NTag>
								</NFormItem>

								<NFormItem label="漏洞标题">
									<NInput v-model:value="archiveForm.title" />
								</NFormItem>
								<NFormItem label="漏洞摘要 (Summary)">
									<NInput v-model:value="archiveForm.summary" type="textarea" :autosize="{ minRows: 2 }" placeholder="请提炼该漏洞的核心摘要..." />
								</NFormItem>
								<NFormItem label="漏洞正文描述 (Content)">
									<NInput v-model:value="archiveForm.content" type="textarea" :autosize="{ minRows: 3 }" />
								</NFormItem>

								<NGrid :cols="4" :x-gap="12">
									<NGridItem>
										<NFormItem label="CVSS分数">
											<NInput v-model:value="archiveForm.cvssScore" />
										</NFormItem>
									</NGridItem>
									<NGridItem>
										<NFormItem label="严重等级">
											<NSelect v-model:value="archiveForm.severity" :options="[{label:'严重',value:'严重'},{label:'高',value:'高'},{label:'中',value:'中'},{label:'低',value:'低'}]" />
										</NFormItem>
									</NGridItem>
									<NGridItem>
										<NFormItem label="CWE分类">
											<NInput v-model:value="archiveForm.cwe" />
										</NFormItem>
									</NGridItem>
									<NGridItem>
										<NFormItem label="语言">
											<NInput v-model:value="archiveForm.language" />
										</NFormItem>
									</NGridItem>
								</NGrid>
							</NForm>
						</NTabPane>

						<NTabPane name="preview" tab="👀 知识库样式预览">
							<div class="kb-preview-container mt-4">
								<div class="kb-card">
									<div class="kb-header flex items-center mb-4">
										<div class="kb-checkbox mr-3"></div>
										<div class="kb-vertical-line"></div>
										<div class="kb-title font-bold text-[16px]">{{ archiveForm.title }}</div>
									</div>

									<div class="kb-content text-[13px] text-[#333] space-y-3 mb-4">
										<div class="leading-relaxed">
											<span class="text-[#666]">摘要：</span>{{ archiveForm.summary || '暂无摘要' }}
										</div>
										<div class="leading-relaxed">
											<span class="text-[#666]">问题描述：</span>{{ archiveForm.content || '暂无描述' }}
										</div>
									</div>

									<div class="kb-tags flex gap-2 mb-6">
										<span class="kb-tag kb-tag-orange">CVSS {{ archiveForm.cvssScore }} {{ archiveForm.cvssLevel }}</span>
										<span class="kb-tag kb-tag-red">认定 {{ archiveForm.severity }}</span>
										<span class="kb-tag kb-tag-gray">{{ archiveForm.cwe }}</span>
										<span class="kb-tag kb-tag-gray">{{ archiveForm.language }}</span>
									</div>

									<div class="kb-meta flex items-center gap-5 text-[#999] text-[12px] border-t border-gray-100 pt-3">
										<div class="flex items-center gap-1"><NIcon><AddCircleOutline/></NIcon> 创建于 刚刚</div>
										<div class="flex items-center gap-1 text-[#e1a533]"><NIcon><TimeOutline/></NIcon> 更新于 刚刚</div>
										<div class="flex items-center gap-1 text-[#1890ff] cursor-pointer"><NIcon><CodeWorkingOutline/></NIcon> 查看片段</div>
									</div>
								</div>
							</div>
						</NTabPane>
					</NTabs>

					<template #footer>
						<div class="flex justify-end w-full">
							<NButton type="primary" @click="handleArchiveSolution">
								<template #icon><NIcon><CheckmarkCircleOutline /></NIcon></template>
								确认无误并入库
							</NButton>
						</div>
					</template>
				</NDrawerContent>
			</NDrawer>
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

/* --- AI 按钮专属样式 --- */
.ai-fix-btn {
	box-shadow: 0 2px 4px rgba(99, 102, 241, 0.15);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.ai-fix-btn:hover {
	box-shadow: 0 4px 10px rgba(99, 102, 241, 0.4);
	transform: translateY(-1px);
}

/* --- 知识库预览卡片样式 --- */
.kb-preview-container {
	background-color: #f9f9fa;
	padding: 20px;
	border-radius: 8px;
	border: 1px solid #e5e7eb;
}

.dark .kb-preview-container { background-color: #1e1e20; border-color: #333; }

.kb-card {
	background-color: #ffffff;
	padding: 20px 24px;
	border-radius: 4px;
	box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.dark .kb-card { background-color: #242428; }

.kb-checkbox {
	width: 14px;
	height: 14px;
	border: 1px solid #d9d9d9;
	border-radius: 2px;
}

.kb-vertical-line {
	width: 3px;
	height: 18px;
	background-color: #ff4d4f;
	margin-right: 10px;
	border-radius: 1px;
}

.kb-tag {
	padding: 2px 8px;
	border-radius: 2px;
	font-size: 12px;
	line-height: 20px;
}

.kb-tag-orange { background-color: #fca130; color: #fff; }
.kb-tag-red { background-color: #ff4d4f; color: #fff; }
.kb-tag-gray { background-color: #f0f0f0; color: #555; border: 1px solid #e8e8e8;}
.dark .kb-tag-gray { background-color: #333; color: #ccc; border-color: #444; }
</style>
