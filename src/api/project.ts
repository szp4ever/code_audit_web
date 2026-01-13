import request from '@/utils/request/req';

// 项目状态枚举
export enum ProjectStatus {
  ACTIVE = 'active',        // 进行中
  COMPLETED = 'completed',  // 已完成
  ARCHIVED = 'archived',    // 已归档
  CANCELLED = 'cancelled'   // 已取消
}

// 项目接口定义
export interface Project {
  id?: number | string
  name: string                    // 项目名称
  description?: string            // 项目描述
  status?: ProjectStatus          // 项目状态（自动计算，根据任务完成情况）
  createdAt?: string              // 创建时间
  updatedAt?: string              // 更新时间
  taskCount?: number              // 任务数量（统计字段）
  completedTaskCount?: number    // 已完成任务数量（统计字段）
  tags?: string[]                // 项目标签
  createdBy?: string              // 创建人（用户名或昵称）
  createdById?: number | string   // 创建人ID
  createdByDept?: string          // 创建部门（部门名称）
  createdByDeptId?: number | string // 创建部门ID
}

// 创建项目
export function createProject(data: Project) {
  return request({
    url: '/project/create',
    method: 'post',
    data,
  } as any)
}

// 获取项目列表
export function fetchProjectList(params: { 
  currentPage?: number
  pageSize?: number
  status?: ProjectStatus
  keyword?: string
}) {
  return request({
    url: '/project/list',
    method: 'get',
    params: {
      currentPage: params.currentPage || 1,
      pageSize: params.pageSize || 10,
      ...(params.status && { status: params.status }),
      ...(params.keyword && { keyword: params.keyword }),
    },
  } as any)
}

// 更新项目
export function updateProject(id: number | string, data: Partial<Project>) {
  return request({
    url: `/project/update/${id}`,
    method: 'put',
    data,
  } as any)
}

// 删除项目
export function deleteProject(id: number | string) {
  return request({
    url: `/project/delete/${id}`,
    method: 'delete',
  } as any)
}

// 获取项目详情
export function getProjectDetail(id: number | string) {
  return request({
    url: `/project/detail/${id}`,
    method: 'get',
  } as any)
}

// 获取项目的任务列表
export function getProjectTasks(projectId: number | string, params?: {
  currentPage?: number
  pageSize?: number
  status?: string
}) {
  return request({
    url: `/project/${projectId}/tasks`,
    method: 'get',
    params: {
      currentPage: params?.currentPage || 1,
      pageSize: params?.pageSize || 10,
      ...(params?.status && { status: params.status }),
    },
  } as any)
}

// 获取项目统计信息
export function getProjectStatistics(projectId: number | string) {
  return request({
    url: `/project/${projectId}/statistics`,
    method: 'get',
  } as any)
}

