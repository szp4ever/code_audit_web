<script setup lang='ts'>
import { ref, computed, onMounted, onUnmounted, watch, h } from 'vue'
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
  NUploadDragger,
  UploadFileInfo,
  UploadInst,
  NText,
  NP,
  NDivider,
  NSpin,
  NScrollbar,
  NProgress
} from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { createTask, fetchTaskList, updateTask, deleteTask, downloadTaskFile, getTaskFileUploadUrl, uploadTaskFilesBatch, Task, TaskPriority, TaskStatus, TaskType, TaskFile, getTaskVulnerabilities, TaskVulnerabilityDetail, Vulnerability, VulnerabilitySeverity, cancelTask, retryTask } from '@/api/task'
import { fetchProjectList, Project } from '@/api/project'
import { AddOutline, TrashOutline, CreateOutline, DownloadOutline, ArrowBackOutline, StopOutline, RefreshOutline } from '@vicons/ionicons5'
import { getToken } from '@/store/modules/auth/helper'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const ms = useMessage()
const token = getToken()
const headers = { Authorization: `Bearer ${token}` }

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

// 任务列表
const tasks = ref<Task[]>([])
const loading = ref(false)
const total = ref(0)
const pollingTimer = ref<NodeJS.Timeout | null>(null)
const progressTimer = ref<NodeJS.Timeout | null>(null) // 进度递增定时器
const pollingInterval = ref(5000) // 默认5秒轮询一次
const progressInterval = ref(1000) // 进度每1秒递增一次
const enablePolling = ref(true) // 是否启用轮询

// 本地维护的任务进度（不依赖后端）
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

// 优先级选项
const priorityOptions = [
  { label: '低', value: TaskPriority.LOW },
  { label: '中', value: TaskPriority.MEDIUM },
  { label: '高', value: TaskPriority.HIGH },
  { label: '紧急', value: TaskPriority.URGENT }
]

// 任务类型选项
const taskTypeOptions = [
  { label: '编码规范检查', value: TaskType.CODE_STANDARD_CHECK },
  { label: '数据安全审计', value: TaskType.DATA_SECURITY_AUDIT },
  { label: '依赖关系分析', value: TaskType.DEPENDENCY_ANALYSIS },
  { label: '合规审计', value: TaskType.COMPLIANCE_AUDIT },
  { label: '其他', value: TaskType.OTHER }
]

// 状态选项（仅用于显示和筛选，不在创建时选择）
const statusOptions = [
  { label: '待处理', value: TaskStatus.PENDING },
  { label: '进行中', value: TaskStatus.IN_PROGRESS },
  { label: '已完成', value: TaskStatus.COMPLETED },
  { label: '已取消', value: TaskStatus.CANCELLED }
]

// 优先级标签颜色
const priorityTagType = (priority: TaskPriority) => {
  const map: Record<TaskPriority, string> = {
    [TaskPriority.LOW]: 'default',
    [TaskPriority.MEDIUM]: 'info',
    [TaskPriority.HIGH]: 'warning',
    [TaskPriority.URGENT]: 'error'
  }
  return map[priority] || 'default'
}

// 状态标签颜色
const statusTagType = (status: TaskStatus) => {
  const map: Record<TaskStatus, string> = {
    [TaskStatus.PENDING]: 'default',
    [TaskStatus.IN_PROGRESS]: 'info',
    [TaskStatus.COMPLETED]: 'success',
    [TaskStatus.CANCELLED]: 'error'
  }
  return map[status] || 'default'
}

// 状态标签文本
const statusLabel = (status: TaskStatus) => {
  const map: Record<TaskStatus, string> = {
    [TaskStatus.PENDING]: '待处理',
    [TaskStatus.IN_PROGRESS]: '进行中',
    [TaskStatus.COMPLETED]: '已完成',
    [TaskStatus.CANCELLED]: '已取消'
  }
  return map[status] || status
}

// 优先级标签文本
const priorityLabel = (priority: TaskPriority) => {
  const map: Record<TaskPriority, string> = {
    [TaskPriority.LOW]: '低',
    [TaskPriority.MEDIUM]: '中',
    [TaskPriority.HIGH]: '高',
    [TaskPriority.URGENT]: '紧急'
  }
  return map[priority] || priority
}

// 任务类型标签文本
const taskTypeLabel = (taskType: TaskType) => {
  const map: Record<TaskType, string> = {
    [TaskType.CODE_STANDARD_CHECK]: '编码规范检查',
    [TaskType.DATA_SECURITY_AUDIT]: '数据安全审计',
    [TaskType.DEPENDENCY_ANALYSIS]: '依赖关系分析',
    [TaskType.COMPLIANCE_AUDIT]: '合规审计',
    [TaskType.OTHER]: '其他'
  }
  return map[taskType] || taskType
}

