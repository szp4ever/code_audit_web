<script setup lang='ts'>
import { computed ,watch,ref, onMounted} from 'vue'
import { NInput, NPopconfirm, NScrollbar } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { gptConfigStore, gptConfigType, homeStore, useAppStore, useChatStore } from '@/store'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { debounce } from '@/utils/functions/debounce'
import { chatSetting, mlog } from '@/api'
import AiListText from '@/views/mj/aiListText.vue'
import { deleteSessions, listSessions, updateSession } from '@/api/session'
import { getUserInfo } from '@/api/user'
import { useRouter } from 'vue-router'

const { isMobile } = useBasicLayout()

const appStore = useAppStore()
const chatStore = useChatStore()
const router = useRouter()

const dataSources = computed(() => chatStore.history)
async function handleSelect({ uuid }: Chat.History) {
  if (isActive(uuid))
    return

  if (chatStore.active)
    chatStore.updateHistory(chatStore.active, { isEdit: false })
  await chatStore.setActive(uuid)

  if (isMobile.value)
    appStore.setSiderCollapsed(true)
}

async function handleEdit(item: Chat.History, isEdit: boolean, event?: MouseEvent) {
  event?.stopPropagation()
  // 当从编辑状态切回非编辑（即点击保存）时，调用修改接口更新标题
  if (item.isEdit && !isEdit) {
    try {
      const userInfo: any = await getUserInfo().catch(() => ({}))
      const userId = userInfo?.userId
      await updateSession({ id: Number(item.uuid), sessionTitle: item.title, userId })
    } catch (e) {
      // 修改失败时仍先退出编辑，避免交互卡住；必要时可提示
    }
  }
  chatStore.updateHistory(item.uuid, { isEdit })
}

async function handleDelete(index: number, event?: MouseEvent | TouchEvent) {
  event?.stopPropagation()
  const item = chatStore.history[index]
  const id = item?.uuid
  try {
    if (id) await deleteSessions(String(id))
  } catch (err) {
    // 删除失败时仍移除本地以避免卡顿，但可以根据需要提示
  }
  chatStore.deleteHistory(index)
  // 如果删除后没有会话，自动创建一个新的并激活
  if (!chatStore.history.length) {
    try {
      // 删除至空列表时，仅本地创建会话，后端留到首次发消息
      const localId = Date.now()
      chatStore.addHistory({ title: 'New Chat', uuid: localId, isEdit: false })
      await chatStore.setActive(localId)
      router.replace({ name: 'Chat', params: { uuid: localId } })
    } catch (e) {
      const localId = Date.now()
      chatStore.addHistory({ title: 'New Chat', uuid: localId, isEdit: false })
      await chatStore.setActive(localId)
      router.replace({ name: 'Chat', params: { uuid: localId } })
    }
  }
  if (isMobile.value)
    appStore.setSiderCollapsed(true)
}

const handleDeleteDebounce = debounce(handleDelete, 600)

async function handleEnter(item: Chat.History, isEdit: boolean, event: KeyboardEvent) {
  event?.stopPropagation()
  if (event.key === 'Enter') {
    try {
      const userInfo: any = await getUserInfo().catch(() => ({}))
      const userId = userInfo?.userId
      await updateSession({ id: Number(item.uuid), sessionTitle: item.title, userId })
    } catch (e) {
      // 修改失败兜底：仍退出编辑状态，避免交互阻塞
    }
    chatStore.updateHistory(item.uuid, { isEdit })
  }
}

function isActive(uuid: number) {
  return chatStore.active === uuid
}

const chatSet= new chatSetting( chatStore.active??1002);
const myuid= ref<gptConfigType[]>( []) //computed( ()=>chatSet.getObjs() ) ;
const toMyuid= ( )=> myuid.value= chatSet.getObjs();
toMyuid();
const isInObjs= (uuid:number):undefined|gptConfigType =>{
  if(!myuid.value.length) return ;
  const index = myuid.value.findIndex((item:gptConfigType)=>{
    return item.uuid==uuid
  })
  if(index==-1) return ;
  mlog('index',index, myuid.value[index]  );
  return myuid.value[index] ;
}
watch(()=>homeStore.myData.act,(n:string)=>n=='saveChat' && toMyuid() , {deep:true})
watch(()=>gptConfigStore.myData , toMyuid , {deep:true})

