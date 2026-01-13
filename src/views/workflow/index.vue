<script setup lang='ts'>
import { onMounted, ref, computed, reactive, nextTick, onUnmounted } from 'vue'
import { NInput, NButton, NLayout, NLayoutSider, NScrollbar, NEmpty, NModal, NTabs, NTab, NTabPane, useMessage } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { fetchWorkflowList } from '@/api/workflow'
import { workflowRun } from './runtime'
import workflowIcon from '@/assets/icons/workflow.svg'
import RuntimeNodes from './RuntimeNodes.vue'

interface WorkflowItem {
  id: string | number
  name: string
  desc?: string
  title?: string
  remark?: string
  uuid?: string
  isPublic?: boolean
  userId?: number
  userUuid?: string
  userName?: string
  nodes?: any[]
  edges?: any[]
  createTime?: string
  updateTime?: string
  isDeleted?: boolean
}

const workflows = ref<WorkflowItem[]>([])
const activeId = ref<string | number | null>(null)
const userInput = ref('')
const loading = ref(false)
const listLoading = ref(false)
const { isMobile } = useBasicLayout()
const collapsed = ref(false)
const title = computed(() => (activeWorkflow.value?.title || activeWorkflow.value?.name ? String(activeWorkflow.value.title || activeWorkflow.value.name) : '工作流'))

// 工作流执行相关状态
const submitting = ref(false)
const wfRuntimeUuid = ref<string>('')
const runtimeNodes = reactive<any[]>([])
const runtimeErrorMsg = ref<string>('')
const showCurrentExecution = ref<boolean>(false)
const tabObj = ref({ name: 'runtimes', defaultTab: '流程执行详情', tab: '流程执行详情 ↓' })
const ms = useMessage()
let controller = new AbortController()

function onBottomInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (!loading.value && userInput.value.trim()) handleSubmit()
  }
}

const detailVisible = ref(false)
const detailItem = ref<WorkflowItem | null>(null)
function openDetail(it: WorkflowItem) {
  detailItem.value = it
  detailVisible.value = true
}

const activeWorkflow = computed(() => workflows.value.find(w => String(w.id) === String(activeId.value)))

function setActive(it: WorkflowItem) {
  activeId.value = it.id
  // 切换工作流时清空执行状态
  runtimeNodes.splice(0, runtimeNodes.length)
  runtimeErrorMsg.value = ''
  showCurrentExecution.value = false
  wfRuntimeUuid.value = ''
  submitting.value = false
}

let loaded = false
async function loadWorkflows() {
  if (listLoading.value || loaded) return
  listLoading.value = true
  try {
    const res = await fetchWorkflowList({ currentPage: 1, pageSize: 20 })
    if (res?.data?.records) {
      workflows.value = res.data.records.map((item: any) => ({
        id: item.id,
        name: item.name,
        title: item.title,
        desc: item.remark,
        remark: item.remark,
        uuid: item.uuid,
        isPublic: item.isPublic,
        userId: item.userId,
        userUuid: item.userUuid,
        userName: item.userName,
        nodes: item.nodes,
        edges: item.edges,
        createTime: item.createTime,
        updateTime: item.updateTime,
        isDeleted: item.isDeleted,
      }))
      if (workflows.value.length > 0) {
        activeId.value = workflows.value[0].id
      }
    } else {
      // 示例数据
      workflows.value = [
        {
          id: 1,
          name: '示例工作流1',
          title: '示例工作流1',
          desc: '这是一个示例工作流',
          uuid: 'example-uuid-1',
          nodes: [{
            inputConfig: {
              userInputs: [{
                uuid: 'input-uuid-1',
                name: 'var_user_input',
                title: '用户输入',
                type: 1,
                required: false
              }]
            }
          }]
        },
        {
          id: 2,
          name: '示例工作流2',
          title: '示例工作流2',
          desc: '这是另一个示例工作流',
          uuid: 'example-uuid-2',
          nodes: [{
            inputConfig: {
              userInputs: [{
                uuid: 'input-uuid-2',
                name: 'var_user_input',
                title: '用户输入',
                type: 1,
                required: false
              }]
            }
          }]
        }
      ]
      activeId.value = workflows.value[0].id
    }
    loaded = true
  } catch (error) {
    console.error('加载工作流列表失败:', error)
  } finally {
    listLoading.value = false
  }
}

