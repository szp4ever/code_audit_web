<script setup lang="ts">
/**
 * 知识库新建/编辑抽屉
 *
 * 功能：完整表单验证、基础信息 + 技术配置（折叠）+ 高级配置（折叠）、
 *       大整数 embeddingModelId 安全处理、脏数据检测、重置确认
 */
import { ref, reactive, computed, watch, nextTick } from 'vue'
import {
  NDrawer, NDrawerContent, NForm, NFormItem, NInput, NInputNumber,
  NSelect, NButton, NSpace, NCollapse, NCollapseItem, NDivider,
  NTooltip, NAlert, NSwitch,
  useMessage, useDialog,
} from 'naive-ui'
import type { FormInst, FormRules, SelectOption } from 'naive-ui'
import {
  createKnowledgeBase,
  updateKnowledgeBase,
  type KnowledgeReq,
  type KnowledgeVo,
} from '@/api/v2/knowledgeBase'

const props = defineProps<{
  visible: boolean
  mode: 'create' | 'edit'
  editingData: KnowledgeVo | null
  categoryOptions: SelectOption[]
  vectorModelOptions: Array<{ label: string; value: number | string; modelName: string }>
  vectorStoreOptions: SelectOption[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const message = useMessage()
const dialog = useDialog()
const formRef = ref<FormInst | null>(null)
const submitting = ref(false)

// ========== 表单数据 ==========

function getDefaultForm(): KnowledgeReq {
  return {
    kname: '',
    description: '',
    share: 0,
    category: undefined,
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
  }
}

const formValue = reactive<KnowledgeReq>(getDefaultForm())
const initialSnapshot = ref<string>('')

/** 脏数据检测 */
const isDirty = computed(() => {
  return JSON.stringify(formValue) !== initialSnapshot.value
})

/** 表单是否满足最低提交条件（必填字段非空） */
const canSubmit = computed(() => {
  const nameOk = (formValue.kname ?? '').trim().length > 0
  const vectorStoreOk = !!formValue.vectorModelName
  const embeddingOk = !!formValue.embeddingModelId
  const allRequired = nameOk && vectorStoreOk && embeddingOk
  if (props.mode === 'create') return allRequired
  // 编辑模式：必填通过 + 有修改
  return allRequired && isDirty.value
})

// ========== 验证规则 ==========

const rules: FormRules = {
  kname: [
    { required: true, message: '请输入知识库名称', trigger: ['blur', 'input'] },
    { min: 1, max: 50, message: '名称长度 1-50 个字符', trigger: ['blur', 'input'] },
  ],
  retrieveLimit: [
    { required: true, type: 'number', message: '请输入检索返回条数', trigger: ['blur', 'change'] },
  ],
  textBlockSize: [
    { required: true, type: 'number', message: '请输入文本块大小', trigger: ['blur', 'change'] },
  ],
  vectorModelName: [
    { required: true, message: '请选择向量库类型', trigger: ['blur', 'change'] },
  ],
  embeddingModelId: [
    { required: true, message: '请选择向量模型', trigger: ['blur', 'change'] },
  ],
}

// ========== 监听 visible 变化，初始化/重置表单 ==========

watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => {
      if (props.mode === 'edit' && props.editingData) {
        // 编辑模式：填充数据
        Object.assign(formValue, {
          id: props.editingData.id,
          kid: props.editingData.kid,
          uid: props.editingData.uid,
          kname: props.editingData.kname || '',
          description: props.editingData.description || '',
          share: props.editingData.share || 0,
          category: props.editingData.category || undefined,
          knowledgeSeparator: props.editingData.knowledgeSeparator || '',
          questionSeparator: props.editingData.questionSeparator || '',
          overlapChar: props.editingData.overlapChar ?? 50,
          retrieveLimit: props.editingData.retrieveLimit ?? 3,
          textBlockSize: props.editingData.textBlockSize ?? 500,
          vectorModelName: props.editingData.vectorModelName || '',
          embeddingModelId: props.editingData.embeddingModelId || undefined,
          embeddingModelName: props.editingData.embeddingModelName || undefined,
          systemPrompt: props.editingData.systemPrompt || '',
          remark: props.editingData.remark || '',
        })
      } else {
        // 新建模式：重置
        Object.assign(formValue, getDefaultForm())
      }
      initialSnapshot.value = JSON.stringify(formValue)
      formRef.value?.restoreValidation()
    })
  }
})

// ========== 向量模型选择联动 ==========

function handleEmbeddingModelChange(value: number | string) {
  formValue.embeddingModelId = value
  const model = props.vectorModelOptions.find(m => m.value === value)
  if (model) {
    formValue.embeddingModelName = model.modelName
  }
}

// ========== 提交 ==========

async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    message.warning('请检查表单填写是否完整')
    return
  }

  submitting.value = true
  try {
    const data: KnowledgeReq = { ...formValue }
    let res: any
    if (props.mode === 'create') {
      res = await createKnowledgeBase(data)
    } else {
      res = await updateKnowledgeBase(data)
    }
    if (res.code === 200) {
      message.success(props.mode === 'create' ? '知识库创建成功' : '知识库更新成功')
      emit('success')
    } else {
      message.error(res.msg || (props.mode === 'create' ? '创建失败' : '更新失败'))
    }
  } catch (error: any) {
    message.error('操作失败：' + (error.message || '网络错误'))
  } finally {
    submitting.value = false
  }
}

// ========== 关闭（脏数据确认） ==========

