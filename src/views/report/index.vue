<script setup lang='ts'>
import { h, onMounted, ref } from 'vue'
import {
	NButton, NCard, NDataTable, NEmpty, NGrid, NGridItem, NIcon, NInput,
	NMessageProvider, NModal, NPopconfirm, NRadio, NRadioGroup, NSelect, NSpace, NTag, NText,
	createDiscreteApi,
} from 'naive-ui'
import {
	DocumentTextOutline, DownloadOutline, EyeOutline, SearchOutline, TrashOutline,
} from '@vicons/ionicons5'

// ✨ 引入封装好的 API 接口 (注意确保路径与你的项目匹配)
import type { Report } from '@/api/report'
import { deleteReport, exportReportApi, fetchReportList, previewReportApi } from '@/api/report'
const { message: ms } = createDiscreteApi(['message'])
import { useAuthStore } from '@/store'
const authStore = useAuthStore()

// --- 状态与数据定义 ---
const loading = ref(false)
const searchKeyword = ref('')
const filterType = ref<string | null>(null)

const showPreviewModal = ref(false)
const previewUrl = ref('')
const previewLoading = ref(false)
const previewTitle = ref('')

const previewSelectValue = ref('default')
const previewSelectOptions = [
	{ label: '默认视图', value: 'default' },
	{ label: '适应宽度', value: 'fit_width' },
	{ label: '适合页面', value: 'fit_page' }
]


const fetchBlobDirectly = async (url: string, method = 'GET', bodyData = null) => {
	// 获取 Vite 配置的后端基础路径（通常是 /api，根据你的环境调整）
	const baseURL = import.meta.env.VITE_APP_BASE_API || '/api'

	const options: RequestInit = {
		method,
		headers: {
			'Authorization': `Bearer ${authStore.token}`, // 携带你的 Token
			'Content-Type': 'application/json'
		}
	}
	if (bodyData) options.body = JSON.stringify(bodyData)

	const response = await fetch(`${baseURL}${url}`, options)
	if (!response.ok) throw new Error('请求失败，状态码: ' + response.status)
	return await response.blob() // 直接返回最纯净的 Blob 流
}
// 分页配置
const pagination = ref({
	page: 1,
	pageSize: 10,
	itemCount: 0, // 新增 itemCount 接收后端总数
	showSizePicker: true,
	pageSizes: [10, 20, 50],
	onChange: (page: number) => {
		pagination.value.page = page
		loadReports()
	},
	onUpdatePageSize: (pageSize: number) => {
		pagination.value.pageSize = pageSize
		pagination.value.page = 1
		loadReports()
	},
})

const reportTypeOptions = [
	{ label: '编码规范检查报告', value: 'code_standard_check' },
	{ label: '数据安全审计报告', value: 'data_security' },       // 注意：请确保 value 与后端一致
	{ label: '依赖关系分析报告', value: 'dependency_analysis' }, // 注意：请确保 value 与后端一致
	{ label: '合规审计报告', value: 'compliance_audit' },              // 注意：请确保 value 与后端一致
	{ label: '其他报告', value: 'other' },
]

const reports = ref<Report[]>([])

// 导出模态框状态
const showExportModal = ref(false)
const exportFormat = ref('pdf')
const currentExportReport = ref<Report | null>(null)

// --- 核心 API 操作方法 ---

// 1. 获取报告列表 (真实调用后端)
const loadReports = async () => {
	loading.value = true
	try {
		const params = {
			currentPage: pagination.value.page,
			pageSize: pagination.value.pageSize,
			keyword: searchKeyword.value,
			type: filterType.value
		}
		const response: any = await fetchReportList(params)

		if (response && response.code === 200) {
			// 直接获取 response.data，因为它就是报告数组
			const data = response.data || []
			reports.value = Array.isArray(data) ? data : (data.rows || [])
			pagination.value.itemCount = response.total || reports.value.length
		}
	} catch (error: any) {
		console.error('获取报告失败:', error)
	} finally {
		loading.value = false
	}
}