// 加载并合并用户的历史会话：保留本地新建会话，不把接口会话当作“新的”
async function loadUserSessions() {
  try {
    const res: any = await listSessions({ pageNum: 1, pageSize: 100, orderByColumn: 'updateTime', isAsc: 'desc' })
    const rows: any[] = res?.rows ?? res?.data?.rows ?? []
    if (!Array.isArray(rows) || rows.length === 0) return

    const remoteHistories: Chat.History[] = rows.map((r: any) => ({
      uuid: Number(r.id),
      // 远端会话缺少标题时，避免使用 'New Chat'，以免被识别为本地新建会话
      title: r.sessionTitle || '历史会话',
      isEdit: false,
    }))
    const remoteChats: { uuid: number; data: Chat.Chat[] }[] = remoteHistories.map((h) => ({ uuid: h.uuid, data: [] }))

    const localHistories = chatStore.history
    const localChats = chatStore.chat
    const localIds = new Set(localHistories.map(h => h.uuid))

    // 仅合并远端中本地不存在的会话，保留现有本地新建的空会话
    const mergedHistories = [
      ...localHistories,
      ...remoteHistories.filter(h => !localIds.has(h.uuid)),
    ]
    const mergedChats = [
      ...localChats,
      ...remoteChats.filter(c => !localIds.has(c.uuid)),
    ]

    const prevActive = chatStore.active
    chatStore.$patch((state: any) => {
      state.history = mergedHistories
      state.chat = mergedChats
      state.active = prevActive
    })
    // 不跳转路由，避免覆盖进入 Chat 页面时本地新建的空会话
  } catch (e) {
    // 接口不可用则保留本地默认会话
  }
}

onMounted(() => {
  loadUserSessions()
})

</script>

<template>
  <NScrollbar class="px-4 chat-history">
    <div class="flex flex-col gap-2 text-sm">
      <p class="history-title">{{ $t('common.history')}}</p>
      <template v-if="!dataSources.length">
        <div class="flex flex-col items-center mt-4 text-center text-neutral-300">
          <SvgIcon icon="ri:inbox-line" class="mb-2 text-3xl" />
          <span>{{ $t('common.noData') }}</span>
        </div>
      </template>
      <template v-else>
        <div v-for="(item, index) of dataSources" :key="index">
          <a
            class="relative flex items-center gap-3 px-3 py-3 break-all border rounded-md cursor-pointer hover:bg-neutral-100 group dark:border-neutral-800 dark:hover:bg-[#24272e] chat-item"
            :class="isActive(item.uuid) && ['check-chat-item']"
            @click="handleSelect(item)"
          >
             
             <AiListText   :myObj="isInObjs(item.uuid)" :myItem="item" :index="index">
               <NInput
               style="width: 226px"
                v-if="item.isEdit"
                v-model:value="item.title" size="small"
                @keypress="handleEnter(item, false, $event)"
              />
             </AiListText>
            <div v-if="isActive(item.uuid)" class="absolute z-10 flex visible right-1">
              <template v-if="item.isEdit">
                <button class="p-1" @click="handleEdit(item, false, $event)">
                  <SvgIcon icon="ri:save-line" />
                </button>
              </template>
              <template v-else>
                <button class="p-1">
                  <SvgIcon icon="ri:edit-line" width="18px" height="18px" @click="handleEdit(item, true, $event)" />
                </button>
                <NPopconfirm placement="bottom" @positive-click="handleDeleteDebounce(index, $event)">
                  <template #trigger>
                    <button class="p-1">
                      <SvgIcon icon="ri:delete-bin-line" width="16px" height="16px" />
                    </button>
                  </template>
                  {{ $t('chat.deleteHistoryConfirm') }}
                </NPopconfirm>
              </template>
            </div>
          </a>
        </div>
      </template>
    </div>
  </NScrollbar>
</template>
