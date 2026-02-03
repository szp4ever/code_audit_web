<script setup lang='ts'>
import { ref, onMounted, onUnmounted, h } from 'vue'
import {
	NButton,
	NInput,
	NSelect,
	NDataTable,
	NModal,
	NForm,
	NFormItem,
	NTag,
	NEmpty,
	NMessageProvider,
	useMessage,
	NSpace,
	NCard,
	NGrid,
	NGridItem,
	NIcon,
	NPopconfirm,
	NUpload,
	UploadFileInfo,
	UploadInst,
	NText,
	NDivider,
	NSpin,
	NScrollbar,
	NProgress,
	DataTableColumns
} from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { createTask, fetchTaskList, updateTask, deleteTask, downloadTaskFile, getTaskFileUploadUrl, uploadTaskFilesBatch, Task, TaskPriority, TaskStatus, TaskType, TaskFile, getTaskVulnerabilities, TaskVulnerabilityDetail, cancelTask, retryTask, fetchSysTemplateList } from '@/api/task'
import { fetchProjectList, Project } from '@/api/project'
import { AddOutline, TrashOutline, CreateOutline, ArrowBackOutline, StopOutline, RefreshOutline, DocumentTextOutline, CheckmarkCircleOutline, SearchOutline } from '@vicons/ionicons5'
import { getToken } from '@/store/modules/auth/helper'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const ms = useMessage()
const token = getToken()
const headers = { Authorization: `Bearer ${token}` }

// --- 状态定义 ---

// 项目相关
const projects = ref<Project[]>([])
const projectOptions = ref<Array<{ label: string; value: string | number }>>([])
const filterProjectId = ref<string | number | null>(null)
const selectedProjectId = ref<string | number | null>(null)

// 文件上传相关
const uploadRef = ref<UploadInst | null>(null)
const folderUploadInputRef = ref<HTMLInputElement | null>(null)
const uploadedFiles = ref<TaskFile[]>([])
const uploadAction = getTaskFileUploadUrl()
const isUploadingFolder = ref(false)

// 任务列表相关
const tasks = ref<Task[]>([])
const loading = ref(false)
const total = ref(0)
const pollingTimer = ref<NodeJS.Timeout | null>(null)
const progressTimer = ref<NodeJS.Timeout | null>(null)
const pollingInterval = ref(5000)
const progressInterval = ref(1000)
const enablePolling = ref(true)

// 本地维护的任务进度与漏洞统计
const taskProgressMap = ref<Map<string | number, number>>(new Map())
const taskVulnerabilityCountMap = ref<Map<string | number, number>>(new Map())

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

// 创建/编辑任务模态框
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

// 漏洞详情弹窗相关
const showVulnerabilityModal = ref(false)
const vulnerabilityLoading = ref(false)
const vulnerabilityDetail = ref<TaskVulnerabilityDetail | null>(null)
const currentTaskId = ref<number | string | null>(null)

// --- 模板库相关 ---
const showTemplateModal = ref(false)
const templateLoading = ref(false)
const templateData = ref<any[]>([])

// 模板筛选条件
const searchTemplateName = ref('')
const searchTemplateType = ref<string | null>(null)

// 模板类型选项
const templateTypeOptions = [
	{ label: '文本内容', value: '1' },
	{ label: 'Word 模板', value: '2' }
]

// 选项常量
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

// --- 辅助函数 ---
const priorityTagType = (priority: TaskPriority) => {
	const map: Record<TaskPriority, string> = {
		[TaskPriority.LOW]: 'default', [TaskPriority.MEDIUM]: 'info',
		[TaskPriority.HIGH]: 'warning', [TaskPriority.URGENT]: 'error'
	}
	return map[priority] || 'default'
}

const statusTagType = (status: TaskStatus) => {
	const map: Record<TaskStatus, string> = {
		[TaskStatus.PENDING]: 'default', [TaskStatus.IN_PROGRESS]: 'info',
		[TaskStatus.COMPLETED]: 'success', [TaskStatus.CANCELLED]: 'error'
	}
	return map[status] || 'default'
}

const statusLabel = (status: TaskStatus) => {
	const map: Record<TaskStatus, string> = {
		[TaskStatus.PENDING]: '待处理', [TaskStatus.IN_PROGRESS]: '进行中',
		[TaskStatus.COMPLETED]: '已完成', [TaskStatus.CANCELLED]: '已取消'
	}
	return map[status] || status
}

const priorityLabel = (priority: TaskPriority) => {
	const map: Record<TaskPriority, string> = {
		[TaskPriority.LOW]: '低', [TaskPriority.MEDIUM]: '中',
		[TaskPriority.HIGH]: '高', [TaskPriority.URGENT]: '紧急'
	}
	return map[priority] || priority
}