// 2. 触发查询
const handleSearch = () => {
	pagination.value.page = 1
	loadReports()
}

// 3. 预览报告
const handlePreview = async (row: Report) => {
	if (row.status !== 'ready') return ms.warning('报告尚未生成完毕，无法预览')

	// 打开弹窗，进入加载状态
	previewTitle.value = row.name
	showPreviewModal.value = true
	previewLoading.value = true

	// 清理上一次的残余 Blob URL，防止内存泄漏
	if (previewUrl.value) {
		window.URL.revokeObjectURL(previewUrl.value)
		previewUrl.value = ''
	}

	try {
		// ✨ 核心魔法：不论后端是 Word 还是 PDF，统一请求后端将它转换成 PDF 流返回
		const blobData = await fetchBlobDirectly('/report/export', 'POST', {
			id: row.id,
			format: 'pdf' // 强制索要 PDF 格式以便浏览器渲染
		})

		if (blobData.type === 'application/json' || blobData.type.includes('json')) {
			const text = await blobData.text();
			const errorObj = JSON.parse(text);
			throw new Error(errorObj.msg || errorObj.message || '预览获取失败');
		}

		// 将拿到的 PDF Blob 转换成浏览器可读的本地 URL
		previewUrl.value = window.URL.createObjectURL(blobData)

	} catch (error: any) {
		console.error('预览失败:', error)
		ms.error(error.message || '预览加载失败')
		showPreviewModal.value = false // 失败时关闭弹窗
	} finally {
		previewLoading.value = false
	}
}

// 打开导出模态框
const openExportModal = (row: Report) => {
	if (row.status !== 'ready')
		return ms.warning('报告尚未生成完毕，无法导出')
	currentExportReport.value = row
	exportFormat.value = 'pdf' // 默认选中 PDF
	showExportModal.value = true
}

// 4. 确认导出
const confirmExport = async () => {
	if (!currentExportReport.value) return
	const loadingMsg = ms.loading('正在请求导出流...', { duration: 0 })

	try {
		// 1. 直接通过原生 fetch 提交并获取纯净的 Blob 流
		const blobData = await fetchBlobDirectly('/report/export', 'POST', {
			id: currentExportReport.value.id,
			format: exportFormat.value
		})

		// 2. 拦截 JSON 异常
		if (blobData.type === 'application/json' || blobData.type.includes('json')) {
			const text = await blobData.text();
			const errorObj = JSON.parse(text);
			throw new Error(errorObj.msg || errorObj.message || '服务器端导出异常');
		}

		const url = window.URL.createObjectURL(blobData)
		const link = document.createElement('a')
		link.href = url

		// 3. 映射导出格式对应的后缀
		const extMap: Record<string, string> = { pdf: 'pdf', word: 'docx'}
		const ext = extMap[exportFormat.value] || 'pdf'

		// ✨ 4. 强制替换文件的后缀名
		let fileName = currentExportReport.value.name;
		const lastDotIndex = fileName.lastIndexOf('.');
		if (lastDotIndex > -1) {
			// 如果原本有后缀（比如 .docx），先把旧后缀切掉
			fileName = fileName.substring(0, lastDotIndex);
		}
		// 拼接用户选择的新后缀
		fileName = `${fileName}.${ext}`;

		link.download = fileName;
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		window.URL.revokeObjectURL(url)

		ms.success('导出下载成功')
	} catch (error: any) {
		console.error('捕获到导出错误:', error)
		ms.error(`导出失败: ${error.message || '数据流处理失败'}`)
	} finally {
		loadingMsg.destroy()
		showExportModal.value = false
	}
}

// 5. 删除报告
const handleDelete = async (row: Report) => {
	try {
		const res: any = await deleteReport(row.id)
		if (res && res.code === 200) {
			ms.success('报告删除成功')
			loadReports()
		}
		else {
			ms.error(res?.msg || '删除失败')
		}
	}
	catch (error) {
		ms.error('网络错误，删除失败')
	}
}

