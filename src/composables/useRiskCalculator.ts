import { computed } from 'vue';
import { CVSS_COEFFICIENTS, RISK_LEVELS } from '@/constants/knowledgeItem';

export interface RiskDimensions {
	riskAttackVector?: string;
	riskComplexity?: string;
	riskPrivileges?: string;
	riskUserInteraction?: string;
	riskImpact?: string[];
}

export function useRiskCalculator(dimensions: () => RiskDimensions) {
	const calculatedRiskScore = computed(() => {
		const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = dimensions();
		
		if (!riskAttackVector && !riskComplexity && !riskPrivileges && !riskUserInteraction && (!riskImpact || riskImpact.length === 0)) {
			return null;
		}
		
		let baseScore = 0;
		if (riskAttackVector) baseScore += CVSS_COEFFICIENTS.AV[riskAttackVector as keyof typeof CVSS_COEFFICIENTS.AV] || 0;
		if (riskComplexity) baseScore += CVSS_COEFFICIENTS.AC[riskComplexity as keyof typeof CVSS_COEFFICIENTS.AC] || 0;
		if (riskPrivileges) baseScore += CVSS_COEFFICIENTS.PR[riskPrivileges as keyof typeof CVSS_COEFFICIENTS.PR] || 0;
		if (riskUserInteraction) baseScore += CVSS_COEFFICIENTS.UI[riskUserInteraction as keyof typeof CVSS_COEFFICIENTS.UI] || 0;
		
		let maxImpact = 0;
		if (riskImpact && riskImpact.length > 0) {
			riskImpact.forEach(imp => {
				maxImpact = Math.max(maxImpact, CVSS_COEFFICIENTS.IMPACT[imp as keyof typeof CVSS_COEFFICIENTS.IMPACT] || 0);
			});
			baseScore += maxImpact * 3;
		}
		
		const score = Math.min(CVSS_COEFFICIENTS.MAX_SCORE, Math.max(0, baseScore * CVSS_COEFFICIENTS.MULTIPLIER));
		return Math.round(score * 10) / 10;
	});
	
	const calculatedRiskLevel = computed(() => {
		const score = calculatedRiskScore.value;
		if (score === null) return null;
		
		if (score >= RISK_LEVELS.CRITICAL.threshold) return RISK_LEVELS.CRITICAL;
		if (score >= RISK_LEVELS.HIGH.threshold) return RISK_LEVELS.HIGH;
		if (score >= RISK_LEVELS.MEDIUM.threshold) return RISK_LEVELS.MEDIUM;
		if (score >= RISK_LEVELS.LOW.threshold) return RISK_LEVELS.LOW;
		return RISK_LEVELS.NONE;
	});
	
	return {
		calculatedRiskScore,
		calculatedRiskLevel,
	};
}