const taskTypeLabel = (taskType: TaskType) => {
	const map: Record<TaskType, string> = {
		[TaskType.CODE_STANDARD_CHECK]: '编码规范检查', [TaskType.DATA_SECURITY_AUDIT]: '数据安全审计',
		[TaskType.DEPENDENCY_ANALYSIS]: '依赖关系分析', [TaskType.COMPLIANCE_AUDIT]: '合规审计',
		[TaskType.OTHER]: '其他'
	}
	return map[taskType] || taskType
}

const taskTypeTagType = (taskType: TaskType) => {
	const map: Record<TaskType, string> = {
		[TaskType.CODE_STANDARD_CHECK]: 'info', [TaskType.DATA_SECURITY_AUDIT]: 'warning',
		[TaskType.DEPENDENCY_ANALYSIS]: 'success', [TaskType.COMPLIANCE_AUDIT]: 'error',
		[TaskType.OTHER]: 'default'
	}
	return map[taskType] || 'default'
}

const getSeverityClass = (severity: string) => {
	const map: Record<string, string> = { '严重': 'critical', '高': 'high', '中': 'medium', '低': 'low' }
	return map[severity] || 'low'
}

const getSeverityTagType = (severity: string) => {
	const map: Record<string, string> = { '严重': 'error', '高': 'warning', '中': 'info', '低': 'default' }
	return map[severity] || 'default'
}

// --- 核心逻辑 ---

// 获取漏洞数量（带缓存）
const getTaskVulnerabilityCount = async (taskId: string | number | null) => {
	if (!taskId) return 0
	if (taskVulnerabilityCountMap.value.has(taskId)) return taskVulnerabilityCountMap.value.get(taskId)!
	try {
		const response = await getTaskVulnerabilities(taskId)
		const count = response?.code === 200 ? (response.data?.totalCount || 0) : 0
		taskVulnerabilityCountMap.value.set(taskId, count)
		return count
	} catch (error) {
		taskVulnerabilityCountMap.value.set(taskId, 0)
		return 0
	}
}

// 加载项目
const loadProjects = async () => {
	try {
		const response = await fetchProjectList({ currentPage: 1, pageSize: 1000 })
		if (response && response.code === 200) {
			let list: Project[] = []
			if (Array.isArray(response.data)) list = response.data
			else if (response.data?.rows) list = response.data.rows
			else if (response.data?.list) list = response.data.list
			projects.value = list
			projectOptions.value = list.map(p => ({ label: p.name, value: p.id! }))
		}
	} catch (error) { console.error(error) }
}

// 加载任务
const loadTasks = async () => {
	try {
		loading.value = true
		const params: any = {
			currentPage: pagination.value.page,
			pageSize: pagination.value.pageSize,
			...(filterStatus.value && { status: filterStatus.value }),
			...(filterPriority.value && { priority: filterPriority.value }),
			...(filterTaskType.value && { taskType: filterTaskType.value }),
			...(filterProjectId.value && { projectId: filterProjectId.value })
		}

		const response = await fetchTaskList(params)

		if (response && (response.code === 200 || response.success)) {
			let taskList: Task[] = []
			if (Array.isArray(response.data)) taskList = response.data
			else if (response.data?.rows) taskList = response.data.rows
			else if (response.rows) taskList = response.rows

			if (searchKeyword.value) {
				const keyword = searchKeyword.value.toLowerCase()
				taskList = taskList.filter(t => t.title.toLowerCase().includes(keyword))
			}

			taskList.forEach(task => {
				if (task.id && (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.PENDING)) {
					if (!taskProgressMap.value.has(task.id)) taskProgressMap.value.set(task.id, 0)
				}
			})

			tasks.value = taskList
			total.value = response.data?.total || response.total || taskList.length

			taskVulnerabilityCountMap.value.clear()
			taskList.forEach(t => getTaskVulnerabilityCount(t.id).catch(e => console.warn(e)))

			const hasInProgress = taskList.some(t => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.PENDING)
			if (!hasInProgress && pollingTimer.value) {
				stopPolling()
			} else if (hasInProgress && !pollingTimer.value && enablePolling.value) {
				startPolling()
				startProgressTimer()
			} else if (hasInProgress && !progressTimer.value) {
				startProgressTimer()
			}
		} else {
			loadTasksFromLocal()
		}
	} catch (error) {
		loadTasksFromLocal()
	} finally {
		loading.value = false
	}
}