function handleClose() {
  if (isDirty.value) {
    dialog.warning({
      title: '未保存的更改',
      content: '表单内容已修改但尚未保存，确定要关闭吗？',
      positiveText: '放弃更改',
      negativeText: '继续编辑',
      onPositiveClick: () => {
        emit('update:visible', false)
      },
    })
  } else {
    emit('update:visible', false)
  }
}

function handleReset() {
  if (props.mode === 'edit' && props.editingData) {
    Object.assign(formValue, JSON.parse(initialSnapshot.value))
  } else {
    Object.assign(formValue, getDefaultForm())
  }
  formRef.value?.restoreValidation()
  message.info('表单已重置')
}
</script>

<template>
  <NDrawer
    :show="visible"
    :width="520"
    placement="right"
    :mask-closable="!isDirty"
    @update:show="handleClose"
  >
    <NDrawerContent
      :title="mode === 'create' ? '新建知识库' : '编辑知识库'"
      closable
      @close="handleClose"
    >
      <NForm
        ref="formRef"
        :model="formValue"
        :rules="rules"
        label-placement="left"
        label-width="auto"
        require-mark-placement="right-hanging"
        size="medium"
      >
        <!-- 基础信息 -->
        <NFormItem label="名称" path="kname">
          <NInput
            v-model:value="formValue.kname"
            placeholder="请输入知识库名称"
            maxlength="50"
            show-count
          />
        </NFormItem>

        <NFormItem label="描述" path="description">
          <NInput
            v-model:value="formValue.description"
            type="textarea"
            placeholder="请输入知识库描述（可选）"
            :autosize="{ minRows: 2, maxRows: 5 }"
            maxlength="500"
            show-count
          />
        </NFormItem>

        <NFormItem label="分类" path="category">
          <NSelect
            v-model:value="formValue.category"
            :options="categoryOptions"
            placeholder="请选择分类（可选）"
            clearable
            filterable
          />
        </NFormItem>

        <NFormItem label="公开访问" path="share">
          <NSwitch
            :value="formValue.share === 1"
            @update:value="(val: boolean) => formValue.share = val ? 1 : 0"
          >
            <template #checked>公开</template>
            <template #unchecked>私有</template>
          </NSwitch>
        </NFormItem>

        <NFormItem label="系统提示词" path="systemPrompt">
          <NInput
            v-model:value="formValue.systemPrompt"
            type="textarea"
            placeholder="自定义系统提示词（可选）"
            :autosize="{ minRows: 2, maxRows: 6 }"
            maxlength="2000"
            show-count
          />
        </NFormItem>

        <!-- 技术配置（折叠） -->
        <NCollapse :default-expanded-names="mode === 'create' ? ['tech'] : []" style="margin-bottom: 16px">
          <NCollapseItem title="技术配置" name="tech">
            <NFormItem label="向量库类型" path="vectorModelName">
              <NSelect
                v-model:value="formValue.vectorModelName"
                :options="vectorStoreOptions"
                placeholder="请选择向量库类型"
              />
            </NFormItem>

            <NFormItem label="向量模型" path="embeddingModelId">
              <NSelect
                :value="formValue.embeddingModelId"
                :options="vectorModelOptions"
                placeholder="请选择向量模型"
                filterable
                @update:value="handleEmbeddingModelChange"
              />
            </NFormItem>

            <NFormItem label="检索返回条数" path="retrieveLimit">
              <NInputNumber
                v-model:value="formValue.retrieveLimit"
                :min="1"
                :max="10"
                :step="1"
                placeholder="1-10"
                style="width: 100%"
              />
            </NFormItem>
          </NCollapseItem>
        </NCollapse>

        <!-- 高级配置（折叠） -->
        <NCollapse style="margin-bottom: 16px">
          <NCollapseItem title="高级配置" name="advanced">
            <NFormItem label="文本块大小" path="textBlockSize">
              <NInputNumber
                v-model:value="formValue.textBlockSize"
                :min="100"
                :max="2000"
                :step="50"
                placeholder="100-2000"
                style="width: 100%"
              >
                <template #suffix>字符</template>
              </NInputNumber>
            </NFormItem>

            <NFormItem label="重叠字符数" path="overlapChar">
              <NInputNumber
                v-model:value="formValue.overlapChar"
                :min="0"
                :max="500"
                :step="10"
                placeholder="0-500"
                style="width: 100%"
              >
                <template #suffix>字符</template>
              </NInputNumber>
            </NFormItem>

            <NFormItem label="知识分隔符" path="knowledgeSeparator">
              <NInput
                v-model:value="formValue.knowledgeSeparator"
                placeholder="留空使用默认分隔符"
              />
            </NFormItem>

            <NFormItem label="提问分隔符" path="questionSeparator">
              <NInput
                v-model:value="formValue.questionSeparator"
                placeholder="留空使用默认分隔符"
              />
            </NFormItem>

            <NFormItem label="备注" path="remark">
              <NInput
                v-model:value="formValue.remark"
                type="textarea"
                placeholder="备注信息（可选）"
                :autosize="{ minRows: 1, maxRows: 3 }"
              />
            </NFormItem>
          </NCollapseItem>
        </NCollapse>
      </NForm>

      <template #footer>
        <NSpace justify="space-between" style="width: 100%">
          <NButton
            v-if="isDirty"
            text
            type="warning"
            size="small"
            @click="handleReset"
          >
            重置
          </NButton>
          <span v-else />
          <NSpace>
            <NButton @click="handleClose">取消</NButton>
            <NButton
              type="primary"
              :loading="submitting"
              :disabled="!canSubmit"
              @click="handleSubmit"
            >
              {{ mode === 'create' ? '创建' : '保存' }}
            </NButton>
          </NSpace>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
