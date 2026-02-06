import { defineStore } from 'pinia'
import { defaultState, getLocalState, setLocalState, type UploadTask, type UploadState } from './helper'

export const useUploadStore = defineStore('upload-store', {
	state: (): UploadState => getLocalState(),

	getters: {
		activeTasks(state: UploadState): UploadTask[] {
			return state.tasks.filter(task => 
				task.status === 'uploading' || task.status === 'processing' || task.status === 'waiting'
				|| task.status === 'parsing' || task.status === 'chunking' || task.status === 'matching'
				|| task.status === 'creating_items' || task.status === 'vectorizing'
				|| task.status === 'user_review_matching' || task.status === 'user_review_items'
			)
		},
		uploadingTasks(state: UploadState): UploadTask[] {
			return state.tasks.filter(task => 
				task.status === 'uploading' || task.status === 'waiting'
			)
		},
		processingTasks(state: UploadState): UploadTask[] {
			return state.tasks.filter(task => 
				task.status === 'processing' || task.status === 'parsing' 
				|| task.status === 'chunking' || task.status === 'matching'
				|| task.status === 'creating_items' || task.status === 'vectorizing'
			)
		},
		pendingReviewTasks(state: UploadState): UploadTask[] {
			return state.tasks.filter(task => 
				task.status === 'user_review_matching' || task.status === 'user_review_items'
			)
		},
		successTasks(state: UploadState): UploadTask[] {
			return state.tasks.filter(task => 
				task.status === 'success' || task.status === 'completed'
			)
		},
		errorTasks(state: UploadState): UploadTask[] {
			return state.tasks.filter(task => 
				task.status === 'error' || task.status === 'failed' || task.status === 'cancelled'
			)
		},
		waitingTasks(state: UploadState): UploadTask[] {
			return state.tasks.filter(task => task.status === 'waiting')
		},
		activeTaskCount(): number {
			return this.activeTasks.length
		},
		pendingReviewCount(): number {
			return this.pendingReviewTasks.length
		},
		getTaskById(state: UploadState) {
			return (id: string) => state.tasks.find(task => task.id === id)
		},
		getKnowledgeBaseName(state: UploadState) {
			return (kid: string) => state.knowledgeBaseMap.get(kid) || ''
		},
		applyFilters(): (tasks: UploadTask[]) => UploadTask[] {
			const filters = this.filters
			return (tasks: UploadTask[]): UploadTask[] => {
				if (!Array.isArray(tasks)) {
					return []
				}
				let filtered = [...tasks]
				
				// 状态筛选
				if (filters.status !== 'all') {
					filtered = filtered.filter(task => {
						switch (filters.status) {
							case 'active':
								return task.status === 'uploading' || task.status === 'processing' || task.status === 'waiting'
									|| task.status === 'parsing' || task.status === 'chunking' || task.status === 'matching'
									|| task.status === 'creating_items' || task.status === 'vectorizing'
							case 'pending':
								return task.status === 'user_review_matching' || task.status === 'user_review_items'
							case 'completed':
								return task.status === 'success' || task.status === 'completed'
							case 'failed':
								return task.status === 'error' || task.status === 'failed' || task.status === 'cancelled'
							default:
								return true
						}
					})
				}
				
				// 时间筛选
				if (filters.time !== 'all') {
					const now = Date.now()
					const timeRanges: Record<string, number> = {
						today: 24 * 60 * 60 * 1000,
						week: 7 * 24 * 60 * 60 * 1000,
						month: 30 * 24 * 60 * 60 * 1000,
					}
					const range = timeRanges[filters.time] || 0
					const cutoff = now - range
					filtered = filtered.filter(task => task.createdAt >= cutoff)
				}
				
				// 文件名搜索
				if (filters.searchKeyword && filters.searchKeyword.trim()) {
					const keyword = filters.searchKeyword.toLowerCase().trim()
					filtered = filtered.filter(task => 
						task.fileName && task.fileName.toLowerCase().includes(keyword)
					)
				}
				
				return filtered
			}
		},
		groupedTasksByKnowledgeBase(): Map<string, UploadTask[]> {
			const grouped = new Map<string, UploadTask[]>()
			if (!Array.isArray(this.tasks)) {
				return grouped
			}
			const filters = this.filters
			let tasks = [...this.tasks]
			
			// 状态筛选
			if (filters.status !== 'all') {
				tasks = tasks.filter(task => {
					switch (filters.status) {
						case 'active':
							return task.status === 'uploading' || task.status === 'processing' || task.status === 'waiting'
								|| task.status === 'parsing' || task.status === 'chunking' || task.status === 'matching'
								|| task.status === 'creating_items' || task.status === 'vectorizing'
						case 'pending':
							return task.status === 'user_review_matching' || task.status === 'user_review_items'
						case 'completed':
							return task.status === 'success' || task.status === 'completed'
						case 'failed':
							return task.status === 'error' || task.status === 'failed' || task.status === 'cancelled'
						default:
							return true
					}
				})
			}
			
			// 时间筛选
			if (filters.time !== 'all') {
				const now = Date.now()
				const timeRanges: Record<string, number> = {
					today: 24 * 60 * 60 * 1000,
					week: 7 * 24 * 60 * 60 * 1000,
					month: 30 * 24 * 60 * 60 * 1000,
				}
				const range = timeRanges[filters.time] || 0
				const cutoff = now - range
				tasks = tasks.filter(task => task.createdAt >= cutoff)
			}
			
			// 文件名搜索
			if (filters.searchKeyword && filters.searchKeyword.trim()) {
				const keyword = filters.searchKeyword.toLowerCase().trim()
				tasks = tasks.filter(task => 
					task.fileName && task.fileName.toLowerCase().includes(keyword)
				)
			}
			
			tasks.forEach(task => {
				const kid = task.kid || '__UNKNOWN__'
				if (!grouped.has(kid)) {
					grouped.set(kid, [])
				}
				grouped.get(kid)!.push(task)
			})
			
			return grouped
		},
		groupStats() {
			return (kid: string) => {
				if (!Array.isArray(this.tasks)) {
					return { total: 0, active: 0, completed: 0, failed: 0, pending: 0 }
				}
				const filters = this.filters
				let tasks = this.tasks.filter(t => (t.kid || '__UNKNOWN__') === kid)
				
				// 状态筛选
				if (filters.status !== 'all') {
					tasks = tasks.filter(task => {
						switch (filters.status) {
							case 'active':
								return task.status === 'uploading' || task.status === 'processing' || task.status === 'waiting'
									|| task.status === 'parsing' || task.status === 'chunking' || task.status === 'matching'
									|| task.status === 'creating_items' || task.status === 'vectorizing'
							case 'pending':
								return task.status === 'user_review_matching' || task.status === 'user_review_items'
							case 'completed':
								return task.status === 'success' || task.status === 'completed'
							case 'failed':
								return task.status === 'error' || task.status === 'failed' || task.status === 'cancelled'
							default:
								return true
						}
					})
				}
				
				// 时间筛选
				if (filters.time !== 'all') {
					const now = Date.now()
					const timeRanges: Record<string, number> = {
						today: 24 * 60 * 60 * 1000,
						week: 7 * 24 * 60 * 60 * 1000,
						month: 30 * 24 * 60 * 60 * 1000,
					}
					const range = timeRanges[filters.time] || 0
					const cutoff = now - range
					tasks = tasks.filter(task => task.createdAt >= cutoff)
				}
				
				// 文件名搜索
				if (filters.searchKeyword && filters.searchKeyword.trim()) {
					const keyword = filters.searchKeyword.toLowerCase().trim()
					tasks = tasks.filter(task => 
						task.fileName && task.fileName.toLowerCase().includes(keyword)
					)
				}
				
				const isActiveTask = (task: UploadTask) => 
					task.status === 'uploading' || task.status === 'processing' || task.status === 'waiting'
					|| task.status === 'parsing' || task.status === 'chunking' || task.status === 'matching'
					|| task.status === 'creating_items' || task.status === 'vectorizing'
					|| task.status === 'user_review_matching' || task.status === 'user_review_items'
				
				const isCompletedTask = (task: UploadTask) => 
					task.status === 'success' || task.status === 'completed'
				
				const isFailedTask = (task: UploadTask) => 
					task.status === 'error' || task.status === 'failed' || task.status === 'cancelled'
				
				const isPendingReviewTask = (task: UploadTask) => 
					task.status === 'user_review_matching' || task.status === 'user_review_items'
				
				return {
					total: tasks.length,
					active: tasks.filter(isActiveTask).length,
					completed: tasks.filter(isCompletedTask).length,
					failed: tasks.filter(isFailedTask).length,
					pending: tasks.filter(isPendingReviewTask).length,
				}
			}
		},
	},

	actions: {
		addTask(task: Omit<UploadTask, 'id' | 'createdAt' | 'updatedAt' | 'retryCount' | 'progress' | 'uploadedBytes'>): string {
			const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
			const newTask: UploadTask = {
				...task,
				id,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				retryCount: 0,
				progress: 0,
				uploadedBytes: 0,
				status: 'waiting',
			}
			this.tasks.unshift(newTask)
			this.activeTaskIds.add(id)
			this.recordState()
			return id
		},

		updateTask(id: string, updates: Partial<UploadTask>) {
			const index = this.tasks.findIndex(task => task.id === id)
			if (index !== -1) {
				this.tasks[index] = {
					...this.tasks[index],
					...updates,
					updatedAt: Date.now(),
				}
				this.recordState()
			}
		},

		removeTask(id: string) {
			const index = this.tasks.findIndex(task => task.id === id)
			if (index !== -1) {
				this.tasks.splice(index, 1)
				this.activeTaskIds.delete(id)
				this.recordState()
			}
		},

		removeTasksByDocId(docId: string, kid?: string) {
			const tasksToRemove = this.tasks.filter(task => 
				task.docId === docId && (!kid || task.kid === kid)
			)
			tasksToRemove.forEach(task => {
				this.removeTask(task.id)
			})
			return tasksToRemove.length
		},

		removeTasksByFileName(fileName: string, kid?: string) {
			const tasksToRemove = this.tasks.filter(task => 
				task.fileName === fileName && (!kid || task.kid === kid)
			)
			tasksToRemove.forEach(task => {
				this.removeTask(task.id)
			})
			return tasksToRemove.length
		},

		clearCompletedTasks() {
			this.tasks = this.tasks.filter(task => 
				task.status !== 'success' && task.status !== 'completed'
			)
			this.recordState()
		},

		clearErrorTasks() {
			this.tasks = this.tasks.filter(task => 
				task.status !== 'error' && task.status !== 'failed' && task.status !== 'cancelled'
			)
			this.recordState()
		},

		cancelTask(id: string) {
			const task = this.getTaskById(id)
			if (task && task.xhr) {
				task.xhr.abort()
			}
			//取消就是删除：直接移除任务，不再保留在"已失败"列表中
			//注意：后端删除逻辑由调用方（如handleRemove）负责执行
			this.removeTask(id)
		},

		retryTask(id: string) {
			const task = this.getTaskById(id)
			if (task) {
				this.updateTask(id, {
					status: 'waiting',
					progress: 0,
					uploadedBytes: 0,
					error: undefined,
					retryCount: task.retryCount + 1,
					xhr: undefined,
				})
				this.activeTaskIds.add(id)
			}
		},

		updateSettings(settings: Partial<UploadState['settings']>) {
			this.settings = { ...this.settings, ...settings }
			this.recordState()
		},

		recordState() {
			setLocalState({
				tasks: this.tasks,
				activeTaskIds: this.activeTaskIds,
				settings: this.settings,
				knowledgeBaseFilter: this.knowledgeBaseFilter,
				knowledgeBaseMap: this.knowledgeBaseMap,
				filters: this.filters,
			})
		},

		restoreTasks() {
			const state = getLocalState()
			this.tasks = state.tasks
			this.activeTaskIds = state.activeTaskIds
			this.settings = state.settings
			this.knowledgeBaseFilter = state.knowledgeBaseFilter || []
			this.filters = state.filters || defaultState().filters
			if (state.knowledgeBaseMap && typeof state.knowledgeBaseMap === 'object' && !(state.knowledgeBaseMap instanceof Map)) {
				this.knowledgeBaseMap = new Map(Object.entries(state.knowledgeBaseMap))
			} else if (state.knowledgeBaseMap instanceof Map) {
				this.knowledgeBaseMap = state.knowledgeBaseMap
			} else {
				this.knowledgeBaseMap = new Map()
			}
		},

		setKnowledgeBaseFilter(kids: string[]) {
			this.knowledgeBaseFilter = kids
		},

		setKnowledgeBaseMap(map: Map<string, string>) {
			this.knowledgeBaseMap = map
		},
		setFilters(filters: Partial<UploadState['filters']>) {
			this.filters = { ...this.filters, ...filters }
			this.recordState()
		},
		clearFilters() {
			this.filters = {
				status: 'all',
				time: 'all',
				searchKeyword: '',
			}
			this.recordState()
		},
	},
})