const loadTasksFromLocal = () => {
	try {
		const local = localStorage.getItem('tasks')
		if (local) {
			const list = JSON.parse(local)
			tasks.value = list
			total.value = list.length
		}
	} catch (e) { console.error(e) }
}
const saveTasksToLocal = (list: Task[]) => localStorage.setItem('tasks', JSON.stringify(list))

// 模态框操作
const openCreateModal = () => {
	isEdit.value = false
	uploadedFiles.value = []
	currentTask.value = {
		title: '',
		description: '',
		priority: TaskPriority.MEDIUM,
		taskType: TaskType.OTHER,
		projectId: filterProjectId.value || selectedProjectId.value || null,
		tags: [],
		inputFiles: []
	}
	uploadRef.value?.clear()
	showModal.value = true
}

// [修改] 打开编辑模态框
const openEditModal = async (task: Task) => {
	isEdit.value = true
	// 1. 加载普通文件
	uploadedFiles.value = task.inputFiles ? JSON.parse(JSON.stringify(task.inputFiles)) : []

	// 2. [核心修改] 回显已选模板 (如果任务有关联模板ID)
	// 注意：后端TaskVO如果有templateId字段，我们需要手动构造一个Tag显示出来
	// 假设 task.templateId 存在
	if ((task as any).templateId) { // 这里用 as any 规避类型检查，或者您在 Task 接口加了 templateId
		const tplId = (task as any).templateId
		// 构造一个虚拟文件对象用于显示
		const tplFile: TaskFile = {
			id: `tpl_${tplId}`,
			name: `已选模板 (ID: ${tplId})`, // 暂时只显示ID，因为列表接口可能没返回模板名称
			url: '',
			type: 'template',
			size: 0,
			uploadTime: ''
		}
		// 避免重复添加
		if (!uploadedFiles.value.some(f => f.id === tplFile.id)) {
			uploadedFiles.value.push(tplFile)
		}
	}

	currentTask.value = { ...task, inputFiles: uploadedFiles.value }
	uploadRef.value?.clear()
	showModal.value = true
}

// 文件上传
const handleUploadFinish = ({ file, event }: { file: UploadFileInfo; event?: ProgressEvent }) => {
	const xhr = event?.target as XMLHttpRequest
	if (xhr) {
		try {
			const res = JSON.parse(xhr.responseText)
			if (res.code === 200 || res.success) {
				const d = res.data || res

				// [修改] 生成后端能接受的时间格式 yyyy-MM-dd HH:mm:ss
				const now = new Date();
				const timeStr = now.getFullYear() + "-" +
					String(now.getMonth() + 1).padStart(2, '0') + "-" +
					String(now.getDate()).padStart(2, '0') + " " +
					String(now.getHours()).padStart(2, '0') + ":" +
					String(now.getMinutes()).padStart(2, '0') + ":" +
					String(now.getSeconds()).padStart(2, '0');

				const newFile: TaskFile = {
					id: d.id || `file_${Date.now()}`,
					name: file.name,
					url: d.url || '',
					size: file.file?.size,
					type: file.file?.type,
					uploadTime: timeStr // 使用格式化后的时间
				}
				if (!uploadedFiles.value.find(f => f.id === newFile.id && f.name === newFile.name)) {
					uploadedFiles.value.push(newFile)
					currentTask.value.inputFiles = [...uploadedFiles.value]
				}
				ms.success('上传成功')
			}
		} catch (e) {
			ms.warning('上传响应解析失败')
		}
	}
	return file
}

const handleFolderUpload = () => folderUploadInputRef.value?.click()
const handleFolderChange = async (event: Event) => {
	const input = event.target as HTMLInputElement
	const files = input.files
	if (!files?.length) return
	isUploadingFolder.value = true
	try {
		const fileArray = Array.from(files)
		const paths = fileArray.map(f => f.webkitRelativePath || f.name)
		const res = await uploadTaskFilesBatch(fileArray, paths)
		if (res?.code === 200) {
			const list = res.data || []

			// 时间格式化 helper
			const now = new Date();
			const timeStr = now.getFullYear() + "-" +
				String(now.getMonth() + 1).padStart(2, '0') + "-" +
				String(now.getDate()).padStart(2, '0') + " " +
				String(now.getHours()).padStart(2, '0') + ":" +
				String(now.getMinutes()).padStart(2, '0') + ":" +
				String(now.getSeconds()).padStart(2, '0');

			list.forEach((d: any) => {
				const newFile: TaskFile = {
					id: d.id || `file_${Date.now()}_${Math.random()}`,
					name: d.name,
					url: d.url,
					size: d.size,
					type: d.type,
					uploadTime: timeStr
				}
				if (!uploadedFiles.value.find(f => f.id === newFile.id && f.name === newFile.name)) {
					uploadedFiles.value.push(newFile)
				}
			})
			currentTask.value.inputFiles = [...uploadedFiles.value]
			ms.success(`上传 ${list.length} 个文件`)
		}
	} catch (e: any) { ms.error(e.message || '上传失败') }
	finally {
		isUploadingFolder.value = false
		input.value = ''
	}
}

