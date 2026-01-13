import request from '@/utils/request/req';

export function listByUser(params: { pageNum: number; pageSize: number }) {
	return request({
	  url: '/system/message/listByUser',
	  method: 'get',
	  params
	});
}

export function getGpts(params: { pageNum: number; pageSize: number }) {
	return request({
	  url: '/system/gpts/list',
	  method: 'get',
	  params
	});
}

// 根据会话ID查询聊天消息列表
export function listBySession(sessionId: number, params?: { pageSize?: number; pageNum?: number; orderByColumn?: string; isAsc?: string }) {
  return request({
    url: `/system/message/listBySession/${sessionId}`,
    method: 'get',
    params: params ?? { pageNum: 1, pageSize: 100, orderByColumn: 'createTime', isAsc: 'asc' }
  })
}