// 任务类型标签颜色
const taskTypeTagType = (taskType: TaskType) => {
  const map: Record<TaskType, string> = {
    [TaskType.CODE_STANDARD_CHECK]: 'info',
    [TaskType.DATA_SECURITY_AUDIT]: 'warning',
    [TaskType.DEPENDENCY_ANALYSIS]: 'success',
    [TaskType.COMPLIANCE_AUDIT]: 'error',
    [TaskType.OTHER]: 'default'
  }
  return map[taskType] || 'default'
}
// 获取并缓存任务漏洞数量
const getTaskVulnerabilityCount = async (taskId: string | number | null) => {
  if (!taskId) return 0

  // 优先从缓存获取，避免重复请求
  if (taskVulnerabilityCountMap.value.has(taskId)) {
    return taskVulnerabilityCountMap.value.get(taskId)!
  }

  try {
    const response = await getTaskVulnerabilities(taskId)
    const count = response?.code === 200 ? (response.data?.totalCount || 0) : 0
    taskVulnerabilityCountMap.value.set(taskId, count)
    return count
  } catch (error) {
    console.error(`获取任务${taskId}漏洞数量失败:`, error)
    taskVulnerabilityCountMap.value.set(taskId, 0)
    return 0
  }
}
// 加载项目列表
const loadProjects = async () => {
  try {
    const response = await fetchProjectList({ currentPage: 1, pageSize: 1000 })
    if (response && response.code === 200) {
      let projectList: Project[] = []
      if (Array.isArray(response.data)) {
        projectList = response.data
      } else if (response.data?.rows) {
        projectList = response.data.rows
      } else if (response.data?.list) {
        projectList = response.data.list
      } else if (response.rows) {
        projectList = response.rows
      } else if (response.list) {
        projectList = response.list
      }

      projects.value = projectList
      projectOptions.value = projectList.map(p => ({
        label: p.name,
        value: p.id!
      }))
    } else {
      // 从本地存储加载
      const localProjects = localStorage.getItem('projects')
      if (localProjects) {
        const projectList = JSON.parse(localProjects) as Project[]
        projects.value = projectList
        projectOptions.value = projectList.map(p => ({
          label: p.name,
          value: p.id!
        }))
      }
    }
  } catch (error) {
    console.error('加载项目列表失败:', error)
    // 从本地存储加载
    const localProjects = localStorage.getItem('projects')
    if (localProjects) {
      const projectList = JSON.parse(localProjects) as Project[]
      projects.value = projectList
      projectOptions.value = projectList.map(p => ({
        label: p.name,
        value: p.id!
      }))
    }
  }
}

// 加载任务列表
const loadTasks = async () => {
  try {
    loading.value = true
    const params: any = {
      currentPage: pagination.value.page,
      pageSize: pagination.value.pageSize
    }
    if (filterStatus.value) {
      params.status = filterStatus.value
    }
    if (filterPriority.value) {
      params.priority = filterPriority.value
    }
    if (filterTaskType.value) {
      params.taskType = filterTaskType.value
    }
    if (filterProjectId.value) {
      params.projectId = filterProjectId.value
      console.log('筛选项目ID:', filterProjectId.value)
    }

    console.log('请求参数:', params)
    const response = await fetchTaskList(params)
    if (response && response.code === 200) {
      let taskList: Task[] = []
      if (Array.isArray(response.data)) {
        taskList = response.data
      } else if (response.data?.rows) {
        taskList = response.data.rows
      } else if (response.data?.list) {
        taskList = response.data.list
      } else if (response.rows) {
        taskList = response.rows
      } else if (response.list) {
        taskList = response.list
      }

      // 应用客户端筛选
      if (filterProjectId.value) {
        taskList = taskList.filter((task: Task) => {
          const taskProjectId = String(task.projectId || '')
          const filterId = String(filterProjectId.value || '')
          return taskProjectId === filterId
        })
      }
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        taskList = taskList.filter((task: Task) =>
          task.title.toLowerCase().includes(keyword) ||
          task.description?.toLowerCase().includes(keyword)
        )
      }

      // 初始化任务进度
      taskList.forEach((task: Task) => {
        if (task.id && (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.PENDING)) {
          if (!taskProgressMap.value.has(task.id)) {
            taskProgressMap.value.set(task.id, 0)
          }
        } else if (task.id && (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED)) {
          taskProgressMap.value.delete(task.id)
        }
      })

      tasks.value = taskList
			taskList.forEach((task: Task) => {
				if (!task.id) return
				const prevStatus = prevTaskStatusMap.value.get(task.id)
				const currentStatus = task.status

				// 仅当「上一次状态是进行中/待处理」且「当前状态是已完成」时触发提示
				if (
					currentStatus === TaskStatus.COMPLETED &&
					[TaskStatus.IN_PROGRESS, TaskStatus.PENDING].includes(prevStatus || '')
				) {
					ms.success(`任务「${task.title}」已完成`)
				}

				// 更新状态缓存
				prevTaskStatusMap.value.set(task.id, currentStatus)
			})
      total.value = response.data?.total || response.total || taskList.length

			taskVulnerabilityCountMap.value.clear()
			await Promise.all(
				taskList.map(async (task) => {
					if (!task.id) return 0
					try {
						const response = await getTaskVulnerabilities(task.id)
						const count = response?.code === 200 ? (response.data?.totalCount || 0) : 0
						taskVulnerabilityCountMap.value.set(task.id, count)
						return count
					} catch (error) {
						console.error(`获取任务${task.id}漏洞数量失败:`, error)
						taskVulnerabilityCountMap.value.set(task.id, 0)
						return 0
					}
				})
			)

      // 轮询和进度定时器逻辑
      const hasInProgressTasks = taskList.some(
        task => task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.PENDING
      )
      if (!hasInProgressTasks && pollingTimer.value) {
        stopPolling()
        stopProgressTimer()
      } else if (hasInProgressTasks && !pollingTimer.value && enablePolling.value) {
        startPolling()
        startProgressTimer()
      } else if (hasInProgressTasks && !progressTimer.value) {
        startProgressTimer()
      }
    } else {
      loadTasksFromLocal()
    }
  } catch (error) {
    console.error('加载任务列表失败:', error)
    loadTasksFromLocal()
  } finally {
    loading.value = false
  }
}