// --- 模板库逻辑 ---
const openTemplateModal = async () => {
	searchTemplateName.value = ''
	searchTemplateType.value = null
	showTemplateModal.value = true
	await fetchTemplateList()
}

const templateColumns: DataTableColumns<any> = [
	{
		title: '模板名称',
		key: 'template_name',
		width: 200,
		ellipsis: { tooltip: true }
	},
	{
		title: '类型',
		key: 'template_type',
		width: 100,
		render: (row) => {
			const isWord = row.template_type === '2'
			return h(NTag, { size: 'small', bordered: false, type: isWord ? 'success' : 'info' }, { default: () => isWord ? 'Word 模板' : '文本内容' })
		}
	},
	{
		title: '描述',
		key: 'remark',
		ellipsis: { tooltip: true }
	},
	{
		title: '操作',
		key: 'actions',
		width: 100,
		render(row) {
			return h(NButton, {
				size: 'small', type: 'primary', dashed: true,
				onClick: () => handleSelectTemplate(row)
			}, { default: () => '选择', icon: () => h(NIcon, null, { default: () => h(CheckmarkCircleOutline) }) })
		}
	}
]

const fetchTemplateList = async () => {
	templateLoading.value = true
	try {
		const params: any = {
			pageNum: 1,
			pageSize: 100,
			status: '0'
		}
		if (searchTemplateName.value) {
			params.templateName = searchTemplateName.value
		}
		if (searchTemplateType.value) {
			params.templateType = searchTemplateType.value
		}

		const res = await fetchSysTemplateList(params)
		if (res && (res.code === 200 || res.rows)) {
			templateData.value = res.rows || res.data || []
		}
	} catch (error) {
		ms.error('获取模板失败')
	} finally {
		templateLoading.value = false
	}
}

// [修改] 选择模板处理 (自动关闭弹窗 + 替换旧模板)
const handleSelectTemplate = (tpl: any) => {
	let fileName = tpl.template_name || '未命名模板' // 防止 name 为空
	let fileUrl = ''
	let fileSize = 0
	let fileType = ''

	// 格式化当前时间
	const now = new Date();
	const timeStr = now.getFullYear() + "-" +
		String(now.getMonth() + 1).padStart(2, '0') + "-" +
		String(now.getDate()).padStart(2, '0') + " " +
		String(now.getHours()).padStart(2, '0') + ":" +
		String(now.getMinutes()).padStart(2, '0') + ":" +
		String(now.getSeconds()).padStart(2, '0');

	// Word 模板
	if (tpl.template_type === '2') {
		if (!tpl.file_path) {
			ms.warning('该模板未上传文件')
			return
		}
		if (!fileName.endsWith('.docx') && !fileName.endsWith('.doc')) {
			fileName += '.docx'
		}
		fileUrl = tpl.file_path
		fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	}
	// 文本内容
	else if (tpl.template_type === '1') {
		if (!tpl.template_content) {
			ms.warning('模板内容为空')
			return
		}
		fileName += '.txt'
		const blob = new Blob([tpl.template_content], { type: 'text/plain' })
		fileUrl = URL.createObjectURL(blob)
		fileSize = blob.size
		fileType = 'text/plain'
	}

	// [新增] 移除列表中已存在的旧模板（实现“更换”逻辑）
	uploadedFiles.value = uploadedFiles.value.filter(f => !f.id.toString().startsWith('tpl_'))

	const newFile: TaskFile = {
		id: `tpl_${tpl.template_id}`,
		name: fileName,
		url: fileUrl,
		type: fileType,
		size: fileSize,
		uploadTime: timeStr
	}

	// 添加新模板
	uploadedFiles.value.push(newFile)
	currentTask.value.inputFiles = [...uploadedFiles.value]

	ms.success(`已选择模板: ${fileName}`)

	// [新增] 自动关闭弹窗
	showTemplateModal.value = false
}

