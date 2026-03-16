<script setup lang="ts">
/**
 * 设置 Tab（v2）
 *
 * 功能：加载知识库当前配置、分区表单编辑、脏数据检测、保存/重置、
 *       字段与后端 KnowledgeInfoBo 完全对齐
 */
import { ref, reactive, computed, inject, onMounted, watch } from 'vue'
import type { Ref } from 'vue'
import {
  NForm, NFormItem, NInput, NInputNumber, NSelect, NSwitch,
  NButton, NSpace, NDivider, NSlider, NTooltip, NSpin, NAlert,
  useMessage, useDialog,
} from 'naive-ui'
import type { FormInst, FormRules, SelectOption } from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import {
  getKnowledgeBase,
  updateKnowledgeBase,
  type KnowledgeBaseForm,
  type KnowledgeBaseVo,
} from '@/api/v2/knowledgeBase'
import { getDictDataByType } from '@/api/dict'
import { getModelListByCategory } from '@/api/model'

const message = useMessage()
const dialogInst = useDialog()

// ========== 注入 ==========

const kid = inject<Ref<string>>('kid')!
const knowledgeBase = inject<Ref<KnowledgeBaseVo | null>>('knowledgeBase')
const refreshKnowledgeBase = inject<() => Promise<void>>('refreshKnowledgeBase')

// ========== 状态 ==========

const loading = ref(false)
const saving = ref(false)
const formRef = ref<FormInst | null>(null)

// 选项数据
const categoryOptions = ref<SelectOption[]>([])
const vectorStoreOptions: SelectOption[] = [
  { label: 'Weaviate', value: 'weaviate' },
  { label: 'Milvus', value: 'milvus' },
]
const vectorModelOptions = ref<Array<{ label: string; value: number | string; modelName: string }>>([])

// ========== 表单数据（与后端 KnowledgeInfoBo 字段完全对齐） ==========

const formData = reactive<KnowledgeBaseForm>({
  kname: '',
  description: '',
  category: undefined,
  share: 0,
  knowledgeSeparator: '',
  questionSeparator: '',
  overlapChar: 50,
  retrieveLimit: 3,
  textBlockSize: 500,
  vectorModelName: '',
  embeddingModelId: undefined,
  embeddingModelName: undefined,
  systemPrompt: '',
  remark: '',
})

const initialSnapshot = ref<string>('')

const isDirty = computed(() => JSON.stringify(formData) !== initialSnapshot.value)

/** 表单是否满足最低保存条件 */
const canSave = computed(() => isDirty.value && (formData.kname ?? '').trim().length > 0 && !!formData.vectorModelName)

// ========== 验证规则 ==========

const rules: FormRules = {
  kname: [
    { required: true, message: '请输入知识库名称', trigger: ['blur', 'input'] },
    { min: 1, max: 50, message: '名称长度 1-50 个字符', trigger: ['blur', 'input'] },
  ],
  retrieveLimit: [
    { required: true, type: 'number', message: '请设置检索返回条数', trigger: ['blur', 'change'] },
  ],
  textBlockSize: [
    { required: true, type: 'number', message: '请设置文本块大小', trigger: ['blur', 'change'] },
  ],
  vectorModelName: [
    { required: true, message: '请选择向量库类型', trigger: ['blur', 'change'] },
  ],
}

// ========== 数据加载 ==========

async function fetchSettings() {
  if (!kid.value) return
  loading.value = true
  try {
    const res: any = await getKnowledgeBase(kid.value)
    if (res.code === 200 && res.data) {
      const kb: KnowledgeBaseVo = res.data
      Object.assign(formData, {
        id: kb.id,
        kid: kb.kid,
        kname: kb.kname || '',
        description: kb.description || '',
        category: kb.category || undefined,
        share: kb.share || 0,
        knowledgeSeparator: kb.knowledgeSeparator || '',
        questionSeparator: kb.questionSeparator || '',
        overlapChar: kb.overlapChar ?? 50,
        retrieveLimit: kb.retrieveLimit ?? 3,
        textBlockSize: kb.textBlockSize ?? 500,
        vectorModelName: kb.vectorModelName || '',
        embeddingModelId: kb.embeddingModelId || undefined,
        embeddingModelName: kb.embeddingModelName || undefined,
        systemPrompt: kb.systemPrompt || '',
        remark: kb.remark || '',
      })
      initialSnapshot.value = JSON.stringify(formData)
    } else {
      message.error('加载设置失败：' + (res.msg || ''))
    }
  } catch (error: any) {
    message.error('加载设置失败：' + (error.message || '网络错误'))
  } finally {
    loading.value = false
  }
}