// 从本地存储加载任务
const loadTasksFromLocal = () => {
  try {
    const localTasks = localStorage.getItem('tasks')
    if (localTasks) {
      let taskList = JSON.parse(localTasks) as Task[]

      // 应用筛选
      if (filterStatus.value) {
        taskList = taskList.filter(task => task.status === filterStatus.value)
      }
      if (filterPriority.value) {
        taskList = taskList.filter(task => task.priority === filterPriority.value)
      }
      if (filterTaskType.value) {
        taskList = taskList.filter(task => task.taskType === filterTaskType.value)
      }
      if (filterProjectId.value) {
        taskList = taskList.filter(task => task.projectId === filterProjectId.value)
      }
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        taskList = taskList.filter(task =>
          task.title.toLowerCase().includes(keyword) ||
          task.description?.toLowerCase().includes(keyword)
        )
      }

      // 分页
      const start = (pagination.value.page - 1) * pagination.value.pageSize
      const end = start + pagination.value.pageSize
      tasks.value = taskList.slice(start, end)
      total.value = taskList.length
    }
  } catch (error) {
    console.error('从本地存储加载任务失败:', error)
  }
}

// 保存任务到本地存储
const saveTasksToLocal = (taskList: Task[]) => {
  try {
    localStorage.setItem('tasks', JSON.stringify(taskList))
  } catch (error) {
    console.error('保存任务到本地存储失败:', error)
  }
}

// 打开创建任务模态框
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
  if (uploadRef.value) {
    uploadRef.value.clear()
  }
  showModal.value = true
}

// 打开编辑任务模态框
const openEditModal = (task: Task) => {
  isEdit.value = true
  // 深拷贝文件列表，避免引用问题
  uploadedFiles.value = task.inputFiles ? JSON.parse(JSON.stringify(task.inputFiles)) : []
  currentTask.value = {
    title: task.title,
    description: task.description,
    priority: task.priority,
    taskType: task.taskType,
    projectId: task.projectId || null,
    inputFiles: task.inputFiles ? JSON.parse(JSON.stringify(task.inputFiles)) : [],
    id: task.id
    // 注意：不包含 status，状态由后端管理
  }
  if (uploadRef.value) {
    uploadRef.value.clear()
  }
  showModal.value = true
}

// 文件上传完成处理
const handleUploadFinish = ({ file, event }: { file: UploadFileInfo; event?: ProgressEvent }) => {
  const xhr = event?.target as XMLHttpRequest
  if (xhr) {
    try {
      const responseData = JSON.parse(xhr.responseText)
      if (responseData.code === 200 || responseData.success) {
        const fileData = responseData.data || responseData
        const newFile: TaskFile = {
          id: fileData.id || fileData.uuid || fileData.fileId || `file_${Date.now()}_${Math.random()}`,
          name: file.name,
          url: fileData.url || fileData.path || fileData.fileUrl || fileData.downloadUrl || '',
          size: file.file?.size,
          type: file.file?.type,
          uploadTime: new Date().toISOString()
        }
        // 避免重复添加
        if (!uploadedFiles.value.find(f => f.id === newFile.id && f.name === newFile.name)) {
          uploadedFiles.value.push(newFile)
          currentTask.value.inputFiles = [...uploadedFiles.value]
        }
        ms.success('文件上传成功')
      } else {
        ms.error(responseData.msg || '文件上传失败')
      }
    } catch (error) {
      console.error('解析上传响应失败:', error)
      // 如果后端接口不存在，使用本地文件信息
      const newFile: TaskFile = {
        id: `local_${Date.now()}_${Math.random()}`,
        name: file.name,
        url: URL.createObjectURL(file.file || new Blob()),
        size: file.file?.size,
        type: file.file?.type,
        uploadTime: new Date().toISOString()
      }
      uploadedFiles.value.push(newFile)
      currentTask.value.inputFiles = [...uploadedFiles.value]
      ms.success('文件已添加（本地模式）')
    }
  }
  return file
}

// 文件上传前处理
const handleBeforeUpload = () => {
  return true
}

// 文件列表变化处理
const handleFileListChange = (fileList: UploadFileInfo[]) => {
  // 可以在这里处理文件列表变化
}

// 处理文件夹上传
const handleFolderUpload = () => {
  if (folderUploadInputRef.value) {
    folderUploadInputRef.value.click()
  }
}

// 文件夹选择变化处理
const handleFolderChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) {
    return
  }

  isUploadingFolder.value = true

  try {
    const fileArray: File[] = []
    const relativePaths: string[] = []

    // 读取所有文件及其相对路径
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      fileArray.push(file)

      // 获取相对路径（相对于文件夹根目录）
      // webkitRelativePath 格式：folder/subfolder/file.txt
      const relativePath = file.webkitRelativePath || file.name
      relativePaths.push(relativePath)
    }

    // 调用批量上传接口
    const response = await uploadTaskFilesBatch(fileArray, relativePaths)

    if (response && (response.code === 200 || response.success)) {
      const responseFiles = response.data || []

      // 将返回的文件添加到已上传文件列表
      responseFiles.forEach((fileData: any) => {
        const newFile: TaskFile = {
          id: fileData.id || fileData.uuid || fileData.fileId || `file_${Date.now()}_${Math.random()}`,
          name: fileData.name || fileData.fileName,
          url: fileData.url || fileData.path || fileData.fileUrl || fileData.downloadUrl || '',
          size: fileData.size,
          type: fileData.type || fileData.fileType,
          uploadTime: fileData.uploadTime || new Date().toISOString()
        }

        // 避免重复添加
        if (!uploadedFiles.value.find(f => f.id === newFile.id && f.name === newFile.name)) {
          uploadedFiles.value.push(newFile)
        }
      })

      currentTask.value.inputFiles = [...uploadedFiles.value]
      ms.success(`成功上传 ${responseFiles.length} 个文件`)
    } else {
      ms.error(response?.msg || '文件夹上传失败')
    }
  } catch (error: any) {
    console.error('文件夹上传失败:', error)
    ms.error(error.message || '文件夹上传失败')
  } finally {
    isUploadingFolder.value = false
    // 清空input，以便可以再次选择同一个文件夹
    if (input) {
      input.value = ''
    }
  }
}

