import request from '@/utils/request' // 请根据你实际的 axios 封装路径调整
import { post } from '@/utils/request'

// --- 接口类型定义 ---
export interface Report {
	id: string | number
	name: string
	taskName: string
	type: string
	status: 'ready' | 'generating' | 'failed'
	createTime: string
	fileUrl?: string
}

export interface ReportQueryParams {
	currentPage?: number
	pageSize?: number
	keyword?: string
	type?: string | null
}

// --- API 请求方法 ---

/**
 * 获取报告列表 (分页与检索)
 */
export function fetchReportList(data: ReportQueryParams) {
	// ✨ 改为使用 request 对象直接发 post 请求
	return request({
		url: '/report/list',
		method: 'post',
		data,
	})
}

/**
 * 预览/下载报告文件流
 * ✨ 新增：通过后端中转获取 Blob 文件流，解决直接访问 OSS 报 AccessDenied 的问题
 */
export function previewReportApi(id: string | number) {
	return request({ // ✨ 注意：这里用 request，不要用 post
		url: `/report/download/${id}`,
		method: 'get', // ✨ 确保这里是 get
		responseType: 'blob'
	})
}

/**
 * 删除报告
 */
export function deleteReport(id: string | number) {
	return request({
		url: `/report/delete/${id}`,
		method: 'delete',
	})
}

/**
 * 导出报告 (请求后端生成文件流)
 */
export function exportReportApi(id: number | string, format: string) {
	return request({
		url: '/report/export',
		method: 'post',
		data: { id, format },
		responseType: 'blob',
		headers: {
			'Accept': 'application/octet-stream' // 显式告诉后端我们要流
		}
	})
}
