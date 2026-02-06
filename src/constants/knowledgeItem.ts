//知识条目相关常量
export const LAYOUT = {
	BREAKPOINT_MOBILE: 768,
	MASTER_WIDTH_DESKTOP: '35%',
	MASTER_WIDTH_MOBILE: '100%',
	DETAIL_WIDTH_DESKTOP: '65%',
} as const;

export const SPACING = {
	XS: '4px',
	SM: '8px',
	MD: '12px',
	LG: '16px',
	XL: '20px',
	XXL: '24px',
	XXXL: '32px',
} as const;

export const COLORS = {
	NEUTRAL_BACKGROUND: '#FAF9F8',
	NEUTRAL_BORDER: '#EDEBE9',
	NEUTRAL_TEXT_PRIMARY: '#323130',
	NEUTRAL_TEXT_SECONDARY: '#605E5C',
	NEUTRAL_TEXT_TERTIARY: '#8A8886',
	BRAND_PRIMARY: '#0078D4',
	BRAND_PRIMARY_LIGHT: '#E8F4FD',
	SUCCESS: '#107C10',
	WARNING: '#FFAA44',
	ERROR: '#D13438',
	INFO: '#0078D4',
} as const;

export const RISK_LEVELS = {
	CRITICAL: { value: 'critical', label: '极高', threshold: 9.0, color: COLORS.ERROR },
	HIGH: { value: 'high', label: '高', threshold: 7.0, color: '#FF8C00' },
	MEDIUM: { value: 'medium', label: '中', threshold: 4.0, color: COLORS.WARNING },
	LOW: { value: 'low', label: '低', threshold: 0.1, color: COLORS.SUCCESS },
	NONE: { value: 'none', label: '无', threshold: 0, color: COLORS.NEUTRAL_TEXT_TERTIARY },
} as const;

export const CVSS_COEFFICIENTS = {
	AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
	AC: { L: 0.77, H: 0.44 },
	PR: { N: 0.85, L: 0.62, H: 0.27 },
	UI: { N: 0.85, R: 0.62 },
	IMPACT: { C: 0.22, I: 0.22, A: 0.22 },
	MULTIPLIER: 1.08,
	MAX_SCORE: 10,
} as const;

export const ANIMATION = {
	DURATION_FAST: '150ms',
	DURATION_NORMAL: '200ms',
	DURATION_SLOW: '300ms',
	EASING: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;