// 保存任务
const saveTask = async () => {
  if (!currentTask.value.title.trim()) {
    ms.warning('请输入任务标题')
    return
  }

  if (!currentTask.value.taskType) {
    ms.warning('请选择任务类型')
    return
  }

  try {
    // 创建任务时不包含状态，状态由后端返回
    const taskData: any = {
      title: currentTask.value.title,
      description: currentTask.value.description,
      priority: currentTask.value.priority,
      taskType: currentTask.value.taskType,
      projectId: currentTask.value.projectId || null,
      inputFiles: uploadedFiles.value
    }

    let success = false

    if (isEdit.value && currentTask.value.id) {
      // 更新任务（不更新状态，状态由后端管理）
      try {
        const response = await updateTask(currentTask.value.id, taskData)
        if (response && response.code === 200) {
          ms.success('任务更新成功')
          success = true
        } else {
          ms.error(response?.msg || '任务更新失败')
        }
      } catch (error: any) {
        console.error('更新任务失败:', error)
        // 如果接口不存在，使用本地存储
        updateTaskLocal({ ...taskData, id: currentTask.value.id })
        success = true
      }
    } else {
      // 创建任务（不包含状态字段）
      try {
        const response = await createTask(taskData)
        if (response && response.code === 200) {
          ms.success('任务创建成功')
          success = true
        } else {
          ms.error(response?.msg || '任务创建失败')
        }
      } catch (error: any) {
        console.error('创建任务失败:', error)
        // 如果接口不存在，使用本地存储
        createTaskLocal(taskData)
        success = true
      }
    }

    // 只有成功时才关闭模态框并刷新列表
    if (success) {
      showModal.value = false
      uploadedFiles.value = []
      if (uploadRef.value) {
        uploadRef.value.clear()
      }

      // 刷新任务列表
      await loadTasks()
    }
  } catch (error: any) {
    ms.error(error.message || '操作失败')
  }
}

// 本地创建任务
const createTaskLocal = (task: any) => {
  const localTasks = JSON.parse(localStorage.getItem('tasks') || '[]') as Task[]
  const newTask: Task = {
    ...task,
    id: Date.now().toString(),
    status: TaskStatus.PENDING, // 本地模式下默认状态为待处理
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inputFiles: task.inputFiles || [],
    outputFiles: task.outputFiles || []
  }
  localTasks.unshift(newTask)
  saveTasksToLocal(localTasks)
  ms.success('任务创建成功')
}

// 本地更新任务
const updateTaskLocal = (task: Task) => {
  const localTasks = JSON.parse(localStorage.getItem('tasks') || '[]') as Task[]
  const index = localTasks.findIndex(t => t.id === task.id)
  if (index !== -1) {
    localTasks[index] = {
      ...localTasks[index],
      ...task,
      updatedAt: new Date().toISOString()
    }
    saveTasksToLocal(localTasks)
    ms.success('任务更新成功')
  }
}

// 删除任务
const handleDelete = async (task: Task) => {
  if (!task.id) return

  try {
    try {
      const response = await deleteTask(task.id)
      if (response && response.code === 200) {
        ms.success('任务删除成功')
        // 删除成功后立即刷新列表
        await loadTasks()
      } else {
        ms.error(response?.msg || '任务删除失败')
      }
    } catch (error: any) {
      console.error('删除任务失败:', error)
      // 如果接口不存在，使用本地存储
      deleteTaskLocal(task.id)
      // 本地删除后也要刷新列表
      await loadTasks()
    }
  } catch (error: any) {
    ms.error(error.message || '删除失败')
  }
}

// 本地删除任务
const deleteTaskLocal = (id: string | number) => {
  const localTasks = JSON.parse(localStorage.getItem('tasks') || '[]') as Task[]
  const filtered = localTasks.filter(t => t.id !== id)
  saveTasksToLocal(filtered)
  ms.success('任务删除成功')
}

// 下载文件
const handleDownloadFile = async (file: TaskFile) => {
  try {
    if (file.id) {
      await downloadTaskFile(file.id, file.name)
      ms.success('文件下载成功')
    } else if (file.url) {
      // 如果后端接口不存在，直接使用URL下载
      const link = document.createElement('a')
      link.href = file.url
      link.download = file.name
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      ms.success('文件下载成功')
    }
  } catch (error: any) {
    ms.error(error.message || '文件下载失败')
  }
}

// 注意：任务状态由后端管理，不在前端修改

// 获取任务进度（本地维护）
const getTaskProgress = (task: Task): number => {
  if (!task.id) return 0

  // 如果任务已完成，返回100
  if (task.status === TaskStatus.COMPLETED) {
    taskProgressMap.value.delete(task.id)
    return 100
  }

  // 如果任务已取消，清除进度
  if (task.status === TaskStatus.CANCELLED) {
    taskProgressMap.value.delete(task.id)
    return 0
  }

  // 如果任务在进行中或待处理，返回本地维护的进度
  if (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.PENDING) {
    if (!taskProgressMap.value.has(task.id)) {
      taskProgressMap.value.set(task.id, 0)
    }
    return taskProgressMap.value.get(task.id) || 0
  }
  return 0
}

// 获取进度文本
const getProgressText = (progress: number, status?: TaskStatus): string => {
  if (status === TaskStatus.COMPLETED) {
    return '已完成'
  }

  if (progress < 30) {
    return '正在分析代码'
  } else if (progress < 60) {
    return '调用智能体分析'
  } else if (progress < 99) {
    return '生成报告'
  } else {
    return '即将完成'
  }
}

