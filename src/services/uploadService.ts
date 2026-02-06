import { getToken } from '@/store/modules/auth/helper'
import { useUploadStore, type UploadTask } from '@/store/modules/upload'
import { getKnowledgeAttachInfo, getAttachProcessStatus } from '@/api/knowledge'
import { SpeedCalculator, formatSpeed, formatETA } from '@/utils/speedCalculator'
import { eventBus } from '@/utils/eventBus'

const CHUNK_SIZE = 2 * 1024 * 1024

export class UploadService {
	private store = useUploadStore()
	private processingPollingTimers: Map<string, number> = new Map()
	private uploadSpeedCalculators: Map<string, SpeedCalculator> = new Map()//上传阶段速率计算器
	private processingSpeedCalculators: Map<string, SpeedCalculator> = new Map()//处理阶段速率计算器

	async uploadTask(taskId: string) {
		const task = this.store.getTaskById(taskId)
		if (!task || !task.file) return

		if (task.status === 'uploading') return

		this.store.updateTask(taskId, { status: 'uploading' })

		try {
			if (this.store.settings.chunkedUpload && task.fileSize > CHUNK_SIZE) {
				await this.uploadWithChunks(taskId)
			} else {
				await this.uploadSingle(taskId)
			}
		} catch (error: any) {
			this.store.updateTask(taskId, {
				status: 'error',
				error: error?.message || '上传失败',
			})
		}
	}

