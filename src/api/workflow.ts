import request from '@/utils/request/req';


// 由调用方传入完整的 data 结构（含 searchReq/currentPage/pageSize）
export function fetchWorkflowList(data: { currentPage: number; pageSize: number }) {
  return request({
    url: '/workflow/public/search',
    method: 'get',
    params: data,
  } as any)
}

