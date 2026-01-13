<script lang="ts" setup>
import { computed } from 'vue'
import { SvgIcon } from '@/components/common'

interface Props {
  nodes: any[]
  workflow: any
  errorMsg: string
  token?: string
}
const props = defineProps<Props>()

const prologue = computed(() => {
  const startNode = (props.workflow?.nodes || []).find((n: any) => n.wfComponent?.name === 'Start')
  return (startNode?.nodeConfig || {}).prologue || ''
})

function getRealFileUrl(fileUrl: string) {
  if (!fileUrl.includes('http') && !fileUrl.includes('/api')) return `/api${fileUrl}`
  return fileUrl
}
// 根据节点对象提取组件ID（兼容多种后端字段）
function getComponentId(node: any): number | string | undefined {
  return node?.workflowComponentId ?? node?.wfComponentId ?? node?.wfComponent?.id ?? node?.wfComponent?.componentId
}

// 根据组件ID映射一个简单的图标（不影响菜单，全局 SvgIcon 已用 iconify）
function getIconByComponentId(idRaw: number | string | undefined) {
  const id = String(idRaw || '')
  switch (id) {
    case '1': return 'carbon:play-outline' // 开始
    case '2': return 'carbon:closed-caption' // 结束
    case '3': return 'carbon:question-answering' // 生成回答
    case '4': return 'solar:pallete-2-linear' // 画图
    case '5': return 'carbon:ibm-knowledge-catalog-standard' // 文档提取
    case '6': return 'carbon:api-key' // 关键词
    case '7': return 'carbon:connect-target' // 知识检索
    case '8': return 'oui:logstash-if' // 条件
    case '9': return 'carbon:type-pattern' // 归类
    case '10': return 'carbon:prompt-template' // 模板
    case '11': return 'ri:google-line' // 搜索
    case '14': return 'covid:transmission-virus-human-transmit-2' // 人机交互
    case '15': return 'carbon:mail-all' // 邮件
    case '16': return 'carbon:http' // HTTP
    default: return 'ri:information-line'
  }
}

// 图片预览功能
function openImagePreview(imageUrl: string) {
  // 创建一个新窗口来预览图片
  const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
  if (newWindow) {
    newWindow.document.write(`
      <html>
        <head>
          <title>图片预览</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              background: #f5f5f5; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh;
            }
            img { 
              max-width: 100%; 
              max-height: 100%; 
              border-radius: 8px; 
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
          </style>
        </head>
        <body>
          <img src="${imageUrl}" alt="预览图片" />
        </body>
      </html>
    `)
    newWindow.document.close()
  }
}
</script>

<template>
  <div>
    <div v-if="errorMsg" class="py-2 text-red-500">错误：{{ errorMsg }}</div>
    <div v-else-if="nodes.length === 0" class="text-center py-2 text-neutral-400">无内容</div>
    <div v-show="prologue" class="p-2">{{ prologue }}</div>
    <div v-for="node in nodes" :key="node.uuid" class="flex flex-col space-y-2 border border-gray-200 p-2 m-2 rounded-md" :title="node.nodeTitle" :name="node.uuid">
      <div class="flex items-center space-x-2 bg-gray-100 px-2 py-1 rounded-md">
        <SvgIcon :icon="getIconByComponentId(getComponentId(node))" class="text-base" />
        <div class="text-base">{{ node.nodeTitle || '找不到节点标题' }}</div>
      </div>
      <div class="flex flex-col space-y-2">
        <div class="text-base border-b border-gray-200 py-1">输入</div>
        <div v-for="(content, name) in node.input" :key="`input_${name}`" class="flex">
          <div class="min-w-24 pr-2">{{ name }}</div>
          <div>{{ content.value || '无内容' }}</div>
        </div>
        <div class="text-base border-b border-gray-200 py-1">输出</div>
        <!-- 优先展示流式增量（chunks），用于未产出最终输出时的实时渲染 -->
        <div v-if="node.chunks" class="flex">
          <!-- <div class="min-w-24 pr-2">回复</div> -->
          <div class="whitespace-pre-wrap break-words">{{ node.chunks }}</div>
        </div>
        <div v-else v-for="(content, name) in node.output" :key="`onput_${name}`" class="flex">
          <template v-if="content.type === 4">
            <!-- 图片展示区域 -->
            <div class="flex flex-wrap gap-2">
              <div v-for="url in (Array.isArray(content.value) ? content.value : [content.value])" :key="String(url)" class="relative">
                <img 
                  :src="`${getRealFileUrl(String(url))}?token=${token || ''}`" 
                  :alt="String(name)"
                  class="w-24 h-24 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                  @click="() => openImagePreview(`${getRealFileUrl(String(url))}?token=${token || ''}`)"
                />
              </div>
            </div>
          </template>
          <template v-else>
            <div class="min-w-24 pr-2">{{ name }}</div>
            <div class="whitespace-pre-wrap break-words">{{ content.value || '无内容' }}</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>