// 保存任务
const saveTask = async () => {
	if (!currentTask.value.title.trim() || !currentTask.value.taskType) {
		ms.warning('请填写必填项')
		return
	}

	// 分离真实文件和模板ID
	const realFiles: TaskFile[] = []
	let selectedTemplateId: string | number | undefined = undefined

	uploadedFiles.value.forEach(file => {
		// 检查是否是模板 (ID 以 tpl_ 开头)
		if (file.id && file.id.toString().startsWith('tpl_')) {
			selectedTemplateId = file.id.toString().replace('tpl_', '')
		} else {
			realFiles.push(file)
		}
	})

	const data: Task = {
		...currentTask.value,
		inputFiles: realFiles,
		templateId: selectedTemplateId
	}

	try {
		if (isEdit.value && currentTask.value.id) {
			await updateTask(currentTask.value.id, data)
			ms.success('更新成功')
		} else {
			await createTask(data)
			ms.success('创建成功')
		}
		showModal.value = false
		await loadTasks()
	} catch (e) {
		// 本地 fallback 演示逻辑
		const local = JSON.parse(localStorage.getItem('tasks') || '[]')
		local.unshift({ ...currentTask.value, id: Date.now().toString(), status: TaskStatus.PENDING, createdAt: new Date().toISOString() })
		saveTasksToLocal(local)
		showModal.value = false
		await loadTasks()
		ms.success('操作成功(本地)')
	}
}

// 删除、中断、重试... (以下逻辑保持不变)
const handleDelete = async (task: Task) => {
	if (!task.id) return
	try {
		await deleteTask(task.id)
		ms.success('删除成功')
	} catch (e) {
		const local = JSON.parse(localStorage.getItem('tasks') || '[]').filter((t: any) => t.id !== task.id)
		saveTasksToLocal(local)
		ms.success('删除成功(本地)')
	}
	await loadTasks()
}

const handleCancelTask = async (task: Task) => {
	if (task.id) { await cancelTask(task.id); await loadTasks(); ms.success('已中断') }
}

const handleRetryTask = async (task: Task) => {
	if (task.id) { await retryTask(task.id); await loadTasks(); ms.success('已重试') }
}

const handleDownloadFile = async (file: TaskFile) => {
	try {
		if (file.id) await downloadTaskFile(file.id, file.name)
		else if (file.url) window.open(file.url, '_blank')
		ms.success('开始下载')
	} catch (e) { ms.error('下载失败') }
}

const openVulnerabilityModal = async (task: Task) => {
	if (!task.id) return
	currentTaskId.value = task.id
	showVulnerabilityModal.value = true
	vulnerabilityLoading.value = true
	try {
		const res = await getTaskVulnerabilities(task.id)
		if (res && res.code === 200) {
			vulnerabilityDetail.value = res.data || res
		} else {
			vulnerabilityDetail.value = { taskId: task.id, taskTitle: task.title, totalCount: 0, vulnerabilities: [] }
		}
	} catch (e) {
		vulnerabilityDetail.value = { taskId: task.id, taskTitle: task.title, totalCount: 0, vulnerabilities: [] }
	} finally {
		vulnerabilityLoading.value = false
	}
}

const getTaskProgress = (task: Task) => {
	if (task.status === TaskStatus.COMPLETED) return 100
	if (task.status === TaskStatus.CANCELLED) return 0
	return (task.id && taskProgressMap.value.get(task.id)) || 0
}

const startProgressTimer = () => {
	stopProgressTimer()
	progressTimer.value = setInterval(() => {
		tasks.value.forEach(t => {
			if (t.id && (t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.PENDING)) {
				const c = taskProgressMap.value.get(t.id) || 0
				if (c < 99) taskProgressMap.value.set(t.id, Math.min(99, c + Math.random() * 2 + 1))
			}
		})
	}, progressInterval.value)
}
const stopProgressTimer = () => { if (progressTimer.value) clearInterval(progressTimer.value) }

const startPolling = () => {
	if (pollingTimer.value) clearInterval(pollingTimer.value)
	if (enablePolling.value) {
		pollingTimer.value = setInterval(() => {
			if (tasks.value.some(t => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.PENDING)) loadTasks()
		}, pollingInterval.value)
	}
}
const stopPolling = () => { if (pollingTimer.value) clearInterval(pollingTimer.value); stopProgressTimer() }

const initProjectId = () => {
	const pid = route.query.projectId as string
	if (pid) { filterProjectId.value = pid; selectedProjectId.value = pid }
}

onMounted(async () => {
	initProjectId()
	await loadProjects()
	await loadTasks()
})
onUnmounted(() => stopPolling())

