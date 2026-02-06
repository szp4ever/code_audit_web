<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NProgress, NSpace, NTag } from 'naive-ui';
import { RISK_LEVELS, COLORS } from '@/constants/knowledgeItem';

interface Props {
	score?: number;
	showDetails?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	score: undefined,
	showDetails: false,
});

const riskLevel = computed(() => {
	if (props.score === undefined) return null;
	const score = props.score;
	if (score >= RISK_LEVELS.CRITICAL.threshold) return RISK_LEVELS.CRITICAL;
	if (score >= RISK_LEVELS.HIGH.threshold) return RISK_LEVELS.HIGH;
	if (score >= RISK_LEVELS.MEDIUM.threshold) return RISK_LEVELS.MEDIUM;
	if (score >= RISK_LEVELS.LOW.threshold) return RISK_LEVELS.LOW;
	return RISK_LEVELS.NONE;
});

const progressColor = computed(() => {
	if (!riskLevel.value) return COLORS.NEUTRAL_TEXT_TERTIARY;
	return riskLevel.value.color;
});

const progressPercentage = computed(() => {
	if (props.score === undefined) return 0;
	return (props.score / RISK_LEVELS.CRITICAL.threshold) * 100;
});
</script>

<template>
	<n-card :bordered="false" class="risk-score-card">
		<div class="risk-score-header">
			<div class="risk-score-main">
				<div class="risk-score-value">{{ score !== undefined ? score.toFixed(1) : '-' }}</div>
				<div class="risk-score-label">CVSS 评分</div>
			</div>
			<div v-if="riskLevel" class="risk-score-level">
				<n-tag :color="{ color: riskLevel.color, textColor: '#FFFFFF', borderColor: riskLevel.color }" size="large">
					{{ riskLevel.label }}
				</n-tag>
			</div>
		</div>
		<div class="risk-score-progress">
			<n-progress
				type="line"
				:percentage="progressPercentage"
				:color="progressColor"
				:show-indicator="false"
				:height="8"
				:border-radius="4"
			/>
			<div class="risk-score-scale">
				<span>0</span>
				<span>10</span>
			</div>
		</div>
	</n-card>
</template>

<style scoped>
.risk-score-card {
	background: linear-gradient(135deg, #FAF9F8 0%, #FFFFFF 100%);
	border: 1px solid #EDEBE9;
	border-radius: 8px;
	padding: 24px;
}

.risk-score-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16px;
}

.risk-score-main {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.risk-score-value {
	font-size: 48px;
	font-weight: 700;
	color: #323130;
	line-height: 1;
}

.risk-score-label {
	font-size: 14px;
	color: #605E5C;
	font-weight: 400;
}

.risk-score-level {
	flex-shrink: 0;
}

.risk-score-progress {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.risk-score-scale {
	display: flex;
	justify-content: space-between;
	font-size: 12px;
	color: #8A8886;
}
</style>