// --- 表格列配置 ---
// ✨ 修改点 2：扩充映射表，把数据库里的英文翻译成漂亮的中文
const typeLabelMap: Record<string, string> = {
	code_standard_check: '编码规范检查',
	standard: '规范检查',
	data_security: '数据安全审计',
	dependency_analysis: '依赖关系分析',
	compliance_audit: '合规审计',
	other: '其他'
}

// ✨ 修改点 3：为不同的报告类型配置颜色标签
const typeTagMap: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error' | 'primary'> = {
	code_standard_check: 'info',
	standard: 'info',
	data_security: 'error',        // 数据安全比较重要，设为红色(error)或警告色(warning)
	dependency_analysis: 'warning', // 依赖关系设为黄色(warning)
	compliance_audit: 'success',         // 合规审计设为绿色(success)
	other: 'default'
}

const columns = [
	{ title: '报告名称', key: 'name', width: 250, ellipsis: { tooltip: true }, render: (row: Report) => h('span', { style: { fontWeight: 'bold' } }, row.name) },
	{ title: '关联任务', key: 'taskName', width: 150, ellipsis: { tooltip: true } },
	{
		title: '报告类型',
		key: 'type',
		width: 140,
		render: (row: Report) => h(
			NTag,
			{ type: typeTagMap[row.type] || 'default', size: 'small' },
			// 如果字典里找不到，就直接显示原有的英文字符串
			{ default: () => typeLabelMap[row.type] || row.type }
		)
	},
	{
		title: '状态',
		key: 'status',
		width: 100,
		render: (row: Report) => {
			if (row.status === 'ready')
				return h(NTag, { type: 'success', size: 'small', round: true }, { default: () => '已就绪' })
			if (row.status === 'generating')
				return h(NTag, { type: 'info', size: 'small', round: true }, { default: () => '生成中...' })
			return h(NTag, { type: 'error', size: 'small', round: true }, { default: () => '生成失败' })
		},
	},
	{ title: '生成时间', key: 'createTime', width: 180 },
	{
		title: '操作',
		key: 'actions',
		width: 280,
		render: (row: Report) => {
			return h(NSpace, { size: 'small' }, {
				default: () => [
					h(NButton, { size: 'small', type: 'info', dashed: true, onClick: () => handlePreview(row), disabled: row.status !== 'ready' }, { icon: () => h(NIcon, null, { default: () => h(EyeOutline) }), default: () => '预览' }),
					h(NButton, { size: 'small', type: 'primary', onClick: () => openExportModal(row), disabled: row.status !== 'ready' }, { icon: () => h(NIcon, null, { default: () => h(DownloadOutline) }), default: () => '导出' }),
					h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, { trigger: () => h(NButton, { size: 'small', type: 'error' }, { icon: () => h(NIcon, null, { default: () => h(TrashOutline) }), default: () => '删除' }), default: () => '确定要删除此报告吗？(物理文件将一并删除)' }),
				],
			})
		},
	},
]

onMounted(() => {
	loadReports() // 页面加载时自动请求数据
})
</script>