// 表格列 (任务列表的列配置)
const columns = [
	{
		title: '任务标题', key: 'title', width: 150, ellipsis: { tooltip: true },
		render: (row: Task) => h('span', {
			style: { cursor: 'pointer', color: '#18a058', textDecoration: 'underline' },
			onClick: () => openVulnerabilityModal(row)
		}, row.title)
	},
	{
		title: '类型', key: 'taskType', width: 120,
		render: (row: Task) => h(NTag, { type: taskTypeTagType(row.taskType) as any, size: 'small' }, { default: () => taskTypeLabel(row.taskType) })
	},
	{
		title: '优先级', key: 'priority', width: 90,
		render: (row: Task) => h(NTag, { type: priorityTagType(row.priority) as any, size: 'small' }, { default: () => priorityLabel(row.priority) })
	},
	{
		title: '状态', key: 'status', width: 150,
		render: (row: Task) => {
			if (row.status === TaskStatus.COMPLETED) return h(NTag, { type: 'success', size: 'small' }, { default: () => '已完成' })
			if (row.status === TaskStatus.CANCELLED) return h(NTag, { type: 'error', size: 'small' }, { default: () => '已取消' })
			const p = getTaskProgress(row)
			return h('div', { class: 'w-full' }, [
				h(NProgress, { percentage: Math.floor(p), height: 6, showIndicator: false, processing: true }),
				h('div', { style: 'font-size: 12px; color: #999; margin-top: 4px;' }, `${row.status === TaskStatus.PENDING ? '等待中' : '分析中'} ${Math.floor(p)}%`)
			])
		}
	},
	{
		title: '漏洞数', key: 'vuln', width: 80,
		render: (row: Task) => {
			const c = taskVulnerabilityCountMap.value.get(row.id || '') || 0
			return h('span', { style: { color: c > 0 ? '#d03050' : '#18a058', fontWeight: 'bold' } }, c)
		}
	},
	{
		title: '输入文件', key: 'inputFiles', width: 180,
		render: (row: Task) => h(NSpace, { vertical: true, size: 'small' }, {
			default: () => (row.inputFiles || []).map(f => h(NTag, { size: 'tiny', bordered: false }, { default: () => f.name }))
		})
	},
	{
		title: '结果文件', key: 'outputFiles', width: 100,
		render: (row: Task) => h(NSpace, { vertical: true, size: 'small' }, {
			default: () => (row.outputFiles || []).map(f => h(NButton, { size: 'tiny', type: 'primary', secondary: true, onClick: () => handleDownloadFile(f) }, { default: () => '下载' }))
		})
	},
	{ title: '创建时间', key: 'createdAt', width: 160, render: (row: Task) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' },
	{
		title: '操作', key: 'actions', width: 200, fixed: 'right',
		render: (row: Task) => {
			const btns = []
			btns.push(h(NButton, { size: 'small', type: 'primary', secondary: true, onClick: () => openEditModal(row) }, { icon: () => h(CreateOutline), default: () => '编辑' }))

			if (row.status === TaskStatus.IN_PROGRESS || row.status === TaskStatus.PENDING) {
				btns.push(h(NPopconfirm, { onPositiveClick: () => handleCancelTask(row) }, { trigger: () => h(NButton, { size: 'small', type: 'warning', secondary: true }, { icon: () => h(StopOutline), default: () => '中断' }), default: () => '确定中断?' }))
			} else {
				btns.push(h(NButton, { size: 'small', type: 'info', secondary: true, onClick: () => handleRetryTask(row) }, { icon: () => h(RefreshOutline), default: () => '重试' }))
			}

			btns.push(h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, { trigger: () => h(NButton, { size: 'small', type: 'error', secondary: true }, { icon: () => h(TrashOutline), default: () => '删除' }), default: () => '确定删除?' }))
			return h(NSpace, { size: 'small' }, { default: () => btns })
		}
	}
]

const handleFilterChange = () => { pagination.value.page = 1; loadTasks() }
const goBackToProject = () => router.push('/project/index')

</script>

