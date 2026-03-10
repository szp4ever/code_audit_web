<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NProgress, NTag } from 'naive-ui';
import { RISK_LEVELS, COLORS } from '@/constants/knowledgeItem';

interface Props {
	/** 确切分数（维度填全时） */
	score?: number;
	/** 区间分数（维度未填全时） */
	scoreRange?: { min: number; max: number };
	/** 风险等级（由父组件传入，用于区间时按 max 判定） */
	riskLevel?: { label: string; color: string };
	showDetails?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	score: undefined,
	scoreRange: undefined,
	riskLevel: undefined,
	showDetails: false,
});

/** 显示文本：确切分数 或 区间 */
const displayValue = computed(() => {
	if (props.score != null) return props.score.toFixed(1);
	if (props.scoreRange) return `${props.scoreRange.min.toFixed(1)} - ${props.scoreRange.max.toFixed(1)}`;
	return '-';
});

const internalRiskLevel = computed(() => {
	if (props.riskLevel) return props.riskLevel;
	const s = props.score ?? props.scoreRange?.max;
	if (s === undefined) return null;
	if (s >= RISK_LEVELS.CRITICAL.threshold) return RISK_LEVELS.CRITICAL;
	if (s >= RISK_LEVELS.HIGH.threshold) return RISK_LEVELS.HIGH;
	if (s >= RISK_LEVELS.MEDIUM.threshold) return RISK_LEVELS.MEDIUM;
	if (s >= RISK_LEVELS.LOW.threshold) return RISK_LEVELS.LOW;
	return RISK_LEVELS.NONE;
});

const progressColor = computed(() => {
	if (internalRiskLevel.value) return internalRiskLevel.value.color;
	return COLORS.NEUTRAL_TEXT_TERTIARY;
});

/** 进度条：确切分数用单点，区间用 min-max 范围 */
const progressPercentage = computed(() => {
	if (props.score != null) return (props.score / 10) * 100;
	if (props.scoreRange) return (props.scoreRange.max / 10) * 100;
	return 0;
});

/** 区间模式：进度条显示 min 到 max 的区间 */
const isRangeMode = computed(() => !!props.scoreRange && !props.score);
const rangeMinPercent = computed(() => (props.scoreRange ? (props.scoreRange.min / 10) * 100 : 0));
const rangeMaxPercent = computed(() => (props.scoreRange ? (props.scoreRange.max / 10) * 100 : 0));
</script>

<template>
	<n-card :bordered="false" class="risk-score-card">
		<div class="risk-score-header">
			<div class="risk-score-main">
				<div class="risk-score-value">{{ displayValue }}</div>
				<div class="risk-score-label">CVSS 评分 / 10.0</div>
			</div>
			<div v-if="internalRiskLevel" class="risk-score-level">
				<n-tag :color="{ color: internalRiskLevel.color, textColor: '#FFFFFF', borderColor: internalRiskLevel.color }" size="large">
					{{ internalRiskLevel.label }}
				</n-tag>
			</div>
		</div>
		<div class="risk-score-progress">
			<!-- 区间模式：显示 min-max 范围条 -->
			<div v-if="isRangeMode" class="progress-range-wrap">
				<div class="progress-track">
					<div
						class="progress-range-fill"
						:style="{
							left: rangeMinPercent + '%',
							width: (rangeMaxPercent - rangeMinPercent) + '%',
							backgroundColor: progressColor,
						}"
					/>
				</div>
			</div>
			<!-- 确切分数：单点进度条 -->
			<n-progress
				v-else
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
	margin-top: 8px;
}

.progress-range-wrap {
	width: 100%;
}

.progress-track {
	position: relative;
	height: 8px;
	background: #EDEBE9;
	border-radius: 4px;
	overflow: hidden;
}

.progress-range-fill {
	position: absolute;
	top: 0;
	height: 100%;
	border-radius: 4px;
	transition: left 0.2s, width 0.2s;
}
</style>