// 启动进度递增定时器
const startProgressTimer = () => {
  if (progressTimer.value) {
    clearInterval(progressTimer.value)
  }

  progressTimer.value = setInterval(() => {
    // 遍历所有进行中的任务，递增进度
    tasks.value.forEach(task => {
      if (task.id && (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.PENDING)) {
        const currentProgress = taskProgressMap.value.get(task.id) || 0
        // 进度从0递增到99，每次递增1-3（随机，让进度更自然）
        if (currentProgress < 99) {
          const increment = Math.random() * 2 + 1 // 1-3之间的随机增量
          const newProgress = Math.min(99, Math.floor(currentProgress + increment))
          taskProgressMap.value.set(task.id, newProgress)
        }
      }
    })
  }, progressInterval.value)
}

// 停止进度递增定时器
const stopProgressTimer = () => {
  if (progressTimer.value) {
    clearInterval(progressTimer.value)
    progressTimer.value = null
  }
}

// 启动定时轮询
const startPolling = () => {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
  }
  if (enablePolling.value) {
    pollingTimer.value = setInterval(() => {
      // 只轮询进行中的任务
      const hasInProgressTasks = tasks.value.some(
        task => task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.PENDING
      )
      if (hasInProgressTasks) {
        loadTasks()
      }
    }, pollingInterval.value)
  }
}

// 停止定时轮询
const stopPolling = () => {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
  stopProgressTimer()
}

// 中断任务
const handleCancelTask = async (task: Task) => {
  if (!task.id) return

  try {
    const response = await cancelTask(task.id)
    if (response && response.code === 200) {
      ms.success('任务已中断')
      await loadTasks()
    } else {
      ms.error(response?.msg || '中断任务失败')
    }
  } catch (error: any) {
    console.error('中断任务失败:', error)
    ms.error(error.message || '中断任务失败')
  }
}

// 重试任务
const handleRetryTask = async (task: Task) => {
  if (!task.id) return

  try {
    const response = await retryTask(task.id)
    if (response && response.code === 200) {
      // 重置任务进度
      if (task.id) {
        taskProgressMap.value.set(task.id, 0)
      }
      ms.success('任务已重新开始')
      await loadTasks()
      // 重新启动轮询和进度定时器
      startPolling()
      startProgressTimer()
    } else {
      ms.error(response?.msg || '重试任务失败')
    }
  } catch (error: any) {
    console.error('重试任务失败:', error)
    ms.error(error.message || '重试任务失败')
  }
}

// 获取severity对应的CSS类名（中文值转换为英文类名）
const getSeverityClass = (severity: string) => {
  const map: Record<string, string> = {
    '严重': 'critical',
    '高': 'high',
    '中': 'medium',
    '低': 'low'
  }
  return map[severity] || 'low'
}

// 获取severity对应的Tag类型
const getSeverityTagType = (severity: string) => {
  const map: Record<string, string> = {
    '严重': 'error',
    '高': 'warning',
    '中': 'info',
    '低': 'default'
  }
  return map[severity] || 'default'
}

// 打开漏洞详情弹窗
const openVulnerabilityModal = async (task: Task) => {
  if (!task.id) {
    ms.warning('任务ID不存在')
    return
  }

  currentTaskId.value = task.id
  showVulnerabilityModal.value = true
  vulnerabilityLoading.value = true
  vulnerabilityDetail.value = null

  try {
    const response = await getTaskVulnerabilities(task.id)
    if (response && response.code === 200) {
      vulnerabilityDetail.value = response.data || response
    } else {
      // 如果接口不存在，使用模拟数据
      vulnerabilityDetail.value = {
        taskId: task.id,
        taskTitle: task.title,
        totalCount: 0,
        vulnerabilities: []
      }
      ms.warning('暂无漏洞数据')
    }
  } catch (error: any) {
    console.error('获取漏洞详情失败:', error)
    // 如果接口不存在，使用模拟数据
    vulnerabilityDetail.value = {
      taskId: task.id,
      taskTitle: task.title,
      totalCount: 0,
      vulnerabilities: []
    }
    ms.warning('获取漏洞详情失败，请稍后重试')
  } finally {
    vulnerabilityLoading.value = false
  }
}