<template>
	<NMessageProvider>
		<div class="h-full flex flex-col p-4 dark:bg-[#24272e]">
			<NCard class="flex-1 flex flex-col" title="报告管理">
				<div class="mb-4">
					<NGrid :cols="4" :x-gap="12">
						<NGridItem>
							<NInput v-model:value="searchKeyword" placeholder="检索报告名称 / 关联任务..." @keyup.enter="handleSearch">
								<template #prefix>
									<NIcon><SearchOutline /></NIcon>
								</template>
							</NInput>
						</NGridItem>
						<NGridItem>
							<NSelect v-model:value="filterType" placeholder="筛选报告类型" clearable :options="reportTypeOptions" @update:value="handleSearch" />
						</NGridItem>
						<NGridItem>
							<NButton type="primary" block @click="handleSearch">
								<template #icon>
									<NIcon><SearchOutline /></NIcon>
								</template>
								查询
							</NButton>
						</NGridItem>
					</NGrid>
				</div>

				<div class="flex-1 overflow-hidden border border-gray-100 dark:border-gray-800 rounded-md">
					<NDataTable
						:columns="columns"
						:data="reports"
						:loading="loading"
						:pagination="pagination"
						:max-height="600"
						striped
						remote
					/>
					<NEmpty v-if="!loading && reports.length === 0" description="暂无报告数据" class="py-12" />
				</div>
			</NCard>

			<NModal v-model:show="showExportModal" title="导出报告" preset="card" style="width: 500px">
				<div class="p-2">
					<div class="mb-6">
						<NText depth="2">
							正在导出：
						</NText>
						<NText strong class="text-lg">
							{{ currentExportReport?.name }}
						</NText>
					</div>

					<div class="mb-4">
						<NText strong>
							请选择导出格式（支持复杂图表与表格渲染）：
						</NText>
					</div>

					<NRadioGroup v-model:value="exportFormat" name="exportFormatGroup" class="w-full">
						<NSpace vertical :size="16">
							<NRadio value="pdf" class="w-full border p-3 rounded-md border-gray-200 dark:border-gray-700 hover:border-blue-400 cursor-pointer">
								<div class="flex items-center gap-2">
									<NIcon size="24" color="#d03050">
										<DocumentTextOutline />
									</NIcon>
									<div>
										<div class="font-bold">
											PDF 文档
										</div>
										<div class="text-xs text-gray-400">
											保留所有复杂排版和图表样式，适合存档与打印。
										</div>
									</div>
								</div>
							</NRadio>

							<NRadio value="word" class="w-full border p-3 rounded-md border-gray-200 dark:border-gray-700 hover:border-blue-400 cursor-pointer">
								<div class="flex items-center gap-2">
									<NIcon size="24" color="#2080f0">
										<DocumentTextOutline />
									</NIcon>
									<div>
										<div class="font-bold">
											Word 文档 (Docx)
										</div>
										<div class="text-xs text-gray-400">
											图表将转化为高清图片插入，支持二次编辑。
										</div>
									</div>
								</div>
							</NRadio>
						</NSpace>
					</NRadioGroup>
				</div>

				<template #action>
					<NSpace justify="end">
						<NButton @click="showExportModal = false">
							取消
						</NButton>
						<NButton type="primary" :loading="loading" @click="confirmExport">
							<template #icon>
								<NIcon><DownloadOutline /></NIcon>
							</template>
							确认导出
						</NButton>
					</NSpace>
				</template>
			</NModal>

			<NModal v-model:show="showPreviewModal" preset="card" :title="'在线预览：' + previewTitle" style="width: 80%; height: 85vh; max-width: 1200px;">
				<template #header-extra>
					<NSelect
						v-model:value="previewSelectValue"
						:options="previewSelectOptions"
						size="small"
						style="width: 120px; margin-right: 10px;"
					/>
				</template>

				<div class="h-full w-full relative flex items-center justify-center bg-gray-50 dark:bg-[#18181c]" style="min-height: 500px;">
					<div v-if="previewLoading" class="flex flex-col items-center justify-center text-gray-500">
						<NIcon size="40" class="animate-spin mb-2"><DocumentTextOutline /></NIcon>
						<span>正在从服务器加载并渲染文档...</span>
					</div>

					<iframe
						v-else-if="previewUrl"
						:src="previewUrl"
						class="w-full h-full border-0"
						title="文档预览"
					></iframe>

					<NEmpty v-else description="文档加载异常" />
				</div>
			</NModal>
		</div>
	</NMessageProvider>
</template>

<style scoped>
:deep(.n-data-table) { height: 100%; }
.n-radio { --n-radio-size: 18px; }
</style>
