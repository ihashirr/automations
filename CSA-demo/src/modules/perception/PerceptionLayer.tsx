import { theme } from '../../core/theme';

type PerceptionLayerProps = {
	trigger: boolean;
	label: string;
};

export function PerceptionLayer({ trigger, label }: PerceptionLayerProps) {
	if (!trigger) {
		return null;
	}

	return (
		<div
			style={{
				backgroundColor: 'rgba(7, 14, 18, 0.92)',
				border: `1px solid ${theme.colors.border}`,
				borderRadius: 999,
				boxShadow: theme.glow,
				color: theme.colors.text,
				padding: '12px 18px',
				position: 'absolute',
				right: 48,
				top: 48,
			}}
		>
			{label}
		</div>
	);
}