async function handleSubmit() {
  if (!activeId.value || !userInput.value.trim()) return
  const awf = activeWorkflow.value
  if (!awf || !awf.uuid) return

  if (submitting.value) return

  // 按要求：当 nodes 存在多个对象时，始终使用第一个对象的数据
  const node0: any = (awf.nodes && awf.nodes.length > 0) ? awf.nodes[0] : null
  const uis: any[] = node0?.inputConfig?.user_inputs || []
  console.log('node0', node0)
  console.log('uis', uis)
  const inputs = uis.map((u: any) => ({
    uuid: u.uuid,
    name: u.name,
    content: {
      title: u.title,
      value: userInput.value,
      type: u.type,
    },
    required: u.required,
  }))

  submitting.value = true
  loading.value = true
  showCurrentExecution.value = true
  tabObj.value.tab = showCurrentExecution.value ? `${tabObj.value.defaultTab} ↓` : `${tabObj.value.defaultTab} ↑`

  controller = new AbortController()
  try {
    wfRuntimeUuid.value = ''
    const nodeUuidToRuntimeNodeUuid = new Map<string, string>()
    runtimeNodes.splice(0, runtimeNodes.length)
    runtimeErrorMsg.value = ''

    await workflowRun({
      options: { uuid: awf.uuid as string, inputs },
      signal: controller.signal,
      startCallback: (wfRuntimeJson) => {
        if (!wfRuntimeJson) {
          ms.error('启动失败')
          return
        }
        const wfRuntime = JSON.parse(wfRuntimeJson)
        wfRuntime.input = {}
        inputs.forEach((item: any) => {
          wfRuntime.input[item.name] = { ...item.content }
        })
        wfRuntimeUuid.value = wfRuntime.uuid
        console.log('工作流启动成功:', wfRuntime)
      },
      thinkingDataReceived: (chunk) => {
        console.log('Thinking data received:', chunk)
      },
      messageReceived: (chunk, event) => {
        const eventName = event || ''
        try {
          if (eventName.includes('[NODE_RUN_')) {
            const nodeUuid = eventName.replace('[NODE_RUN_', '').replace(']', '')
            const runtimeNode = JSON.parse(chunk)
            nodeUuidToRuntimeNodeUuid.set(nodeUuid, runtimeNode.uuid)
            // 补充节点元信息（标题、组件），用于 UI 展示
            const wfNodeMeta = (awf?.nodes || []).find((n: any) => n.uuid === nodeUuid)
            if (wfNodeMeta) {
              ;(runtimeNode as any).nodeTitle = wfNodeMeta.title
              ;(runtimeNode as any).wfComponent = wfNodeMeta.wfComponent
            }
            runtimeNodes.push(runtimeNode)
          } else if (eventName.includes('[NODE_CHUNK_')) {
            console.log('NODE_CHUNK_', eventName, chunk)
            const nodeUuid = eventName.replace('[NODE_CHUNK_', '').replace(']', '')
            const runtimeNodeUuid = nodeUuidToRuntimeNodeUuid.get(nodeUuid) || ''
            const hit = runtimeNodes.find((n: any) => n.uuid === runtimeNodeUuid)
            if (hit) {
              ;(hit as any).chunks = ((hit as any).chunks || '') + chunk
            }
          } else if (eventName.includes('[NODE_INPUT_')) {
            const nodeUuid = eventName.replace('[NODE_INPUT_', '').replace(']', '')
            const runtimeNodeUuid = nodeUuidToRuntimeNodeUuid.get(nodeUuid) || ''
            const hit = runtimeNodes.find((n: any) => n.uuid === runtimeNodeUuid)
            if (hit) {
              const payload = JSON.parse(chunk)
              ;(hit as any).input = { ...(hit as any).input, [payload.name]: payload.content }
            }
          } else if (eventName.includes('[NODE_OUTPUT_')) {
            const nodeUuid = eventName.replace('[NODE_OUTPUT_', '').replace(']', '')
            const runtimeNodeUuid = nodeUuidToRuntimeNodeUuid.get(nodeUuid) || ''
            const hit = runtimeNodes.find((n: any) => n.uuid === runtimeNodeUuid)
            if (hit) {
              const payload = JSON.parse(chunk)
              ;(hit as any).output = { ...(hit as any).output, [payload.name]: payload.content }
            }
          }
        } catch (error) {
          console.error('处理消息时出错:', error)
        }
      },
      doneCallback: (chunk) => {
        nextTick(() => {
          submitting.value = false
          loading.value = false
          runtimeErrorMsg.value = ''
          ms.success('执行成功')
          console.log('工作流执行完成:', chunk)
        })
      },
      errorCallback: (error) => {
        submitting.value = false
        loading.value = false
        ms.error(`系统提示：${error}`)
        runtimeErrorMsg.value = error || ''
        console.error('工作流执行错误:', error)
      },
    })
  } catch (error: any) {
    const errorMessage = error?.message ?? '执行出错'
    ms.error(errorMessage)
    submitting.value = false
    loading.value = false
    runtimeErrorMsg.value = errorMessage
  }

  // 清空输入框
  userInput.value = ''
}