// 表格列定义
const columns = [
  {
    title: '任务标题',
    key: 'title',
    width: 150,
    ellipsis: {
      tooltip: true
    },
    render: (row: Task) => {
      return h('span', {
        style: { cursor: 'pointer', color: '#18a058', textDecoration: 'underline' },
        onClick: () => openVulnerabilityModal(row)
      }, row.title)
    }
  },
  {
    title: '任务要求',
    key: 'description',
    width: 100,
    ellipsis: {
      tooltip: true
    },
    render: (row: Task) => row.description || '-'
  },
  {
    title: '任务类型',
    key: 'taskType',
    width: 150,
    render: (row: Task) => {
      return h(NTag, {
        type: taskTypeTagType(row.taskType) as any,
        size: 'small'
      }, { default: () => taskTypeLabel(row.taskType) })
    }
  },
  {
    title: '优先级',
    key: 'priority',
    width: 100,
    render: (row: Task) => {
      return h(NTag, {
        type: priorityTagType(row.priority) as any,
        size: 'small'
      }, { default: () => priorityLabel(row.priority) })
    }
  },
  {
    title: '状态/进度',
    key: 'status',
    width: 100,
    render: (row: Task) => {
      if (!row.status) return '-'

      // 如果已完成，显示已完成标签
      if (row.status === TaskStatus.COMPLETED) {
        return h(NTag, {
          type: 'success',
          size: 'small'
        }, { default: () => '已完成' })
      }

      // 如果已取消，显示已取消标签
      if (row.status === TaskStatus.CANCELLED) {
        return h(NTag, {
          type: 'error',
          size: 'small'
        }, { default: () => '已取消' })
      }

      // 如果进行中或待处理，显示进度条（使用本地维护的进度）
      const progress = getTaskProgress(row)
      const progressText = getProgressText(progress, row.status)

      return h('div', { style: 'display: flex; flex-direction: column; gap: 4px; width: 100%' }, [
        h(NProgress, {
          percentage: progress,
          status: row.status === TaskStatus.IN_PROGRESS ? 'default' : 'info',
          showIndicator: true,
          height: 8
        }),
        h('span', { style: 'font-size: 12px; color: #666' }, `${progressText} ${progress}%`)
      ])
    }
  },
	{
		title: '漏洞总数',
		key: 'vulnerability_num',
		width: 100,
		render: (row: Task) => {
    	const count = taskVulnerabilityCountMap.value.get(row.id || '') || 0
    	return h('span', { style: { color: '#D03050', fontWeight: '800' } }, count)
		}
	},
  {
    title: '上传文件',
    key: 'inputFiles',
    width: 150,
    render: (row: Task) => {
      if (!row.inputFiles || row.inputFiles.length === 0) return '-'
      return h(NSpace, { size: 'small', vertical: true }, {
        default: () => row.inputFiles!.map((file: TaskFile) =>
          h(NTag, { size: 'small', type: 'info' }, { default: () => file.name })
        )
      })
    }
  },
  {
    title: '返回文件',
    key: 'outputFiles',
    width: 150,
    render: (row: Task) => {
      if (!row.outputFiles || row.outputFiles.length === 0) return '-'
      return h(NSpace, { size: 'small', vertical: true }, {
        default: () => row.outputFiles!.map((file: TaskFile) =>
          h(NButton, {
            size: 'small',
            type: 'primary',
            onClick: () => handleDownloadFile(file)
          }, {
            icon: () => h(NIcon, null, { default: () => h(DownloadOutline) }),
            default: () => '下载'
          })
        )
      })
    }
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 150,
    render: (row: Task) => row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-'
  },
  {
    title: '操作',
    key: 'actions',
    width: 320,
    render: (row: Task) => {
      const buttons: any[] = []

      // 编辑按钮
      buttons.push(
        h(NButton, {
          size: 'small',
          type: 'primary',
          onClick: () => openEditModal(row)
        }, {
          icon: () => h(NIcon, null, { default: () => h(CreateOutline) }),
          default: () => '编辑'
        })
      )

      // 中断按钮（仅在进行中或待处理时显示）
      if (row.status === TaskStatus.IN_PROGRESS || row.status === TaskStatus.PENDING) {
        buttons.push(
          h(NPopconfirm, {
            onPositiveClick: () => handleCancelTask(row)
          }, {
            trigger: () => h(NButton, {
              size: 'small',
              type: 'warning',
              onClick: () => {}
            }, {
              icon: () => h(NIcon, null, { default: () => h(StopOutline) }),
              default: () => '中断'
            }),
            default: () => '确定要中断这个任务吗？'
          })
        )
      }

      // 重试按钮（在非进行中/待处理状态时显示，允许重新执行任务）
      // 包括：已完成、已取消，以及任何非进行中的状态
      if (row.status &&
          row.status !== TaskStatus.IN_PROGRESS &&
          row.status !== TaskStatus.PENDING) {
        buttons.push(
          h(NButton, {
            size: 'small',
            type: 'info',
            onClick: () => handleRetryTask(row)
          }, {
            icon: () => h(NIcon, null, { default: () => h(RefreshOutline) }),
            default: () => '重试'
          })
        )
      }

      // 删除按钮
      buttons.push(
        h(NPopconfirm, {
          onPositiveClick: () => handleDelete(row)
        }, {
          trigger: () => h(NButton, {
            size: 'small',
            type: 'error',
            onClick: () => {}
          }, {
            icon: () => h(NIcon, null, { default: () => h(TrashOutline) }),
            default: () => '删除'
          }),
          default: () => '确定要删除这个任务吗？'
        })
      )

      return h(NSpace, { size: 'small' }, {
        default: () => buttons
      })
    }
  }
]

// 筛选变化
const handleFilterChange = () => {
  pagination.value.page = 1
  loadTasks()
}

// 返回项目管理
const goBackToProject = () => {
  router.push('/project/index')
}

// 初始化projectId
const initProjectId = () => {
  const projectId = route.query.projectId as string
  console.log('从URL获取的projectId:', projectId)
  if (projectId) {
    filterProjectId.value = projectId
    selectedProjectId.value = projectId
    console.log('设置filterProjectId为:', filterProjectId.value)
  } else {
    // 如果没有projectId，清空筛选
    filterProjectId.value = null
    selectedProjectId.value = null
  }
}

// 监听路由变化
watch(() => route.query.projectId, (newProjectId) => {
  console.log('路由projectId变化:', newProjectId)
  initProjectId()
  loadTasks()
}, { immediate: false })

onMounted(async () => {
  // 初始化projectId
  initProjectId()

  // 加载项目列表
  await loadProjects()
  // 加载任务列表
  await loadTasks()

  // 启动定时轮询
  startPolling()
  // 启动进度递增定时器
  startProgressTimer()
})

onUnmounted(() => {
  // 组件卸载时停止轮询和进度定时器
  stopPolling()
  stopProgressTimer()
})
</script>

