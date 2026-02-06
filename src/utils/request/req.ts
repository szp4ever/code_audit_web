import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { useUserStore } from '@/store/modules/user';
import { getToken } from '@/store/modules/auth/helper'
import { tansParams } from '@/utils/ruoyi';
import cache from '@/plugins/cache';
import { HttpStatus } from '@/enums/RespEnum';
import { errorCode } from '@/utils/errorCode';
import { ElMessage,ElNotification } from 'element-plus'
import { createDiscreteApi} from "naive-ui"
const {message} = createDiscreteApi(["message"])


// 是否显示重新登录
export const isRelogin = { show: false };

axios.defaults.headers['Content-Type'] = 'application/json;charset=utf-8';
// 创建 axios 实例
const service = axios.create({
  baseURL: import.meta.env.VITE_GLOB_API_URL,
  timeout: 300000,
  // 自定义请求数据转换，处理大整数精度问题
  transformRequest: [(data) => {
    // FormData不需要序列化，直接返回
    if (data instanceof FormData) {
      return data;
    }
    if (typeof data === 'object' && data !== null) {
      // 使用自定义序列化函数处理大整数
      // 对于超过安全整数范围的字段，转换为字符串
      // 后端 Jackson 应该能够将字符串反序列化为 Long
      return JSON.stringify(data, (key, value) => {
        // 如果值是大整数（超过安全整数范围），转换为字符串
        if (typeof value === 'number' && value > Number.MAX_SAFE_INTEGER) {
          return String(value);
        }
        // 如果值已经是字符串，且看起来像大整数，保持为字符串
        if (typeof value === 'string' && /^\d{16,}$/.test(value)) {
          const numValue = Number(value);
          if (numValue > Number.MAX_SAFE_INTEGER) {
            return value;
          }
        }
        return value;
      });
    }
    return data;
  }]
});


// 请求拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.url?.includes('llm/test-extract')) {
      const fullUrl = `${config.baseURL || ''}${config.url}`
      console.log('[请求拦截器] LLM测试请求 - 完整URL:', fullUrl)
      console.log('[请求拦截器] LLM测试请求 - baseURL:', config.baseURL)
      console.log('[请求拦截器] LLM测试请求 - url:', config.url)
      console.log('[请求拦截器] LLM测试请求 - data:', config.data)
    }

    const isToken = (config.headers || {}).isToken === false;
    // 是否需要防止数据重复提交
    const isRepeatSubmit = (config.headers || {}).repeatSubmit === false;
    if (getToken() && !isToken) {
      config.headers['Authorization'] = 'Bearer ' + getToken(); // 让每个请求携带自定义token 请根据实际情况自行修改
    }
    // get请求映射params参数
    if (config.method === 'get' && config.params) {
      let url = config.url + '?' + tansParams(config.params);
      url = url.slice(0, -1);
      config.params = {};
      config.url = url;
    }

    if (!isRepeatSubmit && (config.method === 'post' || config.method === 'put')) {
      // 自定义 JSON 序列化，处理大整数精度问题（用于重复提交检查）
      const serializeData = (data: any): string => {
        return JSON.stringify(data, (key, value) => {
          // 如果值是大整数（超过安全整数范围），转换为字符串
          // 注意：只对 embeddingModelId 字段进行转换，因为后端可能期望其他字段是数字
          if (key === 'embeddingModelId' && typeof value === 'number' && value > Number.MAX_SAFE_INTEGER) {
            return String(value);
          }
          return value;
        });
      };
      const requestObj = {
        url: config.url,
        data: typeof config.data === 'object' ? serializeData(config.data) : config.data,
        time: new Date().getTime()
      };
      const sessionObj = cache.session.getJSON('sessionObj');
      if (sessionObj === undefined || sessionObj === null || sessionObj === '') {
        cache.session.setJSON('sessionObj', requestObj);
      } else {
        const s_url = sessionObj.url; // 请求地址
        const s_data = sessionObj.data; // 请求数据
        const s_time = sessionObj.time; // 请求时间
        const interval = 500; // 间隔时间(ms)，小于此时间视为重复提交
        if (s_data === requestObj.data && requestObj.time - s_time < interval && s_url === requestObj.url) {
          const message = '数据正在处理，请勿重复提交';
          return Promise.reject(new Error(message));
        } else {
          cache.session.setJSON('sessionObj', requestObj);
        }
      }
    }
    // FormData数据去请求头Content-Type
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error: any) => {
    console.log(error);
    return Promise.reject(error);
  }
);

// 响应拦截器
service.interceptors.response.use(
  (res: AxiosResponse) => {
    if (res.config.url?.includes('llm/test-extract')) {
      console.log('[响应拦截器] LLM测试响应 - 状态码:', res.status)
      console.log('[响应拦截器] LLM测试响应 - 完整响应:', res)
      console.log('[响应拦截器] LLM测试响应 - data:', res.data)
    }
    // 未设置状态码则默认成功状态
    const code = res.data.code || HttpStatus.SUCCESS;
    // 获取错误信息
    const msg = errorCode[code] || res.data.msg || errorCode['default'];
    // 二进制数据则直接返回
    if (res.request.responseType === 'blob' || res.request.responseType === 'arraybuffer') {
      return res.data;
    }
    if (code === 401) {
      // 退出登录
      message.error('无效的会话，或者会话已过期，请重新登录。')
      useUserStore().logout().then(() => {
          location.href = '#/login';
      });
    } else if (code === HttpStatus.SERVER_ERROR) {
      const error = new Error(msg);
      (error as any).responseData = res.data;
      (error as any).originalCode = code;
      return Promise.reject(error);
    } else if (code === HttpStatus.WARN) {
      ElMessage({ message: msg, type: 'warning' });
      return Promise.reject(new Error(msg));
    } else if (code !== HttpStatus.SUCCESS) {
      ElNotification.error({ title: msg });
      return Promise.reject('error');
    } else {
      return Promise.resolve(res.data);
    }
  },
  (error: any) => {
    if (error.config?.url?.includes('llm/test-extract')) {
      console.error('[响应拦截器] LLM测试错误 - 错误对象:', error)
      console.error('[响应拦截器] LLM测试错误 - 响应:', error.response)
      console.error('[响应拦截器] LLM测试错误 - 状态码:', error.response?.status)
      console.error('[响应拦截器] LLM测试错误 - 错误数据:', error.response?.data)
    }
    let { message } = error;
    if (message == 'Network Error') {
      message = '后端接口连接异常';
    } else if (message.includes('timeout')) {
      message = '系统接口请求超时';
    } else if (message.includes('Request failed with status code')) {
      message = '系统接口' + message.substr(message.length - 3) + '异常';
    }
    ElMessage({ message: message, type: 'error', duration: 5 * 1000 });
    return Promise.reject(error);
  }
);
// 导出 axios 实例
export default service;