	private async uploadSingle(taskId: string): Promise<void> {
		const task = this.store.getTaskById(taskId)
		if (!task || !task.file) {
			return
		}

		return new Promise((resolve, reject) => {
			const formData = new FormData()
			
			// 验证文件对象
			if (!task.file) {
				reject(new Error('文件对象不存在'))
				return
			}

			// 从Vue响应式代理对象中提取真正的File对象
			let actualFile: File;
			if (task.file instanceof File) {
				actualFile = task.file;
			} else if (task.file?.file instanceof File) {
				actualFile = task.file.file;
			} else {
				reject(new Error('文件对象格式不正确，无法提取File对象'));
				return;
			}

			formData.append('file', actualFile)
			formData.append('kid', task.kid || '')
			
			if (task.autoCreateItems !== undefined) {
				formData.append('autoCreateItems', String(task.autoCreateItems))
			}
			if (task.autoClassify !== undefined) {
				formData.append('autoClassify', String(task.autoClassify))
			}

			const xhr = new XMLHttpRequest()
			let isResolved = false//防止重复resolve
			let uploadCompleted = false//上传是否完成
			let responseReceived = false//响应是否已收到
			
			//使用readystatechange确保能捕获到响应（必须在open之前设置）
			const readystatechangeHandler = () => {
				if (xhr.readyState === XMLHttpRequest.DONE) {
					responseReceived = true
					if (xhr.status === 200) {
						try {
							const response = JSON.parse(xhr.responseText)
							if (response && (response.code === 200 || response.code === 0)) {
								const currentTask = this.store.getTaskById(taskId)
								// 从响应中获取processId（如果后端返回）
								const processId = response.data?.processId
								//更新状态，添加响应数据
								this.store.updateTask(taskId, {
									status: 'processing',
									progress: 0,
									processingProgress: 0,
									attachId: response.data?.id,
									docId: response.data?.docId,
									processId: processId,
									xhr: undefined,
								})
								if (response.data?.id) {
									this.startProcessingPolling(taskId, response.data.id)
								}
								if (!isResolved) {
									isResolved = true
									resolve()
								}
							} else {
								if (!isResolved) {
									isResolved = true
									const errorMsg = response?.msg || response?.message || '上传失败'
									reject(new Error(errorMsg))
								}
							}
						} catch (error) {
							if (!isResolved) {
								isResolved = true
								reject(new Error('解析响应失败'))
							}
						}
					} else {
						if (!isResolved) {
							isResolved = true
							try {
								const errorResponse = JSON.parse(xhr.responseText)
								const errorMsg = errorResponse?.msg || errorResponse?.message || `上传失败（HTTP ${xhr.status}）`
								reject(new Error(errorMsg))
							} catch {
								reject(new Error(`上传失败（HTTP ${xhr.status}）`))
							}
						}
					}
				}
			}
			xhr.onreadystatechange = readystatechangeHandler
			
			//监听上传完成事件（上传完成，但响应可能还没返回）
			xhr.upload.addEventListener('load', () => {
				uploadCompleted = true
				//上传完成后，立即切换到processing状态，等待响应
				const currentTask = this.store.getTaskById(taskId)
				if (currentTask && currentTask.status === 'uploading') {
					this.store.updateTask(taskId, {
						status: 'processing',
						progress: 0,
						processingProgress: 0,
						xhr: xhr,//保留xhr以便后续获取响应
					})
				}
				//如果此时响应已经返回，立即处理
				if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
					try {
						const response = JSON.parse(xhr.responseText)
						if (response && (response.code === 200 || response.code === 0)) {
							const processId = response.data?.processId
							this.store.updateTask(taskId, {
								status: 'processing',
								progress: 0,
								processingProgress: 0,
								attachId: response.data?.id,
								docId: response.data?.docId,
								processId: processId,
								xhr: undefined,
							})
							if (response.data?.id) {
								this.startProcessingPolling(taskId, response.data.id)
							}
							if (!isResolved) {
								isResolved = true
								resolve()
							}
						}
					} catch (e) {
					}
				} else {
					//设置超时检测：如果5秒后响应还没返回，主动检查
					setTimeout(() => {
						if (!responseReceived && xhr.readyState === XMLHttpRequest.DONE) {
							if (xhr.status === 200) {
								try {
									const response = JSON.parse(xhr.responseText)
									if (response && (response.code === 200 || response.code === 0)) {
										const processId = response.data?.processId
										this.store.updateTask(taskId, {
											attachId: response.data?.id,
											docId: response.data?.docId,
											processId: processId,
											xhr: undefined,
										})
										if (response.data?.id) {
											this.startProcessingPolling(taskId, response.data.id)
										}
										if (!isResolved) {
											isResolved = true
											resolve()
										}
									}
								} catch (e) {
								}
							}
						}
					}, 5000)
				}
			})

			xhr.upload.addEventListener('progress', (e) => {
				if (e.lengthComputable) {
					const percent = Math.round((e.loaded / e.total) * 100)
					const currentTask = this.store.getTaskById(taskId)
					if (currentTask && currentTask.status === 'uploading') {
						this.store.updateTask(taskId, {
							progress: percent,
							uploadedBytes: e.loaded,
						})
						//保护机制：如果进度达到100%但状态还是uploading，立即切换到processing
						//因为进度100%意味着上传已完成，即使响应还没返回
						if (percent === 100) {
							const currentTask = this.store.getTaskById(taskId)
							if (currentTask && currentTask.status === 'uploading') {
								this.store.updateTask(taskId, {
									status: 'processing',
									progress: 0,
									processingProgress: 0,
									xhr: xhr,//保留xhr以便后续获取响应
								})
							}
						}
					}
				}
			})

			xhr.addEventListener('load', () => {
				responseReceived = true
				//检查任务是否已经被readystatechange处理过
				const currentTask = this.store.getTaskById(taskId)
				if (currentTask && currentTask.status === 'processing' && currentTask.processId) {
					if (!isResolved) {
						isResolved = true
						resolve()
					}
					return
				}
				if (xhr.status === 200) {
					try {
						const response = JSON.parse(xhr.responseText)
						if (response && (response.code === 200 || response.code === 0)) {
							// 从响应中获取processId（如果后端返回）
							const processId = response.data?.processId
							//立即更新状态，确保界面立即切换
							this.store.updateTask(taskId, {
								status: 'processing',
								progress: 0,
								processingProgress: 0,
								attachId: response.data?.id,
								docId: response.data?.docId,
								processId: processId,
								xhr: undefined,
							})
							if (response.data?.id) {
								this.startProcessingPolling(taskId, response.data.id)
							}
							resolve()
						} else {
							// 提取后端返回的错误信息
							const errorMsg = response?.msg || response?.message || '上传失败'
							if (!isResolved) {
								isResolved = true
								reject(new Error(errorMsg))
							}
						}
					} catch (error) {
						reject(new Error('解析响应失败'))
					}
				} else {
					// 尝试解析错误响应
					if (!isResolved) {
						isResolved = true
						try {
							const errorResponse = JSON.parse(xhr.responseText)
							const errorMsg = errorResponse?.msg || errorResponse?.message || `上传失败（HTTP ${xhr.status}）`
							reject(new Error(errorMsg))
						} catch {
							reject(new Error(`上传失败（HTTP ${xhr.status}）`))
						}
					}
				}
			})
			
			xhr.addEventListener('error', (e) => {
				console.error('[上传事件] error事件触发:', {
					taskId,
					readyState: xhr.readyState,
					status: xhr.status,
					statusText: xhr.statusText,
					responseText: xhr.responseText?.substring(0, 200),
					event: e
				})
				if (!isResolved) {
					isResolved = true
					reject(new Error('网络错误'))
				}
			})
			
			xhr.addEventListener('timeout', () => {
				console.error('[上传事件] timeout事件触发:', {
					taskId,
					readyState: xhr.readyState,
					status: xhr.status
				})
				if (!isResolved) {
					isResolved = true
					reject(new Error('上传超时'))
				}
			})

			xhr.addEventListener('abort', () => {
				console.log('[上传事件] abort事件触发:', {
					taskId,
					readyState: xhr.readyState,
					status: xhr.status
				})
				if (!isResolved) {
					isResolved = true
					reject(new Error('已取消'))
				}
			})
			
			xhr.addEventListener('loadend', () => {
				console.log('[上传事件] loadend事件触发:', {
					taskId,
					readyState: xhr.readyState,
					status: xhr.status,
					statusText: xhr.statusText,
					responseText: xhr.responseText?.substring(0, 200),
					responseReceived
				})
			})

			// 使用环境变量中的baseURL，确保与项目其他API调用一致
			const baseURL = import.meta.env.VITE_GLOB_API_URL || ''
			const url = `${baseURL}/knowledge/attach/upload`
			
			xhr.open('POST', url, true)
			
			//设置超时时间（5分钟，因为后端处理可能需要较长时间）
			xhr.timeout = 5 * 60 * 1000
			
			const token = getToken()
			if (token) {
				xhr.setRequestHeader('Authorization', `Bearer ${token}`)
			}
			
			// 注意：不要手动设置Content-Type，浏览器会自动为FormData设置正确的multipart/form-data边界

			this.store.updateTask(taskId, { xhr })
			xhr.send(formData)
			
			//添加定期检查：每2秒检查一次响应是否已返回（作为readystatechange的备用方案）
			let checkCount = 0
			const checkInterval = setInterval(() => {
				if (responseReceived || isResolved) {
					clearInterval(checkInterval)
					return
				}
				checkCount++
				console.log('[上传事件] 定期检查状态:', {
					taskId,
					checkCount,
					responseReceived,
					isResolved,
					readyState: xhr.readyState,
					status: xhr.status,
					statusText: xhr.statusText,
					responseTextLength: xhr.responseText?.length || 0,
					uploadCompleted,
					hasOnreadystatechange: !!xhr.onreadystatechange,
					hasOnload: true,
					hasOnerror: true,
					hasOntimeout: true
				})
				
				//如果检查超过10次（20秒）仍然readyState为1，可能是后端处理时间过长或网络问题
				if (checkCount > 10 && xhr.readyState === 1) {
					console.warn('[上传事件] 警告：20秒后readyState仍为1，可能存在问题:', {
						taskId,
						readyState: xhr.readyState,
						status: xhr.status,
						可能原因: '后端处理时间过长或网络连接问题'
					})
				}
				if (xhr.readyState === XMLHttpRequest.DONE) {
					console.log('[上传事件] 定期检查：响应已返回，但readystatechange未触发，主动处理')
					clearInterval(checkInterval)
					responseReceived = true
					if (xhr.status === 200) {
						try {
							const response = JSON.parse(xhr.responseText)
							console.log('[上传事件] 定期检查解析响应:', {
								taskId,
								code: response?.code,
								hasData: !!response?.data,
								attachId: response?.data?.id,
								processId: response?.data?.processId
							})
							if (response && (response.code === 200 || response.code === 0)) {
								const processId = response.data?.processId
							this.store.updateTask(taskId, {
								status: 'processing',
								progress: 0,
								processingProgress: 0,
								attachId: response.data?.id,
								docId: response.data?.docId,
								processId: processId,
								xhr: undefined,
							})
								if (response.data?.id) {
									this.startProcessingPolling(taskId, response.data.id)
								}
								if (!isResolved) {
									isResolved = true
									resolve()
								}
							}
						} catch (e) {
							console.error('[上传事件] 定期检查处理响应失败:', {
								taskId,
								error: e,
								responseText: xhr.responseText?.substring(0, 200)
							})
						}
					} else {
						console.warn('[上传事件] 定期检查：HTTP状态不是200:', {
							taskId,
							status: xhr.status,
							statusText: xhr.statusText
						})
					}
				} else if (xhr.readyState > 1) {
					console.log('[上传事件] 定期检查：readyState变化:', {
						taskId,
						readyState: xhr.readyState,
						status: xhr.status
					})
				}
			}, 2000)
			
			//在请求完成或失败时清理定时器
			const cleanup = () => {
				clearInterval(checkInterval)
			}
			xhr.addEventListener('loadend', cleanup)
			xhr.addEventListener('error', cleanup)
			xhr.addEventListener('timeout', cleanup)
			xhr.addEventListener('abort', cleanup)
		})
	}

	private async uploadWithChunks(taskId: string): Promise<void> {
		const task = this.store.getTaskById(taskId)
		if (!task || !task.file) return

		// 如果后端不支持分片上传，降级到普通上传
		await this.uploadSingle(taskId)
	}

	private async uploadChunk(
		taskId: string,
		chunk: { index: number; blob: Blob },
		chunkIndex: number,
		totalChunks: number
	): Promise<void> {
		const task = this.store.getTaskById(taskId)
		if (!task) return

		return new Promise((resolve, reject) => {
			const formData = new FormData()
			formData.append('file', chunk.blob, `${task.fileName}.chunk.${chunkIndex}`)
			formData.append('kid', task.kid || '')
			formData.append('chunkIndex', String(chunkIndex))
			formData.append('totalChunks', String(totalChunks))
			formData.append('fileName', task.fileName)
			formData.append('fileSize', String(task.fileSize))
			if (task.autoCreateItems !== undefined) {
				formData.append('autoCreateItems', String(task.autoCreateItems))
			}
			if (task.autoClassify !== undefined) {
				formData.append('autoClassify', String(task.autoClassify))
			}

			const xhr = new XMLHttpRequest()

			xhr.addEventListener('load', () => {
				if (xhr.status === 200) {
					resolve()
				} else {
					reject(new Error(`分片 ${chunkIndex + 1}/${totalChunks} 上传失败`))
				}
			})

			xhr.addEventListener('error', () => {
				reject(new Error(`分片 ${chunkIndex + 1}/${totalChunks} 网络错误`))
			})

			xhr.addEventListener('abort', () => {
				reject(new Error('已取消'))
			})

			xhr.open('POST', '/api/knowledge/attach/upload-chunk')
			const token = getToken()
			if (token) {
				xhr.setRequestHeader('Authorization', `Bearer ${token}`)
			}

			xhr.send(formData)
		})
	}

	private async mergeChunks(taskId: string): Promise<void> {
		const task = this.store.getTaskById(taskId)
		if (!task) return

		return new Promise((resolve, reject) => {
			const formData = new FormData()
			formData.append('fileName', task.fileName)
			formData.append('kid', task.kid || '')
			formData.append('totalChunks', String(task.totalChunks || 0))
			if (task.autoCreateItems !== undefined) {
				formData.append('autoCreateItems', String(task.autoCreateItems))
			}
			if (task.autoClassify !== undefined) {
				formData.append('autoClassify', String(task.autoClassify))
			}

			const xhr = new XMLHttpRequest()

			xhr.addEventListener('load', () => {
				if (xhr.status === 200) {
					try {
						const response = JSON.parse(xhr.responseText)
						if (response && (response.code === 200 || response.code === 0)) {
							// 从响应中获取processId（如果后端返回）
							const processId = response.data?.processId
							this.store.updateTask(taskId, {
								status: 'processing',
								progress: 0,
								processingProgress: 0,
								attachId: response.data?.id,
								docId: response.data?.docId,
								processId: processId,
								xhr: undefined,
							})
							if (response.data?.id) {
								this.startProcessingPolling(taskId, response.data.id)
							}
							resolve()
						} else {
							reject(new Error(response?.msg || '合并分片失败'))
						}
					} catch (error) {
						reject(new Error('解析响应失败'))
					}
				} else {
					reject(new Error('合并分片失败'))
				}
			})

			xhr.addEventListener('error', () => {
				reject(new Error('网络错误'))
			})

			const baseURL = import.meta.env.VITE_GLOB_API_URL || ''
			xhr.open('POST', `${baseURL}/knowledge/attach/merge-chunks`)
			const token = getToken()
			if (token) {
				xhr.setRequestHeader('Authorization', `Bearer ${token}`)
			}

			xhr.send(formData)
		})
	}

	startProcessingPolling(taskId: string, attachId: number) {
		console.log('[轮询] startProcessingPolling调用:', {
			taskId,
			attachId,
			alreadyPolling: this.processingPollingTimers.has(taskId)
		})
		if (this.processingPollingTimers.has(taskId)) {
			console.log('[轮询] 任务已在轮询中，跳过')
			return
		}

		//不再需要前端计算处理阶段速率，后端已计算

		//根据任务状态动态调整轮询间隔：处理中任务更频繁，已完成/失败任务降低频率
		const getPollInterval = (task: UploadTask): number => {
			if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
				return 5000 //已完成/失败的任务，5秒轮询一次（用于最终状态确认）
			}
			if (task.status === 'user_review_matching' || task.status === 'user_review_items') {
				return 3000 //待审阅状态，3秒轮询一次
			}
			return 1000 //处理中任务，1秒轮询一次（更实时）
		}

		const poll = async () => {
			const task = this.store.getTaskById(taskId)
			if (!task) {
				this.stopProcessingPolling(taskId)
				return
			}

			console.log('[轮询] 开始轮询:', {
				taskId,
				processId: task.processId,
				attachId: task.attachId,
				status: task.status
			})

			// 如果任务有processId，使用新的状态管理API
			if (task.processId) {
				console.log('[轮询] 使用processId轮询:', task.processId)
				try {
					const result = await getAttachProcessStatus(task.processId, true)
					if (result && (result.code === 200 || result.code === 0)) {
						const processData = result.data
						const status = processData.currentStatus
						const statusMap: Record<string, string> = {
							'UPLOADING': 'uploading',
							'PARSING': 'parsing',
							'CHUNKING': 'chunking',
							'MATCHING': 'matching',
							'USER_REVIEW_MATCHING': 'user_review_matching',
							'CREATING_ITEMS': 'creating_items',
							'USER_REVIEW_ITEMS': 'user_review_items',
							'VECTORIZING': 'vectorizing',
							'COMPLETED': 'completed',
							'FAILED': 'failed',
							'CANCELLED': 'cancelled',
						}
						
						const frontendStatus = statusMap[status] || 'processing'
						
						//解析statusData获取详细进度信息
						let detailedProgress = processData.progress || 0
						if (processData.statusData) {
							try {
								const statusData = JSON.parse(processData.statusData)
								if (statusData.currentIndex !== undefined && statusData.totalCount !== undefined && statusData.totalCount > 0) {
									//基于实际处理数量计算细粒度进度
									detailedProgress = this.calculateDetailedProgress(status, statusData.currentIndex, statusData.totalCount)
								}
							} catch (e) {
								console.warn('解析statusData失败:', e)
							}
						}
						//如果没有详细进度，使用默认进度
						if (detailedProgress === 0 && status !== 'UPLOADING') {
							detailedProgress = this.getDefaultProgress(status)
						}
						
					//使用后端返回的速率和ETA（后端已计算，基于实际数据量）
					const processingSpeed = processData.processingSpeed || 0
					const speedUnit = processData.speedUnit || ''
					const processingETA = processData.eta || 0

					console.log('[轮询更新] 准备更新任务:', {
						taskId,
						fromStatus: task.status,
						toStatus: frontendStatus,
						processingStatus: status,
						processingProgress: detailedProgress,
						progress: task.progress,
						hasStatusData: !!processData.statusData,
						后端返回的progress: processData.progress,
						后端返回的statusData: processData.statusData,
						后端返回的processingSpeed: processingSpeed,
						后端返回的speedUnit: speedUnit,
						后端返回的eta: processingETA
					})
						this.store.updateTask(taskId, {
							status: frontendStatus as any,
							processingStatus: status,
							processingProgress: detailedProgress,
							progress: 0,//确保progress始终为0，避免显示100%
							attachProcessData: processData.statusData ? JSON.parse(processData.statusData) : undefined,
							docId: processData.docId || task.docId,
							processId: task.processId || String(processData.id),
							processingSpeed: processingSpeed,
							speedUnit: speedUnit,
							eta: processingETA,
							lastSpeedUpdateTime: Date.now()
						})
						const updatedTask = this.store.getTaskById(taskId)
						console.log('[轮询更新] 任务已更新:', {
							taskId,
							currentStatus: updatedTask?.status,
							progress: updatedTask?.progress,
							processingProgress: updatedTask?.processingProgress
						})

					if (status === 'COMPLETED') {
						this.store.updateTask(taskId, { status: 'completed' })
						this.stopProcessingPolling(taskId)
						this.store.activeTaskIds.delete(taskId)
						if (this.store.settings.notifications) {
							this.showNotification(task.fileName, 'success')
						}
						//触发任务完成事件，通知相关页面刷新列表
						const completedTask = this.store.getTaskById(taskId)
						if (completedTask?.kid && completedTask?.attachId) {
							eventBus.emit('upload:task-completed', {
								taskId,
								kid: completedTask.kid,
								attachId: completedTask.attachId,
							})
						}
					} else if (status === 'FAILED' || status === 'CANCELLED') {
							this.store.updateTask(taskId, {
								status: status === 'FAILED' ? 'failed' : 'cancelled',
								error: processData.errorMessage,
							})
							this.stopProcessingPolling(taskId)
						} else if (status === 'USER_REVIEW_MATCHING' || status === 'USER_REVIEW_ITEMS') {
							// 进入审阅状态，停止轮询（用户需要手动操作）
							this.stopProcessingPolling(taskId)
							if (this.store.settings.notifications) {
								this.showNotification(task.fileName, 'success')
							}
						}
					}
				} catch (error) {
				}
			} else {
				// 旧逻辑：使用attachInfo轮询
				if (task.status !== 'processing') {
					this.stopProcessingPolling(taskId)
					return
				}

				try {
					const result = await getKnowledgeAttachInfo(attachId)
					if (result && (result.code === 200 || result.code === 0)) {
						const attachInfo = result.data || result
						if (attachInfo.vectorStatus === 30) {
							this.store.updateTask(taskId, {
								status: 'success',
							})
							this.stopProcessingPolling(taskId)
							this.store.activeTaskIds.delete(taskId)
							if (this.store.settings.notifications) {
								this.showNotification(task.fileName, 'success')
							}
							//触发任务完成事件，通知相关页面刷新列表
							if (task.kid && task.attachId) {
								eventBus.emit('upload:task-completed', {
									taskId,
									kid: task.kid,
									attachId: task.attachId,
								})
							}
						}
					}
				} catch (error) {
				}
			}
			
			//动态调整下次轮询间隔
			const currentTask = this.store.getTaskById(taskId)
			if (currentTask) {
				const interval = getPollInterval(currentTask)
				setTimeout(poll, interval)
			} else {
				this.stopProcessingPolling(taskId)
			}
		}
		
		//立即执行第一次轮询
		poll()
		
		//记录轮询任务（用于停止，使用-1标记动态轮询）
		this.processingPollingTimers.set(taskId, -1 as any)
	}

	/**
	 * 基于实际处理数量计算细粒度进度
	 * 进度 = 阶段基础进度 + (阶段进度范围 * 阶段内进度百分比)
	 */
	private calculateDetailedProgress(status: string, currentIndex: number, totalCount: number): number {
		const stageProgress = Math.min(1.0, currentIndex / totalCount)
		
		//阶段基础进度和进度范围（与后端保持一致）
		const stageConfig: Record<string, { base: number; range: number }> = {
			'UPLOADING': { base: 0, range: 5 },
			'PARSING': { base: 5, range: 10 },
			'CHUNKING': { base: 15, range: 10 },
			'MATCHING': { base: 25, range: 25 },
			'USER_REVIEW_MATCHING': { base: 50, range: 10 },
			'CREATING_ITEMS': { base: 60, range: 15 },
			'USER_REVIEW_ITEMS': { base: 75, range: 10 },
			'VECTORIZING': { base: 85, range: 15 },
			'COMPLETED': { base: 100, range: 0 },
		}
		
		const config = stageConfig[status]
		if (config) {
			const detailedProgress = config.base + (config.range * stageProgress)
			return Math.min(100, Math.max(0, Math.round(detailedProgress)))
		}
		
		//降级：使用默认进度
		return this.getDefaultProgress(status)
	}

	/**
	 * 获取状态的默认进度（当没有详细进度信息时使用）
	 */
	private getDefaultProgress(status: string): number {
		const defaultProgress: Record<string, number> = {
			'UPLOADING': 5,
			'PARSING': 15,
			'CHUNKING': 25,
			'MATCHING': 50,
			'USER_REVIEW_MATCHING': 60,
			'CREATING_ITEMS': 75,
			'USER_REVIEW_ITEMS': 85,
			'VECTORIZING': 95,
			'COMPLETED': 100,
			'FAILED': 0,
			'CANCELLED': 0,
		}
		return defaultProgress[status] || 0
	}

	stopProcessingPolling(taskId: string) {
		const timer = this.processingPollingTimers.get(taskId)
		if (timer) {
			//如果是setInterval，清除它
			if (typeof timer === 'number' && timer > 0) {
				clearInterval(timer)
			}
			//-1表示动态轮询，不需要清除（通过不调用poll来停止）
			this.processingPollingTimers.delete(taskId)
		}
		//清理速率计算器
		this.uploadSpeedCalculators.delete(taskId)
	}

	private showNotification(fileName: string, type: 'success' | 'error') {
		if ('Notification' in window && Notification.permission === 'granted') {
			new Notification(type === 'success' ? '上传完成' : '上传失败', {
				body: fileName,
				icon: '/favicon.ico',
			})
		}
	}

	async requestNotificationPermission() {
		if ('Notification' in window && Notification.permission === 'default') {
			await Notification.requestPermission()
		}
	}

	stopAllPolling() {
		this.processingPollingTimers.forEach((timer, taskId) => {
			//如果是setInterval，清除它
			if (typeof timer === 'number' && timer > 0) {
				clearInterval(timer)
			}
			//-1表示动态轮询，通过删除timer来停止（poll函数会检查task是否存在）
		})
		this.processingPollingTimers.clear()
	}
}

export const uploadService = new UploadService()
