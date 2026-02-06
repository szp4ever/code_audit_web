/**
 * 速率计算工具类
 * 使用指数移动平均（EMA）算法计算平滑的速率
 * 参考：https://stackoverflow.com/questions/18620038/calculating-bytes-per-second-the-smooth-way
 */

export interface SpeedMetrics {
	instant: number//瞬时速率（字节/秒）
	average: number//平均速率（字节/秒，从开始到现在）
	smoothed: number//平滑速率（字节/秒，使用EMA）
	eta: number//预计剩余时间（秒）
}

export class SpeedCalculator {
	private smoothingFactor: number = 0.1//EMA平滑因子（0-1之间，越小越平滑）
	private startTime: number = 0
	private lastUpdateTime: number = 0
	private lastBytes: number = 0
	private smoothedSpeed: number = 0
	private totalBytes: number = 0
	private samples: Array<{ time: number; bytes: number }> = []
	private readonly maxSamples: number = 30//保留最近30个样本用于计算

	/**
	 * 初始化速率计算器
	 * @param totalBytes 总字节数
	 * @param smoothingFactor EMA平滑因子（默认0.1，范围0-1）
	 */
	constructor(totalBytes: number, smoothingFactor: number = 0.1) {
		this.totalBytes = totalBytes
		this.smoothingFactor = Math.max(0.01, Math.min(1, smoothingFactor))
		this.reset()
	}

	/**
	 * 重置计算器
	 */
	reset(): void {
		this.startTime = Date.now()
		this.lastUpdateTime = this.startTime
		this.lastBytes = 0
		this.smoothedSpeed = 0
		this.samples = []
	}

	/**
	 * 更新进度并计算速率
	 * @param currentBytes 当前已传输/处理的字节数
	 * @returns 速率指标
	 */
	update(currentBytes: number): SpeedMetrics {
		const now = Date.now()
		const elapsed = (now - this.startTime) / 1000//总耗时（秒）
		const deltaTime = (now - this.lastUpdateTime) / 1000//距离上次更新的时间（秒）
		const deltaBytes = currentBytes - this.lastBytes//距离上次更新的字节数

		//计算瞬时速率（本次更新的速率）
		const instantSpeed = deltaTime > 0 ? deltaBytes / deltaTime : 0

		//计算平均速率（从开始到现在的平均）
		const averageSpeed = elapsed > 0 ? currentBytes / elapsed : 0

		//使用EMA计算平滑速率
		if (this.smoothedSpeed === 0) {
			//首次更新，直接使用瞬时速率
			this.smoothedSpeed = instantSpeed
		} else {
			//EMA公式：smoothed = factor * instant + (1 - factor) * smoothed
			this.smoothedSpeed = this.smoothingFactor * instantSpeed + (1 - this.smoothingFactor) * this.smoothedSpeed
		}

		//保存样本用于分析
		this.samples.push({ time: now, bytes: currentBytes })
		if (this.samples.length > this.maxSamples) {
			this.samples.shift()
		}

		//计算预计剩余时间（ETA）
		const remainingBytes = Math.max(0, this.totalBytes - currentBytes)
		const eta = this.smoothedSpeed > 0 ? remainingBytes / this.smoothedSpeed : 0

		//更新状态
		this.lastUpdateTime = now
		this.lastBytes = currentBytes

		return {
			instant: instantSpeed,
			average: averageSpeed,
			smoothed: this.smoothedSpeed,
			eta: eta
		}
	}

	/**
	 * 获取当前速率指标（不更新）
	 */
	getMetrics(): SpeedMetrics {
		const remainingBytes = Math.max(0, this.totalBytes - this.lastBytes)
		const eta = this.smoothedSpeed > 0 ? remainingBytes / this.smoothedSpeed : 0
		return {
			instant: 0,
			average: 0,
			smoothed: this.smoothedSpeed,
			eta: eta
		}
	}
}

/**
 * 格式化速率显示
 * @param bytesPerSecond 字节/秒
 * @returns 格式化后的字符串（如 "1.5 MB/s"）
 */
export function formatSpeed(bytesPerSecond: number): string {
	if (bytesPerSecond <= 0) return '0 B/s'
	if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`
	if (bytesPerSecond < 1024 * 1024) {
		return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
	}
	return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
}

/**
 * 格式化剩余时间显示
 * @param seconds 剩余秒数
 * @returns 格式化后的字符串（如 "2分30秒"）
 */
export function formatETA(seconds: number): string {
	if (seconds <= 0 || !isFinite(seconds)) return '计算中...'
	if (seconds < 60) return `${Math.round(seconds)}秒`
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = Math.round(seconds % 60)
	if (minutes < 60) {
		return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`
	}
	const hours = Math.floor(minutes / 60)
	const remainingMinutes = minutes % 60
	return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分钟` : `${hours}小时`
}