<template>
  <NMessageProvider>
    <div class="h-full flex flex-col p-4 dark:bg-[#24272e]">
      <NCard class="flex-1 flex flex-col" title="任务管理">
        <template #header-extra>
          <NSpace>
            <NButton v-if="filterProjectId" @click="goBackToProject">
              <template #icon>
                <NIcon><ArrowBackOutline /></NIcon>
              </template>
              返回项目管理
            </NButton>
            <NButton type="primary" @click="openCreateModal">
              <template #icon>
                <NIcon><AddOutline /></NIcon>
              </template>
              创建任务
            </NButton>
          </NSpace>
        </template>

        <div class="mb-4">
          <NGrid :cols="5" :x-gap="12">
            <NGridItem>
              <NInput
                v-model:value="searchKeyword"
                placeholder="搜索任务..."
                clearable
                @keyup.enter="loadTasks"
              >
                <template #prefix>
                  <NIcon><SvgIcon icon="ri:search-line" /></NIcon>
                </template>
              </NInput>
            </NGridItem>
            <NGridItem>
              <NSelect
                v-model:value="filterTaskType"
                placeholder="筛选任务类型"
                clearable
                :options="taskTypeOptions"
                @update:value="handleFilterChange"
              />
            </NGridItem>
            <NGridItem>
              <NSelect
                v-model:value="filterStatus"
                placeholder="筛选状态"
                clearable
                :options="statusOptions"
                @update:value="handleFilterChange"
              />
            </NGridItem>
            <NGridItem>
              <NSelect
                v-model:value="filterPriority"
                placeholder="筛选优先级"
                clearable
                :options="priorityOptions"
                @update:value="handleFilterChange"
              />
            </NGridItem>
            <NGridItem>
              <NButton @click="loadTasks" type="primary" block>
                刷新
              </NButton>
            </NGridItem>
          </NGrid>
        </div>

        <div class="flex-1 overflow-hidden">
          <NDataTable
            :columns="columns"
            :data="tasks"
            :loading="loading"
            :pagination="pagination"
            :max-height="600"
            striped
          />
          <NEmpty v-if="!loading && tasks.length === 0" description="暂无任务" />
        </div>
      </NCard>

      <!-- 创建/编辑任务模态框 -->
      <NModal
        v-model:show="showModal"
        :title="isEdit ? '编辑任务' : '创建任务'"
        preset="dialog"
        style="width: 600px"
      >
        <NForm :model="currentTask" label-placement="left" label-width="80">
          <NFormItem label="任务标题" required>
            <NInput v-model:value="currentTask.title" placeholder="请输入任务标题" />
          </NFormItem>
          <NFormItem label="任务要求">
            <NInput
              v-model:value="currentTask.description"
              type="textarea"
              placeholder="请输入任务要求"
              :rows="4"
            />
          </NFormItem>
          <NFormItem label="任务类型" required>
            <NSelect
              v-model:value="currentTask.taskType"
              :options="taskTypeOptions"
              placeholder="请选择任务类型"
            />
          </NFormItem>
          <NFormItem label="优先级">
            <NSelect
              v-model:value="currentTask.priority"
              :options="priorityOptions"
            />
          </NFormItem>
          <NFormItem label="所属项目">
            <NSelect
              v-model:value="currentTask.projectId"
              :options="projectOptions"
              placeholder="请选择项目（可选）"
              clearable
            />
          </NFormItem>
          <NFormItem label="上传文件">
            <NSpace vertical :size="12">
              <!-- 两个上传按钮 -->
              <NSpace>
                <NUpload
                  ref="uploadRef"
                  :action="uploadAction"
                  :headers="headers"
                  multiple
                  :max="10"
                  @finish="handleUploadFinish"
                  @before-upload="handleBeforeUpload"
                  @update:file-list="handleFileListChange"
                >
                  <NButton type="primary">
                    <template #icon>
                      <NIcon><SvgIcon icon="mage:upload" /></NIcon>
                    </template>
                    上传文件
                  </NButton>
                </NUpload>
                <NButton
                  type="default"
                  :loading="isUploadingFolder"
                  @click="handleFolderUpload"
                >
                  <template #icon>
                    <NIcon><SvgIcon icon="material-symbols:folder-open" /></NIcon>
                  </template>
                  上传文件夹
                </NButton>
                <!-- 隐藏的文件夹选择input -->
                <input
                  ref="folderUploadInputRef"
                  type="file"
                  webkitdirectory
                  multiple
                  style="display: none"
                  @change="handleFolderChange"
                />
              </NSpace>

              <!-- 已上传文件列表 -->
              <div v-if="uploadedFiles.length > 0" class="mt-2">
                <NText depth="3" style="font-size: 12px">已上传文件：</NText>
                <NSpace class="mt-1" size="small" :wrap="true">
                  <NTag
                    v-for="file in uploadedFiles"
                    :key="file.id || file.name"
                    size="small"
                    type="info"
                    closable
                    @close="() => {
                      uploadedFiles = uploadedFiles.filter(f => (f.id && file.id ? f.id !== file.id : f.name !== file.name))
                      currentTask.inputFiles = [...uploadedFiles]
                    }"
                  >
                    {{ file.name }}
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

      <!-- 漏洞详情弹窗 -->
      <NModal
        v-model:show="showVulnerabilityModal"
        title="任务漏洞详情"
        preset="card"
        style="width: 900px; max-height: 80vh"
        :mask-closable="false"
      >
        <NSpin :show="vulnerabilityLoading">
          <div v-if="vulnerabilityDetail" class="vulnerability-detail">
            <!-- 任务信息 -->
            <NCard size="small" class="mb-4">
              <div class="flex items-center justify-between">
                <div>
                  <NText strong style="font-size: 16px">{{ vulnerabilityDetail.taskTitle }}</NText>
                </div>
                <div class="flex items-center gap-4">
                  <div class="text-center">
                    <NText depth="3" style="font-size: 12px">漏洞总数</NText>
                    <div class="text-2xl font-bold" :style="{ color: vulnerabilityDetail.totalCount > 0 ? '#d03050' : '#18a058' }">
                      {{ vulnerabilityDetail.totalCount }}
                    </div>
                  </div>
                </div>
              </div>
            </NCard>

            <!-- 漏洞统计 -->
            <NCard v-if="vulnerabilityDetail.severityCount" size="small" class="mb-4">
              <template #header>漏洞统计</template>
              <NSpace>
                <NTag v-if="vulnerabilityDetail.severityCount?.['严重']" type="error" size="large">
                  严重: {{ vulnerabilityDetail.severityCount['严重'] }}
                </NTag>
                <NTag v-if="vulnerabilityDetail.severityCount?.['高']" type="warning" size="large">
                  高: {{ vulnerabilityDetail.severityCount['高'] }}
                </NTag>
                <NTag v-if="vulnerabilityDetail.severityCount?.['中']" type="info" size="large">
                  中: {{ vulnerabilityDetail.severityCount['中'] }}
                </NTag>
                <NTag v-if="vulnerabilityDetail.severityCount?.['低']" type="default" size="large">
                  低: {{ vulnerabilityDetail.severityCount['低'] }}
                </NTag>
              </NSpace>
            </NCard>

            <!-- 漏洞列表 -->
            <div v-if="vulnerabilityDetail.vulnerabilities && vulnerabilityDetail.vulnerabilities.length > 0">
              <NDivider style="margin: 16px 0">漏洞列表</NDivider>
              <NScrollbar style="max-height: 500px">
                <div class="vulnerability-list">
                  <div
                    v-for="(vuln, index) in vulnerabilityDetail.vulnerabilities"
                    :key="vuln.id || index"
                    :class="`vulnerability-item severity-${getSeverityClass(vuln.severity)}`"
                  >
                    <!-- 漏洞标题 -->
                    <div class="vulnerability-header">
                      <div class="flex items-center gap-2">
                        <NTag
                          :type="getSeverityTagType(vuln.severity)"
                          size="small"
                        >
                          {{ vuln.severity }}
                        </NTag>
                        <NText strong style="font-size: 15px">{{ vuln.title }}</NText>
                      </div>
                      <NText v-if="vuln.category" depth="3" style="font-size: 12px">{{ vuln.category }}</NText>
                    </div>

                    <!-- 漏洞内容 -->
                    <div class="vulnerability-content">
                      <!-- 漏洞描述 -->
                      <div class="vulnerability-section">
                        <NText strong style="font-size: 14px; color: #666">漏洞描述：</NText>
                        <div class="vulnerability-text">
                          <NText>{{ vuln.description }}</NText>
                        </div>
                      </div>

                      <!-- 文件位置 -->
                      <div v-if="vuln.filePath" class="vulnerability-section">
                        <NText strong style="font-size: 14px; color: #666">文件位置：</NText>
                        <div class="vulnerability-text">
                          <NText code>{{ vuln.filePath }}{{ vuln.lineNumber ? `:${vuln.lineNumber}` : '' }}</NText>
                        </div>
                      </div>

                      <!-- 代码片段 -->
                      <div v-if="vuln.codeSnippet" class="vulnerability-section">
                        <NText strong style="font-size: 14px; color: #666">相关代码：</NText>
                        <div class="vulnerability-text">
                          <pre class="code-snippet"><code>{{ vuln.codeSnippet }}</code></pre>
                        </div>
                      </div>

                      <!-- 修复建议 -->
                      <div class="vulnerability-section fix-suggestion">
                        <NText strong style="font-size: 14px; color: #18a058">修复建议：</NText>
                        <div class="vulnerability-text">
                          <NText>{{ vuln.fixSuggestion }}</NText>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </NScrollbar>
            </div>

            <!-- 无漏洞提示 -->
            <NEmpty v-else description="该任务暂未发现漏洞" />
          </div>
        </NSpin>
      </NModal>
    </div>
  </NMessageProvider>
