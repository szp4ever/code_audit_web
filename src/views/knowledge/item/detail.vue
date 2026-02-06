<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NCard, NButton, NSpace } from "naive-ui";
import { SvgIcon } from "@/components/common";

const route = useRoute();
const router = useRouter();
const itemUuid = ref<string>(route.params.itemUuid as string);

//返回（逻辑返回：返回到知识条目管理页）
function handleGoBack() {
	const kid = route.query.kid as string | undefined;
	if (kid) {
		router.push({
			name: 'knowledgeItemList',
			query: { kid },
		});
	} else {
		router.push({
			name: 'knowledge1',
		});
	}
}

onMounted(() => {
	// TODO: 加载知识条目详情
});
</script>

<template>
	<div class="knowledge-item-detail-container">
		<n-card :bordered="false">
			<template #header>
				<div class="detail-header">
					<n-space>
						<n-button quaternary @click="handleGoBack">
							<template #icon>
								<SvgIcon icon="mage:arrow-left" />
							</template>
							返回
						</n-button>
						<h2>知识条目详情</h2>
					</n-space>
				</div>
			</template>
			<div class="detail-content">
				<div v-if="loading">加载中...</div>
				<div v-else-if="itemDetail">
					<h3>{{ itemDetail.title || '无标题' }}</h3>
					<p v-if="itemDetail.summary"><strong>摘要：</strong>{{ itemDetail.summary }}</p>
					<p v-if="itemDetail.problemDescription"><strong>问题描述：</strong>{{ itemDetail.problemDescription }}</p>
					<p v-if="itemDetail.fixSolution"><strong>修复方案：</strong>{{ itemDetail.fixSolution }}</p>
					<p v-if="itemDetail.language"><strong>语言：</strong>{{ itemDetail.language }}</p>
					<p v-if="itemDetail.severity"><strong>风险等级：</strong>{{ itemDetail.severity }}</p>
					<p v-if="itemDetail.vulnerabilityType"><strong>漏洞类型：</strong>{{ itemDetail.vulnerabilityType }}</p>
				</div>
				<div v-else>
					<p>未找到知识条目详情</p>
					<p>Item UUID: {{ itemUuid }}</p>
				</div>
			</div>
		</n-card>
	</div>
</template>

<style scoped>
.knowledge-item-detail-container {
	padding: 16px;
	height: 100%;
}

.detail-header {
	display: flex;
	align-items: center;
}

.detail-header h2 {
	margin: 0;
	font-size: 18px;
	font-weight: 600;
}

.detail-content {
	padding: 20px;
}
</style>
