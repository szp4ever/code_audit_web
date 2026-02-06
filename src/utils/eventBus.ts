import mitt, { Emitter } from 'mitt'

/**
 * 事件类型定义
 */
type Events = {
	/**
	 * 上传任务完成事件
	 * payload: { taskId: string, kid: string, attachId: number }
	 */
	'upload:task-completed': {
		taskId: string
		kid: string
		attachId: number
	}
}

/**
 * 全局事件总线实例
 */
export const eventBus: Emitter<Events> = mitt<Events>()