</template>

<style scoped>
:deep(.n-data-table) {
  height: 100%;
}

.vulnerability-detail {
  padding: 0;
}

.vulnerability-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.vulnerability-item {
  padding: 16px;
  border-left: 3px solid #e5e7eb;
  background-color: #fafafa;
  transition: all 0.2s;
  border-bottom: 1px solid #e5e7eb;
}

.vulnerability-item:last-child {
  border-bottom: none;
}

.vulnerability-item.severity-critical {
  border-left-color: #d03050;
  background-color: #fff1f0;
}

.vulnerability-item.severity-high {
  border-left-color: #f0a020;
  background-color: #fffbe6;
}

.vulnerability-item.severity-medium {
  border-left-color: #2080f0;
  background-color: #e6f7ff;
}

.vulnerability-item.severity-low {
  border-left-color: #909399;
  background-color: #f5f5f5;
}

.dark .vulnerability-item {
  background-color: #1a1a1a;
  border-left-color: #404040;
  border-bottom-color: #404040;
}

.dark .vulnerability-item.severity-critical {
  background-color: #2a1a1a;
  border-left-color: #d03050;
}

.dark .vulnerability-item.severity-high {
  background-color: #2a241a;
  border-left-color: #f0a020;
}

.dark .vulnerability-item.severity-medium {
  background-color: #1a1f2a;
  border-left-color: #2080f0;
}

.dark .vulnerability-item.severity-low {
  background-color: #1f1f1f;
  border-left-color: #606060;
}

.vulnerability-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.dark .vulnerability-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.vulnerability-content {
  padding: 0;
}

.vulnerability-section {
  margin-bottom: 12px;
}

.vulnerability-section:last-child {
  margin-bottom: 0;
}

.vulnerability-text {
  margin-top: 6px;
  line-height: 1.6;
}

.code-snippet {
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  margin: 6px 0 0 0;
}

.dark .code-snippet {
  background-color: #2d2d2d;
  color: #f8f8f2;
}

.fix-suggestion {
  padding: 12px;
  background-color: #f6ffed;
  border-left: 3px solid #52c41a;
  border-radius: 4px;
  margin-top: 8px;
}

.dark .fix-suggestion {
  background-color: #162312;
  border-left-color: #73d13d;
}
</style>