async function loadCategoryOptions() {
  try {
    const res: any = await getDictDataByType('knowledge_category')
    if (res.code === 200 && Array.isArray(res.data)) {
      categoryOptions.value = res.data.map((item: any) => ({
        label: item.dictLabel,
        value: item.dictValue,
      }))
    }
  } catch { /* 不阻塞 */ }
}

async function loadVectorModels() {
  try {
    const res: any = await getModelListByCategory('vector')
    if (res && res.code === 200 && Array.isArray(res.rows)) {
      vectorModelOptions.value = res.rows.map((item: any) => {
        const idNum = Number(item.id)
        const idValue = (isNaN(idNum) || idNum > Number.MAX_SAFE_INTEGER) ? String(item.id) : idNum
        return {
          label: item.modelName || item.name || `模型 ${item.id}`,
          value: idValue,
          modelName: item.modelName || item.name,
        }
      })
    }
  } catch { /* 不阻塞 */ }
}

// ========== 操作 ==========

function handleEmbeddingModelChange(value: number | string) {
  formData.embeddingModelId = value
  const model = vectorModelOptions.value.find(m => m.value === value)
  if (model) formData.embeddingModelName = model.modelName
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    message.warning('请检查表单填写是否完整')
    return
  }

  saving.value = true
  try {
    const res: any = await updateKnowledgeBase({ ...formData })
    if (res.code === 200) {
      message.success('设置已保存')
      initialSnapshot.value = JSON.stringify(formData)
      refreshKnowledgeBase?.()
    } else {
      message.error('保存失败：' + (res.msg || ''))
    }
  } catch (error: any) {
    message.error('保存失败：' + (error.message || '网络错误'))
  } finally {
    saving.value = false
  }
}

function handleReset() {
  if (!isDirty.value) return
  dialogInst.warning({
    title: '确认重置',
    content: '确定要放弃所有未保存的更改吗？',
    positiveText: '确定重置',
    negativeText: '取消',
    onPositiveClick: () => {
      Object.assign(formData, JSON.parse(initialSnapshot.value))
      formRef.value?.restoreValidation()
      message.info('已重置为上次保存的状态')
    },
  })
}

// ========== 生命周期 ==========

onMounted(async () => {
  await Promise.all([loadCategoryOptions(), loadVectorModels()])
  await fetchSettings()
})

watch(kid, () => fetchSettings())
</script>

