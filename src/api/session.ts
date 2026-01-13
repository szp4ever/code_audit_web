import request from '@/utils/request/req'

// 会话管理接口封装
// 列表查询
export function listSessions(params?: {
  createDept?: number
  createBy?: number
  createTime?: string
  updateBy?: number
  updateTime?: string
  id?: number
  userId?: number
  sessionTitle?: string
  sessionContent?: string
  remark?: string
  conversationId?: string
  pageSize?: number
  pageNum?: number
  orderByColumn?: string
  isAsc?: string
}) {
  return request({
    url: '/system/session/list',
    method: 'get',
    params,
  })
}

// 新增会话
export function createSession(data?: {
  createDept?: number
  createBy?: number
  createTime?: string
  updateBy?: number
  updateTime?: string
  id?: number
  userId?: number
  sessionTitle?: string
  sessionContent?: string
  remark?: string
  conversationId?: string
}) {
  return request({
    url: '/system/session',
    method: 'post',
    data,
  })
}

// 获取会话详情
export function getSessionById(id: number) {
  return request({
    url: `/system/session/${id}`,
    method: 'get',
  })
}

// 删除会话，支持批量，ids为逗号分隔
export function deleteSessions(ids: string) {
  return request({
    url: `/system/session/${ids}`,
    method: 'delete',
  })
}

// 修改会话
export function updateSession(data: {
  id: number
  createDept?: number
  createBy?: number
  createTime?: string
  updateBy?: number
  updateTime?: string
  userId?: number
  sessionTitle?: string
  sessionContent?: string
  remark?: string
  conversationId?: string
}) {
  return request({
    url: '/system/session',
    method: 'put',
    data,
  })
}