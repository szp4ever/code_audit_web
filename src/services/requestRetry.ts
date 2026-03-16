/**
 * 网络请求重试服务
 * 
 * 借鉴旧前端 Loading 组件的精华：
 * - 指数退避重试策略
 * - 最小加载时间（避免闪烁）
 * - 流畅的过渡动画
 */
import request from '@/utils/request/req'
import type { AxiosRequestConfig } from 'axios'

export interface RetryOptions {
  maxRetries?: number        // 最大重试次数，默认3
  retryDelay?: number        // 初始重试延迟，默认1000ms
  backoffMultiplier?: number // 退避乘数，默认2
  minLoadingTime?: number    // 最小加载时间，默认500ms
  retryCondition?: (error: any, attempt: number) => boolean  // 自定义重试条件
}

export interface RetryState {
  attempt: number
  isRetrying: boolean
  nextRetryDelay: number
  willRetry: boolean
}

// 默认重试条件：网络错误或5xx错误
const defaultRetryCondition = (error: any, attempt: number): boolean => {
  if (attempt >= 3) return false
  
  // 网络错误
  if (!error.response) return true
  
  // 5xx服务器错误
  if (error.response?.status >= 500) return true
  
  // 429请求过多
  if (error.response?.status === 429) return true
  
  return false
}

/**
 * 带重试的请求
 */
export async function requestWithRetry<T = any>(
  config: AxiosRequestConfig,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoffMultiplier = 2,
    minLoadingTime = 500,
    retryCondition = defaultRetryCondition
  } = options

  const startTime = Date.now()
  let lastError: any
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await request(config)
      
      // 确保最小加载时间
      const elapsed = Date.now() - startTime
      if (elapsed < minLoadingTime && attempt > 0) {
        await delay(minLoadingTime - elapsed)
      }
      
      return result as T
    } catch (error) {
      lastError = error
      
      // 检查是否应该重试
      if (attempt < maxRetries && retryCondition(error, attempt + 1)) {
        const delayTime = retryDelay * Math.pow(backoffMultiplier, attempt)
        
        console.warn(`[RequestRetry] Attempt ${attempt + 1} failed, retrying in ${delayTime}ms...`)
        await delay(delayTime)
      } else {
        // 不重试，抛出错误
        break
      }
    }
  }
  
  throw lastError
}

/**
 * 获取重试状态（用于UI展示）
 */
export function getRetryState(
  error: any,
  attempt: number,
  options: RetryOptions = {}
): RetryState {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoffMultiplier = 2,
    retryCondition = defaultRetryCondition
  } = options
  
  const willRetry = attempt < maxRetries && retryCondition(error, attempt + 1)
  const nextRetryDelay = willRetry 
    ? retryDelay * Math.pow(backoffMultiplier, attempt)
    : 0
  
  return {
    attempt: attempt + 1,
    isRetrying: willRetry,
    nextRetryDelay,
    willRetry
  }
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 创建自动重试的请求函数
 */
export function createRetryableRequest(defaultOptions: RetryOptions = {}) {
  return async function<T = any>(
    config: AxiosRequestConfig,
    options: RetryOptions = {}
  ): Promise<T> {
    return requestWithRetry<T>(config, { ...defaultOptions, ...options })
  }
}

// 预设配置
export const retryPresets = {
  // 重要操作（支付、提交）：少量重试，快速失败
  critical: {
    maxRetries: 1,
    retryDelay: 500,
    backoffMultiplier: 1
  },
  
  // 普通请求：标准重试
  standard: {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2
  },
  
  // 后台同步：大量重试，长延迟
  background: {
    maxRetries: 5,
    retryDelay: 2000,
    backoffMultiplier: 2
  },
  
  // 实时请求：不重试
  realtime: {
    maxRetries: 0
  }
}

// 带重试的API调用辅助函数
export async function fetchWithRetry<T>(
  url: string,
  params?: Record<string, any>,
  options?: RetryOptions
): Promise<T> {
  return requestWithRetry<T>({
    url,
    method: 'get',
    params
  }, options)
}

export async function postWithRetry<T>(
  url: string,
  data?: any,
  options?: RetryOptions
): Promise<T> {
  return requestWithRetry<T>({
    url,
    method: 'post',
    data
  }, options)
}

export async function putWithRetry<T>(
  url: string,
  data?: any,
  options?: RetryOptions
): Promise<T> {
  return requestWithRetry<T>({
    url,
    method: 'put',
    data
  }, options)
}

export async function deleteWithRetry<T>(
  url: string,
  options?: RetryOptions
): Promise<T> {
  return requestWithRetry<T>({
    url,
    method: 'delete'
  }, options)
}
