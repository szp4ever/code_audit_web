<script setup lang='ts'>
import { ref, computed, onMounted, h } from 'vue'
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
  NP
} from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { createTask, fetchTaskList, updateTask, deleteTask, downloadTaskFile, getTaskFileUploadUrl, Task, TaskPriority, TaskStatus, TaskType, TaskFile } from '@/api/task'
import { fetchProjectList, Project } from '@/api/project'
import { AddOutline, TrashOutline, CreateOutline, DownloadOutline, ArrowBackOutline } from '@vicons/ionicons5'
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
const uploadedFiles = ref<TaskFile[]>([])
const uploadAction = getTaskFileUploadUrl()

// 任务列表
const tasks = ref<Task[]>([])
const loading = ref(false)
const total = ref(0)
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

// 获取项目名称
const getProjectName = (projectId?: string | number) => {
  if (!projectId) return '-'
  const project = projects.value.find(p => p.id === projectId)
  return project?.name || '-'
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
    }

    const response = await fetchTaskList(params)
    // 响应拦截器已经返回了 res.data，所以 response 就是后端返回的数据结构
    // 后端可能返回: { code: 200, data: { rows: [...], total: 10 } } 或 { code: 200, data: [...] }
    if (response && response.code === 200) {
      // 处理不同的数据结构
      let taskList: Task[] = []
      if (Array.isArray(response.data)) {
        // 如果 data 直接是数组
        taskList = response.data
      } else if (response.data?.rows) {
        // 如果 data 是对象，包含 rows 字段
        taskList = response.data.rows
      } else if (response.data?.list) {
        // 如果 data 是对象，包含 list 字段
        taskList = response.data.list
      } else if (response.rows) {
        // 如果响应直接包含 rows 字段
        taskList = response.rows
      } else if (response.list) {
        // 如果响应直接包含 list 字段
        taskList = response.list
      }

      // 如果有搜索关键词，进行本地过滤
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        taskList = taskList.filter((task: Task) =>
          task.title.toLowerCase().includes(keyword) ||
          task.description?.toLowerCase().includes(keyword)
        )
      }

      tasks.value = taskList
      total.value = response.data?.total || response.total || taskList.length
    } else {
      // 如果接口不存在，使用本地存储
      loadTasksFromLocal()
    }
  } catch (error) {
    console.error('加载任务列表失败:', error)
    // 如果接口不存在，使用本地存储
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

// 表格列定义
const columns = [
  {
    title: '所属项目',
    key: 'projectId',
    width: 150,
    render: (row: Task) => {
      if (!row.projectId) return '-'
      return h(NTag, {
        type: 'info',
        size: 'small'
      }, { default: () => getProjectName(row.projectId) })
    }
  },
  {
    title: '任务标题',
    key: 'title',
    width: 200,
    ellipsis: {
      tooltip: true
    }
  },
  {
    title: '任务要求',
    key: 'description',
    width: 250,
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
    title: '状态',
    key: 'status',
    width: 100,
    render: (row: Task) => {
      if (!row.status) return '-'
      return h(NTag, {
        type: statusTagType(row.status) as any,
        size: 'small'
      }, { default: () => statusLabel(row.status) })
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
    width: 200,
    render: (row: Task) => {
      return h(NSpace, { size: 'small' }, {
        default: () => [
          h(NButton, {
            size: 'small',
            type: 'primary',
            onClick: () => openEditModal(row)
          }, {
            icon: () => h(NIcon, null, { default: () => h(CreateOutline) })
          }),
          h(NPopconfirm, {
            onPositiveClick: () => handleDelete(row)
          }, {
            trigger: () => h(NButton, {
              size: 'small',
              type: 'error',
              onClick: () => {}
            }, {
              icon: () => h(NIcon, null, { default: () => h(TrashOutline) })
            }),
            default: () => '确定要删除这个任务吗？'
          })
        ]
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

onMounted(async () => {
  // 从URL参数中获取projectId
  const projectId = route.query.projectId as string
  if (projectId) {
    filterProjectId.value = projectId
    selectedProjectId.value = projectId
  }

  // 加载项目列表
  await loadProjects()
  // 加载任务列表
  await loadTasks()
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
          <NGrid :cols="6" :x-gap="12">
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
                v-model:value="filterProjectId"
                placeholder="筛选项目"
                clearable
                :options="projectOptions"
                @update:value="handleFilterChange"
              />
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
          <NFormItem label="任务描述">
            <NInput
              v-model:value="currentTask.description"
              type="textarea"
              placeholder="请输入任务描述"
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
              <NUploadDragger>
                <div style="margin-bottom: 12px">
                  <NIcon size="48" :depth="3">
                    <SvgIcon icon="mage:upload" />
                  </NIcon>
                </div>
                <NText style="font-size: 16px">
                  点击或者拖动文件到该区域来上传
                </NText>
                <NP depth="3" style="margin: 8px 0 0 0">
                  支持多文件上传，最多10个文件
                </NP>
              </NUploadDragger>
            </NUpload>
            <div v-if="uploadedFiles.length > 0" class="mt-2">
              <NText depth="3" style="font-size: 12px">已上传文件：</NText>
              <NSpace class="mt-1" size="small">
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
          </NFormItem>
        </NForm>
        <template #action>
          <NSpace>
            <NButton @click="showModal = false">取消</NButton>
            <NButton type="primary" @click="saveTask">保存</NButton>
          </NSpace>
        </template>
      </NModal>
    </div>
  </NMessageProvider>
</template>

<style scoped>
:deep(.n-data-table) {
  height: 100%;
}
</style>

