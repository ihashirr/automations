import { theme } from '../../core/theme';

type SystemActivityProps = {
	active: boolean;
	activeLabel: string;
	idleLabel: string;
	progress?: number;
};

export function SystemActivity({
	active,
	activeLabel,
	idleLabel,
	progress = 1,
}: SystemActivityProps) {
	const label = active ? activeLabel : idleLabel;
	const status = active ? 'agent working' : 'watching inbox';

	return (
		<div
			style={{
				alignItems: 'center',
				background: 'rgba(255, 255, 255, 0.74)',
				backdropFilter: 'blur(14px)',
				border: '1px solid rgba(255, 255, 255, 0.64)',
				borderRadius: 18,
				bottom: 54,
				boxShadow: '0 18px 48px rgba(5, 18, 20, 0.12)',
				color: '#16352F',
				display: 'grid',
				gap: 12,
				gridTemplateColumns: 'auto 1fr',
				left: 48,
				opacity: progress,
				padding: '14px 16px',
				position: 'absolute',
				transform: `translateY(${16 * (1 - progress)}px)`,
				width: 520,
				WebkitBackdropFilter: 'blur(14px)',
			}}
		>
			<div
				style={{
					alignItems: 'center',
					background: active ? '#25D366' : 'rgba(22, 53, 47, 0.12)',
					borderRadius: 999,
					display: 'flex',
					height: 42,
					justifyContent: 'center',
					width: 42,
				}}
			>
				<div
					style={{
						background: active ? '#FFFFFF' : theme.colors.muted,
						borderRadius: 999,
						boxShadow: active
							? '0 0 22px rgba(255, 255, 255, 0.64)'
							: 'none',
						height: 12,
						width: 12,
					}}
				/>
			</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
				<div
					style={{
						color: active ? '#075E54' : 'rgba(22, 53, 47, 0.64)',
						fontSize: 12,
						fontWeight: 800,
						letterSpacing: 0,
						textTransform: 'uppercase',
					}}
				>
					{status}
				</div>
				<div
					style={{
						fontSize: 17,
						fontWeight: 650,
						letterSpacing: 0,
						lineHeight: 1.26,
					}}
				>
					{label}
				</div>
			</div>
		</div>
	);
}
