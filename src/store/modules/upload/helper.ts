import { ss } from '@/utils/storage'

const STORAGE_KEY = 'uploadTasks'
const MAX_STORAGE_SIZE = 5 * 1024 * 1024
const TASK_EXPIRY_TIME = 24 * 60 * 60 * 1000

export type ProcessingStatus = 
	| 'UPLOADING' 
	| 'PARSING' 
	| 'CHUNKING' 
	| 'MATCHING' 
	| 'USER_REVIEW_MATCHING' 
	| 'CREATING_ITEMS' 
	| 'USER_REVIEW_ITEMS' 
	| 'VECTORIZING' 
	| 'COMPLETED' 
	| 'FAILED' 
	| 'CANCELLED'

export interface UploadTask {
	id: string
	fileName: string
	fileSize: number
	file?: File
	status: 'waiting' | 'uploading' | 'processing' | 'success' | 'error'
		| 'parsing' | 'chunking' | 'matching' 
		| 'user_review_matching' | 'creating_items' 
		| 'user_review_items' | 'vectorizing' | 'completed' | 'failed' | 'cancelled'
	progress: number
	uploadedBytes: number
	error?: string
	attachId?: number
	docId?: string
	kid?: string
	autoCreateItems?: boolean
	autoClassify?: boolean
	createdAt: number
	updatedAt: number
	retryCount: number
	xhr?: any
	chunks?: Array<{ index: number; blob: Blob; uploaded: boolean }>
	totalChunks?: number
	chunkSize?: number
	// 新增字段（基于LLM与状态改革设计文档 v1.0）
	processingStatus?: ProcessingStatus
	processingProgress?: number
	processId?: string
	attachProcessData?: any
	// 速率计算相关字段
	uploadSpeed?: number//上传速率（字节/秒）
	processingSpeed?: number//处理速率（实际数据量/秒，如片段/秒、条目/秒等）
	speedUnit?: string//速率单位（如"片段/秒"、"条目/秒"等）
	eta?: number//预计剩余时间（秒）
	lastSpeedUpdateTime?: number//上次速率更新时间
}

export interface UploadState {
	tasks: UploadTask[]
	activeTaskIds: Set<string>
	settings: {
		autoRetry: boolean
		retryCount: number
		chunkedUpload: boolean
		chunkSize: number
		notifications: boolean
	}
	knowledgeBaseFilter: string[]
	knowledgeBaseMap: Map<string, string>
	filters: {
		status: 'all' | 'active' | 'pending' | 'completed' | 'failed'
		time: 'all' | 'today' | 'week' | 'month'
		searchKeyword: string
	}
}

export function defaultState(): UploadState {
	return {
		tasks: [],
		activeTaskIds: new Set(),
		settings: {
			autoRetry: false,
			retryCount: 3,
			chunkedUpload: true,
			chunkSize: 2 * 1024 * 1024,
			notifications: true,
		},
		knowledgeBaseFilter: [],
		knowledgeBaseMap: new Map(),
		filters: {
			status: 'all',
			time: 'all',
			searchKeyword: '',
		},
	}
}

export function getLocalState(): UploadState {
	try {
		const stored = ss.get(STORAGE_KEY)
		if (!stored) return defaultState()
		const parsed = JSON.parse(stored)
		const now = Date.now()
		const defaultStateValue = defaultState()
		
		// 确保 tasks 是数组
		const tasks = Array.isArray(parsed.tasks) 
			? parsed.tasks.filter((task: UploadTask) => {
				if (task.status === 'success' || task.status === 'error') {
					return now - task.updatedAt < TASK_EXPIRY_TIME
				}
				return true
			})
			: []
		
		// 确保 activeTaskIds 是 Set
		const activeTaskIds = Array.isArray(parsed.activeTaskIds) 
			? new Set(parsed.activeTaskIds)
			: new Set()
		
		// 确保 filters 存在且结构正确
		const filters = parsed.filters && typeof parsed.filters === 'object'
			? {
				status: parsed.filters.status || defaultStateValue.filters.status,
				time: parsed.filters.time || defaultStateValue.filters.time,
				searchKeyword: parsed.filters.searchKeyword || defaultStateValue.filters.searchKeyword,
			}
			: defaultStateValue.filters
		
		return {
			...defaultStateValue,
			tasks,
			activeTaskIds,
			settings: parsed.settings || defaultStateValue.settings,
			knowledgeBaseFilter: Array.isArray(parsed.knowledgeBaseFilter) ? parsed.knowledgeBaseFilter : [],
			knowledgeBaseMap: parsed.knowledgeBaseMap && typeof parsed.knowledgeBaseMap === 'object'
				? new Map(Object.entries(parsed.knowledgeBaseMap))
				: new Map(),
			filters,
		}
	} catch (error) {
		console.error('恢复上传任务状态失败:', error)
		return defaultState()
	}
}

export function setLocalState(state: UploadState) {
	try {
		const serialized = JSON.stringify({
			...state,
			activeTaskIds: Array.from(state.activeTaskIds),
			knowledgeBaseMap: Object.fromEntries(state.knowledgeBaseMap),
			tasks: state.tasks.map(task => ({
				...task,
				file: undefined,
				xhr: undefined,
				chunks: undefined,
			})),
		})
		if (serialized.length > MAX_STORAGE_SIZE) {
			const sortedTasks = [...state.tasks].sort((a, b) => b.updatedAt - a.updatedAt)
			state.tasks = sortedTasks.slice(0, 50)
			const retry = JSON.stringify({
				...state,
				activeTaskIds: Array.from(state.activeTaskIds),
				knowledgeBaseMap: Object.fromEntries(state.knowledgeBaseMap),
				filters: state.filters || defaultState().filters,
				tasks: state.tasks.map(task => ({
					...task,
					file: undefined,
					xhr: undefined,
					chunks: undefined,
				})),
			})
			ss.set(STORAGE_KEY, retry)
		} else {
			ss.set(STORAGE_KEY, serialized)
		}
	} catch (error) {
		console.error('保存上传任务状态失败:', error)
	}
}
