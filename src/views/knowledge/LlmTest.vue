<template>
	<div class="llm-test-page">
		<n-card title="LLM测试" size="large">
			<n-space vertical :size="16">
				<n-form :model="form" label-width="80">
					<n-form-item label="知识库ID">
						<n-input v-model:value="form.kid" placeholder="可选，填写则按该知识库选择模型" />
					</n-form-item>
					<n-form-item label="测试内容" :required="true">
						<n-input
							v-model:value="form.content"
							type="textarea"
							:autosize="{ minRows: 6, maxRows: 16 }"
							placeholder="在此输入用于测试的文本片段"
						/>
					</n-form-item>
				</n-form>
				<n-alert type="info" :show-icon="true">
					将使用智能选择的chat模型（自动跳过占位符模型）
				</n-alert>

				<n-space justify="end">
					<n-button @click="handleClear" :disabled="loading">清空</n-button>
					<n-button type="primary" :loading="loading" @click="handleSend">调用LLM</n-button>
				</n-space>

				<n-alert v-if="errorMessage" type="error" :show-icon="true">
					{{ errorMessage }}
				</n-alert>

				<n-card v-if="result" title="返回结果" size="small">
					<n-tabs type="segment">
						<n-tab-pane name="pretty" tab="结构化视图">
							<div class="result-section" v-if="result">
								<h3>标题</h3>
								<div class="field-block">{{ result.title || '（空）' }}</div>
								<h3>摘要</h3>
								<div class="field-block">{{ result.summary || '（空）' }}</div>
								<h3>问题描述</h3>
								<div class="field-block pre-wrap">{{ result.problemDescription || '（空）' }}</div>
								<h3>修复方案</h3>
								<div class="field-block pre-wrap">{{ result.fixSolution || '（空）' }}</div>
								<h3>示例代码</h3>
								<pre class="code-block" v-if="result.exampleCode">{{ result.exampleCode }}</pre>
								<h3>元信息</h3>
								<n-descriptions :column="2" bordered size="small">
									<n-descriptions-item label="漏洞类型（单个）">
										{{ result.vulnerabilityType || '（空）' }}
									</n-descriptions-item>
									<n-descriptions-item label="漏洞类型（数组）">
										<n-space v-if="result.vulnerabilityTypes && result.vulnerabilityTypes.length" :size="6" wrap>
											<n-tag v-for="vulnType in result.vulnerabilityTypes" :key="vulnType" type="error" size="small">
												{{ vulnType }}
											</n-tag>
										</n-space>
										<span v-else>（空）</span>
									</n-descriptions-item>
									<n-descriptions-item label="语言">
										{{ result.language || '（空）' }}
									</n-descriptions-item>
									<n-descriptions-item label="严重等级">
										{{ result.severity || '（空）' }}
									</n-descriptions-item>
								</n-descriptions>
								<h3 style="margin-top: 16px;">CVSS维度</h3>
								<n-descriptions :column="2" bordered size="small">
									<n-descriptions-item label="攻击方式">
										{{ result.cvssAttackVector || '（空）' }}
									</n-descriptions-item>
									<n-descriptions-item label="利用复杂度">
										{{ result.cvssAttackComplexity || '（空）' }}
									</n-descriptions-item>
									<n-descriptions-item label="权限需求">
										{{ result.cvssPrivilegesRequired || '（空）' }}
									</n-descriptions-item>
									<n-descriptions-item label="用户交互">
										{{ result.cvssUserInteraction || '（空）' }}
									</n-descriptions-item>
									<n-descriptions-item label="影响范围" :span="2">
										<n-space v-if="result.cvssImpact && result.cvssImpact.length" :size="6" wrap>
											<n-tag v-for="impact in result.cvssImpact" :key="impact" type="warning" size="small">
												{{ impact }}
											</n-tag>
										</n-space>
										<span v-else>（空）</span>
									</n-descriptions-item>
								</n-descriptions>
								<h3 style="margin-top: 16px;">标签</h3>
								<n-space v-if="result.tags && result.tags.length" :size="6" wrap>
									<n-tag v-for="tag in result.tags" :key="tag" type="info" size="small">
										{{ tag }}
									</n-tag>
								</n-space>
								<div v-else>（无）</div>
							</div>
						</n-tab-pane>
						<n-tab-pane name="raw" tab="原始JSON">
							<n-code :code="rawJson" language="json" />
						</n-tab-pane>
					</n-tabs>
				</n-card>
			</n-space>
		</n-card>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { NCard, NForm, NFormItem, NInput, NSpace, NButton, NAlert, NDescriptions, NDescriptionsItem, NTabPane, NTabs, NTag, NCode } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { testLlmExtract, type LlmTestRequest } from '@/api/knowledge'

const message = useMessage()

const form = reactive<LlmTestRequest>({
	content: '',
	kid: '',
})

const loading = ref(false)
const errorMessage = ref('')
const result = ref<any | null>(null)

const rawJson = computed(() => {
	if (!result.value) return ''
	try {
		return JSON.stringify(result.value, null, 2)
	} catch {
		return ''
	}
})

async function handleSend() {
	if (!form.content || !form.content.trim()) {
		message.error('请输入测试内容')
		return
	}
	loading.value = true
	errorMessage.value = ''
	result.value = null
	try {
		const payload: LlmTestRequest = {
			content: form.content,
		}
		if (form.kid && form.kid.trim()) {
			payload.kid = form.kid.trim()
		}
		console.log('[LLM测试] 发送请求，payload:', JSON.stringify(payload, null, 2))
		const res = await testLlmExtract(payload)
		console.log('[LLM测试] 收到响应:', res)
		if ((res as any).code === 200) {
			result.value = (res as any).data || (res as any)
			console.log('[LLM测试] 提取结果:', result.value)
			message.success('调用成功')
		} else {
			errorMessage.value = (res as any).msg || '调用失败'
			console.error('[LLM测试] 调用失败:', errorMessage.value)
		}
	} catch (e:any) {
		errorMessage.value = e?.message || '调用异常'
		console.error('[LLM测试] 调用异常:', e)
		message.error(errorMessage.value)
	} finally {
		loading.value = false
	}
}

function handleClear() {
	form.content = ''
	result.value = null
	errorMessage.value = ''
}
</script>

<style scoped>
.llm-test-page {
	padding: 16px;
}
.field-block {
	padding: 8px 12px;
	background-color: #f7fafc;
	border-radius: 4px;
	min-height: 32px;
}
.pre-wrap {
	white-space: pre-wrap;
	word-break: break-word;
}
.code-block {
	background-color: #1e1e1e;
	color: #f7fafc;
	padding: 8px 12px;
	border-radius: 4px;
	overflow-x: auto;
	font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
	font-size: 12px;
}
.result-section h3 {
	margin: 16px 0 8px;
	font-size: 14px;
	font-weight: 500;
}
</style>