// 停止工作流执行
function handleStop() {
  if (submitting.value) {
    controller.abort()
    submitting.value = false
    loading.value = false
    ms.info('已停止执行')
  }
}

// 切换执行详情显示
function handleClick() {
  showCurrentExecution.value = !showCurrentExecution.value
  tabObj.value.tab = showCurrentExecution.value ? `${tabObj.value.defaultTab} ↓` : `${tabObj.value.defaultTab} ↑`
}

onMounted(loadWorkflows)

// 组件卸载时清理
onUnmounted(() => {
  if (submitting.value) {
    controller.abort()
  }
})
</script>

<template>
  <div class="h-full flex">
    <NLayout has-sider class="h-full w-full">
      <NLayoutSider
        bordered
        :collapsed="collapsed"
        :collapsed-width="0"
        :width="220"
        :show-trigger="isMobile ? false : 'arrow-circle'"
        collapse-mode="transform"
        @update-collapsed="(v:boolean)=> collapsed = v"
      >
        <div class="h-full flex flex-col workflow-sider">
          <NScrollbar class="flex-1" trigger="none">
          <div class="px-2 pb-2">
            <div class="flex justify-center mb-3 mt-2">
              <div class="wf-title-chip">工作流</div>
            </div>
            <template v-if="workflows.length">
              <div class="space-y-2">
                <div
                  v-for="it in workflows"
                  :key="it.id"
                  class="wf-card"
                  :class="[ activeId === it.id ? 'ring-1 ring-[#1677ff33] bg-[#f7fbff]' : '']"
                  @click="setActive(it)"
                >
                  <div class="flex items-start gap-2">
                    <img :src="workflowIcon" alt="workflow" width="18" height="18" class="mt-[2px]" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-2">
                        <div class="font-medium text-[13px] truncate">{{ it.title || it.name }}</div>
                        <NButton text size="small" @click.stop="openDetail(it)">
                          <SvgIcon icon="ri:information-line" />
                        </NButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <NEmpty description="暂无工作流" />
            </template>
          </div>
          </NScrollbar>
        </div>
      </NLayoutSider>

      <div class="flex-1 h-full flex flex-col bg-white dark:bg-white">
        <div class="workflow-divider" />
        <div class="flex items-center justify-between px-4 h-[56px] border-b border-neutral-200 bg-white dark:bg-white">
          <div class="font-medium text-neutral-800 truncate max-w-[70%]">{{ title }}</div>
        </div>
        <div class="flex-1 bg-white dark:bg-white overflow-auto">
          <div class="w-full max-w-[1100px] mx-auto px-6 py-10 h-full text-neutral-800">
            <div v-if="activeWorkflow">
              <!-- 工作流执行界面 -->
              <div class="w-full max-w-screen-xl m-auto z-10">
                <NTabs type="line" justify-content="space-evenly" animated default-value="runtimes">
                  <NTab name="runtimes" @click="handleClick">{{ tabObj.tab }}</NTab>
                </NTabs>
                <NTabs type="line" justify-content="space-evenly" animated>
                  <NTabPane name="runtimes" display-directive="show" :tab-props="{ style: 'display:none' }">
                    <transition name="collapse">
                      <div v-show="showCurrentExecution" class="max-h-[65vh] overflow-y-auto mb-2">
                        <RuntimeNodes
                          :nodes="runtimeNodes"
                          :workflow="activeWorkflow"
                          :error-msg="runtimeErrorMsg"
                          :token="''"
                        />
                        <div class="sticky bottom-0 left-0 flex justify-center">
                          <NButton v-show="submitting" size="tiny" @click="handleStop">
                            <template #icon><SvgIcon icon="ri:stop-circle-line" /></template>
                            停止请求
                          </NButton>
                        </div>
                      </div>
                    </transition>
                  </NTabPane>
                </NTabs>

                <!-- 等待执行提示 -->
                <div v-if="!showCurrentExecution && !submitting" class="text-center text-neutral-400 py-8">
                  请点击下方提交按钮开始执行工作流
                </div>

                <!-- 执行中提示 -->
                <div v-if="submitting && runtimeNodes.length === 0" class="text-center text-neutral-600 py-8">
                  <div class="flex items-center justify-center gap-2">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    工作流执行中...
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-neutral-400 select-none flex items-center justify-center h-full">请选择一个工作流</div>
          </div>
        </div>
        <!-- 底部问答框 -->
        <div class="px-6 bg-white dark:bg-white">
          <div class="w-full max-w-[1100px] mx-auto pt-6 pb-10">
          <div class="h-[1px] bg-neutral-200 mb-6"></div>
          <div class="flex items-end gap-3">
            <NInput
              v-model:value="userInput"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 6 }"
              placeholder="请输入内容，Enter 提交，Shift + Enter 换行"
              clearable
              @keydown="onBottomInputKeydown"
            />
            <NButton
              type="primary"
              :loading="loading"
              :disabled="!userInput.trim() || loading"
              circle
              @click="handleSubmit"
            >
              <template #icon>
                <SvgIcon icon="ri:send-plane-fill" />
              </template>
            </NButton>
          </div>
          </div>
        </div>
      </div>
    </NLayout>
  </div>

  <NModal
    v-model:show="detailVisible"
    preset="card"
    :title="detailItem?.title || detailItem?.name || '工作流详情'"
    :style="{ width: isMobile ? '90vw' : '700px' }"
    :mask-closable="true"
  >
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <div><span class="text-[14px] text-neutral-600">标题:</span> <span class="text-[13px]">{{ detailItem?.title }}</span></div>
        <div><span class="text-[14px] text-neutral-600">UUID:</span> <span class="text-[13px]">{{ detailItem?.uuid }}</span></div>
        <div><span class="text-[14px] text-neutral-600">备注:</span> <span class="text-[13px]">{{ detailItem?.remark || '无' }}</span></div>
        <div><span class="text-[14px] text-neutral-600">公开:</span> <span class="text-[13px]">{{ detailItem?.isPublic ? '是' : '否' }}</span></div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div><span class="text-[14px] text-neutral-600">创建时间:</span> <span class="text-[13px]">{{ detailItem?.createTime }}</span></div>
        <div><span class="text-[14px] text-neutral-600">更新时间:</span> <span class="text-[13px]">{{ detailItem?.updateTime }}</span></div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.workflow-sider {
  background: #fafafa;
}

.workflow-divider {
  height: 1px;
  background: #e5e5e5;
}

.wf-title-chip {
  background: #1677ff;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.wf-card {
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.wf-card:hover {
  border-color: #1677ff;
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.1);
}

.wf-card.ring-1 {
  border-color: #1677ff;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-clamp: 2;
}

/* 过渡动画 */

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  max-height: 60vh;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