<template>
	<NMessageProvider>
		<div class="h-full flex flex-col p-4 dark:bg-[#24272e]">
			<NCard class="flex-1 flex flex-col" title="任务管理">
				<template #header-extra>
					<NSpace>
						<NButton v-if="filterProjectId" @click="goBackToProject">
							<template #icon><NIcon><ArrowBackOutline /></NIcon></template>返回项目管理
						</NButton>
						<NButton type="primary" @click="openCreateModal">
							<template #icon><NIcon><AddOutline /></NIcon></template>创建任务
						</NButton>
					</NSpace>
				</template>

				<div class="mb-4">
					<NGrid :cols="5" :x-gap="12">
						<NGridItem><NInput v-model:value="searchKeyword" placeholder="搜索任务..." clearable @keyup.enter="loadTasks"><template #prefix><NIcon><SvgIcon icon="ri:search-line" /></NIcon></template></NInput></NGridItem>
						<NGridItem><NSelect v-model:value="filterTaskType" placeholder="任务类型" clearable :options="taskTypeOptions" @update:value="handleFilterChange" /></NGridItem>
						<NGridItem><NSelect v-model:value="filterStatus" placeholder="状态" clearable :options="statusOptions" @update:value="handleFilterChange" /></NGridItem>
						<NGridItem><NSelect v-model:value="filterPriority" placeholder="优先级" clearable :options="priorityOptions" @update:value="handleFilterChange" /></NGridItem>
						<NGridItem><NButton @click="loadTasks" type="primary" block>刷新</NButton></NGridItem>
					</NGrid>
				</div>

				<div class="flex-1 overflow-hidden">
					<NDataTable :columns="columns" :data="tasks" :loading="loading" :pagination="pagination" :max-height="600" striped :scroll-x="1500" />
					<NEmpty v-if="!loading && tasks.length === 0" description="暂无任务" />
				</div>
			</NCard>

			<NModal v-model:show="showModal" :title="isEdit ? '编辑任务' : '创建任务'" preset="dialog" style="width: 700px">
				<NForm :model="currentTask" label-placement="left" label-width="80">
					<NFormItem label="标题" required><NInput v-model:value="currentTask.title" placeholder="请输入任务标题" /></NFormItem>
					<NFormItem label="要求"><NInput v-model:value="currentTask.description" type="textarea" placeholder="请输入任务要求" :rows="3" /></NFormItem>
					<NFormItem label="类型" required><NSelect v-model:value="currentTask.taskType" :options="taskTypeOptions" /></NFormItem>
					<NFormItem label="优先级"><NSelect v-model:value="currentTask.priority" :options="priorityOptions" /></NFormItem>
					<NFormItem label="项目"><NSelect v-model:value="currentTask.projectId" :options="projectOptions" placeholder="选择项目（可选）" clearable /></NFormItem>

					<NFormItem label="输入文件">
						<NSpace vertical class="w-full">
							<NSpace>
								<NUpload ref="uploadRef" :action="uploadAction" :headers="headers" multiple :max="10" @finish="handleUploadFinish" :show-file-list="false">
									<NButton type="primary"><template #icon><NIcon><SvgIcon icon="mage:upload" /></NIcon></template>上传文件</NButton>
								</NUpload>

								<NButton type="default" :loading="isUploadingFolder" @click="handleFolderUpload">
									<template #icon><NIcon><SvgIcon icon="material-symbols:folder-open" /></NIcon></template>上传文件夹
								</NButton>
								<input ref="folderUploadInputRef" type="file" webkitdirectory multiple style="display: none" @change="handleFolderChange" />

								<NButton type="info" dashed @click="openTemplateModal">
									<template #icon><NIcon><DocumentTextOutline /></NIcon></template>从模板库选择
								</NButton>
							</NSpace>

							<div v-if="uploadedFiles.length > 0" class="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
								<div class="text-xs text-gray-400 mb-2">已添加的文件：</div>
								<NSpace size="small">
									<NTag
										v-for="file in uploadedFiles"
										:key="file.id || file.name"
										size="small"
										:type="file.id?.toString().startsWith('tpl_') ? 'success' : 'info'"
										closable
										@close="() => {
                      uploadedFiles = uploadedFiles.filter(f => (f.id && file.id ? f.id !== file.id : f.name !== file.name))
                      currentTask.inputFiles = [...uploadedFiles]
                    }"
									>
										{{ file.name }}
										<template #icon v-if="file.id?.toString().startsWith('tpl_')">
											<NIcon><DocumentTextOutline /></NIcon>
										</template>
									</NTag>
								</NSpace>
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

			<NModal
				v-model:show="showTemplateModal"
				title="模板数据库"
				preset="card"
				style="width: 800px; min-height: 450px;"
			>
				<div class="flex flex-col gap-4">
					<div class="bg-gray-50 dark:bg-gray-800 p-3 rounded flex flex-wrap gap-2 items-center">
						<div style="width: 200px">
							<NInput v-model:value="searchTemplateName" placeholder="模板名称" size="small" clearable @keyup.enter="fetchTemplateList" />
						</div>
						<div style="width: 150px">
							<NSelect v-model:value="searchTemplateType" :options="templateTypeOptions" placeholder="模板类型" size="small" clearable />
						</div>
						<NButton type="primary" size="small" @click="fetchTemplateList" :loading="templateLoading">
							<template #icon><NIcon><SearchOutline /></NIcon></template>查询
						</NButton>
					</div>

					<div class="flex justify-between items-center">
						<NText depth="3">请选择一个标准模板作为任务的输入文件。</NText>
						<NButton size="small" @click="fetchTemplateList" :loading="templateLoading">
							<template #icon><NIcon><RefreshOutline /></NIcon></template>刷新列表
						</NButton>
					</div>

					<NDataTable
						:columns="templateColumns"
						:data="templateData"
						:loading="templateLoading"
						:max-height="400"
						size="small"
						striped
					/>
				</div>
			</NModal>

			<NModal
				v-model:show="showVulnerabilityModal"
				title="任务漏洞详情"
				preset="card"
				style="width: 900px; max-height: 85vh"
				:mask-closable="false"
			>
				<NSpin :show="vulnerabilityLoading">
					<div v-if="vulnerabilityDetail" class="vulnerability-detail">
						<NCard size="small" class="mb-4 bg-gray-50 dark:bg-gray-800" :bordered="false">
							<div class="flex items-center justify-between">
								<div>
									<div class="text-sm text-gray-500">任务名称</div>
									<div class="text-lg font-bold">{{ vulnerabilityDetail.taskTitle }}</div>
								</div>
								<div class="text-center">
									<div class="text-sm text-gray-500">漏洞总数</div>
									<div class="text-3xl font-bold" :style="{ color: vulnerabilityDetail.totalCount > 0 ? '#d03050' : '#18a058' }">
										{{ vulnerabilityDetail.totalCount }}
									</div>
								</div>
							</div>
						</NCard>

						<div v-if="vulnerabilityDetail.severityCount" class="mb-4 flex gap-2">
							<NTag v-if="vulnerabilityDetail.severityCount['严重']" type="error">严重: {{ vulnerabilityDetail.severityCount['严重'] }}</NTag>
							<NTag v-if="vulnerabilityDetail.severityCount['高']" type="warning">高: {{ vulnerabilityDetail.severityCount['高'] }}</NTag>
							<NTag v-if="vulnerabilityDetail.severityCount['中']" type="info">中: {{ vulnerabilityDetail.severityCount['中'] }}</NTag>
							<NTag v-if="vulnerabilityDetail.severityCount['低']" type="default">低: {{ vulnerabilityDetail.severityCount['低'] }}</NTag>
						</div>

						<NDivider style="margin: 10px 0" />

						<NScrollbar style="max-height: 500px">
							<div v-if="vulnerabilityDetail.vulnerabilities?.length > 0" class="flex flex-col gap-4">
								<div
									v-for="(vuln, index) in vulnerabilityDetail.vulnerabilities"
									:key="index"
									:class="`border-l-4 p-4 bg-white dark:bg-[#1a1a1a] shadow-sm rounded-r border-gray-100 dark:border-gray-800 severity-${getSeverityClass(vuln.severity)}`"
								>
									<div class="flex justify-between items-start mb-2">
										<div class="flex items-center gap-2">
											<NTag :type="getSeverityTagType(vuln.severity)" size="small">{{ vuln.severity }}</NTag>
											<span class="font-bold text-base">{{ vuln.title }}</span>
										</div>
										<span class="text-xs text-gray-400">{{ vuln.category }}</span>
									</div>

									<div class="text-sm text-gray-600 dark:text-gray-300 mb-2">{{ vuln.description }}</div>

									<div v-if="vuln.filePath" class="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono mb-2">
										位置: {{ vuln.filePath }}{{ vuln.lineNumber ? `:${vuln.lineNumber}` : '' }}
									</div>

									<div v-if="vuln.codeSnippet" class="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto font-mono text-xs mb-2">
										<code>{{ vuln.codeSnippet }}</code>
									</div>

									<div v-if="vuln.fixSuggestion" class="bg-green-50 dark:bg-[#0f291e] p-3 rounded border border-green-100 dark:border-green-900">
										<div class="text-green-600 dark:text-green-400 font-bold text-xs mb-1">修复建议:</div>
										<div class="text-sm">{{ vuln.fixSuggestion }}</div>
									</div>
								</div>
							</div>
							<NEmpty v-else description="太棒了，未发现安全漏洞" class="py-10" />
						</NScrollbar>
					</div>
				</NSpin>
			</NModal>
		</div>
	</NMessageProvider>
</template>

<style scoped>
/* 漏洞严重程度左边框颜色 */
.severity-critical { border-left-color: #d03050 !important; }
.severity-high { border-left-color: #f0a020 !important; }
.severity-medium { border-left-color: #2080f0 !important; }
.severity-low { border-left-color: #909399 !important; }
</style>