<template>
  <div class="settings-tab">
    <NSpin :show="loading">
      <NForm
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-placement="left"
        label-width="120"
        require-mark-placement="right-hanging"
        size="medium"
      >
        <!-- 基本信息 -->
        <h3 class="section-title">
          <SvgIcon icon="mdi:information-outline" style="margin-right: 6px" />
          基本信息
        </h3>

        <NFormItem label="名称" path="kname">
          <NInput
            v-model:value="formData.kname"
            placeholder="知识库名称"
            maxlength="50"
            show-count
          />
        </NFormItem>

        <NFormItem label="描述" path="description">
          <NInput
            v-model:value="formData.description"
            type="textarea"
            placeholder="知识库描述（可选）"
            :autosize="{ minRows: 2, maxRows: 5 }"
            maxlength="500"
            show-count
          />
        </NFormItem>

        <NFormItem label="分类" path="category">
          <NSelect
            v-model:value="formData.category"
            :options="categoryOptions"
            placeholder="选择分类（可选）"
            clearable
            filterable
          />
        </NFormItem>

        <NFormItem label="公开访问" path="share">
          <NSpace align="center" :size="8">
            <NSwitch
              :value="formData.share === 1"
              @update:value="(val: boolean) => formData.share = val ? 1 : 0"
            >
              <template #checked>公开</template>
              <template #unchecked>私有</template>
            </NSwitch>
            <span class="form-hint">公开后其他用户可以查看和检索该知识库</span>
          </NSpace>
        </NFormItem>

        <NDivider />

        <!-- 向量化配置 -->
        <h3 class="section-title">
          <SvgIcon icon="mdi:vector-polyline" style="margin-right: 6px" />
          向量化配置
        </h3>

        <NFormItem label="向量库类型" path="vectorModelName">
          <NSelect
            v-model:value="formData.vectorModelName"
            :options="vectorStoreOptions"
            placeholder="选择向量库类型"
            style="width: 280px"
          />
        </NFormItem>

        <NFormItem label="向量模型" path="embeddingModelId">
          <NSelect
            :value="formData.embeddingModelId"
            :options="vectorModelOptions"
            placeholder="选择向量模型"
            filterable
            style="width: 280px"
            @update:value="handleEmbeddingModelChange"
          />
        </NFormItem>

        <NDivider />

        <!-- 切片配置 -->
        <h3 class="section-title">
          <SvgIcon icon="mdi:content-cut" style="margin-right: 6px" />
          切片配置
        </h3>

        <NFormItem label="知识分隔符" path="knowledgeSeparator">
          <NSpace align="center" :size="8">
            <NInput
              v-model:value="formData.knowledgeSeparator"
              placeholder="留空使用默认分隔符"
              style="width: 280px"
            />
            <span class="form-hint">支持 \n、\n\n 等转义字符</span>
          </NSpace>
        </NFormItem>

        <NFormItem label="文本块大小" path="textBlockSize">
          <NSpace align="center" :size="8">
            <NInputNumber
              v-model:value="formData.textBlockSize"
              :min="100"
              :max="4000"
              :step="50"
              style="width: 180px"
            />
            <span class="form-hint">每个切片的最大字符数（100-4000）</span>
          </NSpace>
        </NFormItem>

        <NFormItem label="重叠字符数" path="overlapChar">
          <NSpace align="center" :size="8">
            <NInputNumber
              v-model:value="formData.overlapChar"
              :min="0"
              :max="500"
              :step="10"
              style="width: 180px"
            />
            <span class="form-hint">相邻切片之间的重叠字符数（0-500）</span>
          </NSpace>
        </NFormItem>

        <NDivider />

        <!-- 检索配置 -->
        <h3 class="section-title">
          <SvgIcon icon="mdi:magnify" style="margin-right: 6px" />
          检索配置
        </h3>

        <NFormItem label="检索返回条数" path="retrieveLimit">
          <NSpace align="center" :size="8">
            <NInputNumber
              v-model:value="formData.retrieveLimit"
              :min="1"
              :max="20"
              :step="1"
              style="width: 180px"
            />
            <span class="form-hint">检索时返回的最相似片段数量（1-20）</span>
          </NSpace>
        </NFormItem>

        <NFormItem label="提问分隔符" path="questionSeparator">
          <NSpace align="center" :size="8">
            <NInput
              v-model:value="formData.questionSeparator"
              placeholder="留空使用默认分隔符"
              style="width: 280px"
            />
            <span class="form-hint">用于分割提问内容的分隔符</span>
          </NSpace>
        </NFormItem>

        <NDivider />

        <!-- 系统提示词 -->
        <h3 class="section-title">
          <SvgIcon icon="mdi:robot-outline" style="margin-right: 6px" />
          系统提示词
        </h3>

        <NFormItem label="提示词" path="systemPrompt">
          <NInput
            v-model:value="formData.systemPrompt"
            type="textarea"
            placeholder="自定义系统提示词，指导 AI 工作台中 LLM 如何处理该知识库的内容..."
            :autosize="{ minRows: 4, maxRows: 10 }"
            maxlength="2000"
            show-count
          />
        </NFormItem>

        <NFormItem label="备注" path="remark">
          <NInput
            v-model:value="formData.remark"
            type="textarea"
            placeholder="备注信息（可选）"
            :autosize="{ minRows: 1, maxRows: 3 }"
            maxlength="500"
            show-count
          />
        </NFormItem>

        <NDivider />

        <!-- 操作按钮 -->
        <div class="form-actions">
          <NSpace>
            <NButton
              type="primary"
              :loading="saving"
              :disabled="!canSave"
              @click="handleSave"
            >
              <template #icon><SvgIcon icon="mdi:content-save-outline" /></template>
              保存设置
            </NButton>
            <NButton
              :disabled="!isDirty"
              @click="handleReset"
            >
              重置
            </NButton>
          </NSpace>
          <NAlert
            v-if="isDirty"
            type="warning"
            :bordered="false"
            style="padding: 4px 12px; font-size: 12px"
          >
            有未保存的更改
          </NAlert>
        </div>
      </NForm>
    </NSpin>
  </div>
</template>

<style scoped>
.settings-tab {
  max-width: 1200px;
  padding: 0;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #323130;
  margin: 0 0 16px 0;
}

.form-hint {
  font-size: 12px;
  color: #a19f9d;
  white-space: nowrap;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
