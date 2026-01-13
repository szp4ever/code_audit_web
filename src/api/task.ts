import request from '@/utils/request/req';

// 任务优先级枚举
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// 任务类型枚举
export enum TaskType {
  CODE_STANDARD_CHECK = 'code_standard_check',      // 编码规范检查
  DATA_SECURITY_AUDIT = 'data_security_audit',     // 数据安全审计
  DEPENDENCY_ANALYSIS = 'dependency_analysis',      // 依赖关系分析
  COMPLIANCE_AUDIT = 'compliance_audit',            // 合规审计
  OTHER = 'other'                                   // 其他
}

// 任务状态枚举（由后端返回，不在创建时选择）
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// 文件接口定义
export interface TaskFile {
  id?: string
  name: string
  url: string
  size?: number
  type?: string
  uploadTime?: string
}

// 任务接口定义
export interface Task {
  id?: number | string
  projectId?: number | string  // 所属项目ID
  title: string
  description?: string
  priority: TaskPriority
  taskType: TaskType  // 任务类型（创建时选择）
  status?: TaskStatus  // 任务状态（由后端返回，不在创建时选择）
  inputFiles?: TaskFile[]  // 上传的文件
  outputFiles?: TaskFile[] // 任务完成返回的文件
  createdAt?: string
  updatedAt?: string
  tags?: string[]
}

// 创建任务
export function createTask(data: Task) {
  return request({
    url: '/task/create',
    method: 'post',
    data,
  } as any)
}

// 获取任务列表
export function fetchTaskList(params: { 
  currentPage?: number
  pageSize?: number
  status?: TaskStatus
  priority?: TaskPriority
  taskType?: TaskType
  projectId?: number | string  // 按项目筛选
}) {
  return request({
    url: '/task/list',
    method: 'get',
    params: {
      currentPage: params.currentPage || 1,
      pageSize: params.pageSize || 10,
      ...(params.status && { status: params.status }),
      ...(params.priority && { priority: params.priority }),
      ...(params.taskType && { taskType: params.taskType }),
      ...(params.projectId && { projectId: params.projectId }),
    },
  } as any)
}

// 更新任务
export function updateTask(id: number | string, data: Partial<Task>) {
  return request({
    url: `/task/update/${id}`,
    method: 'put',
    data,
  } as any)
}

// 下载文件
export async function downloadTaskFile(fileId: string, fileName: string) {
  try {
    const response = await fetch(`${import.meta.env.VITE_GLOB_API_URL}/task/file/download/${fileId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('TOKEN') || ''}`
      }
    })
    
    if (!response.ok) {
      throw new Error('下载失败')
    }
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('文件下载失败:', error)
    throw error
  }
}

// 删除任务
export function deleteTask(id: number | string) {
  return request({
    url: `/task/delete/${id}`,
    method: 'delete',
  } as any)
}

// 获取任务详情
export function getTaskDetail(id: number | string) {
  return request({
    url: `/task/detail/${id}`,
    method: 'get',
  } as any)
}

// 上传任务文件
export function uploadTaskFile(file: File, taskId?: string | number) {
  const formData = new FormData()
  formData.append('file', file)
  if (taskId) {
    formData.append('taskId', String(taskId))
  }
  
  // 注意：FormData 不需要手动设置 Content-Type，浏览器会自动设置并包含 boundary
  return request({
    url: '/task/file/upload',
    method: 'post',
    data: formData,
  } as any)
}

// 获取上传文件的URL（用于NUpload组件的action属性）
export function getTaskFileUploadUrl() {
  return `${import.meta.env.VITE_GLOB_API_URL}/task/file/upload`
}

