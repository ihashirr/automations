import type { SceneContent } from '../../core/content';

type PhoneLaunchScreenProps = {
	content: SceneContent;
	exitProgress: number;
	frame: number;
	notificationProgress: number;
	progress: number;
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

export function PhoneLaunchScreen({
	content,
	exitProgress,
	frame,
	notificationProgress,
	progress,
}: PhoneLaunchScreenProps) {
	const firstMessage = content.messages.find((message) => message.type === 'user');
	const enter = clamp(progress);
	const exit = clamp(exitProgress);
	const notification = clamp(notificationProgress);
	const notificationRest = Math.max(0, 1 - notification);
	const pulse = 0.5 + Math.sin(frame / 9) * 0.5;
	const openingDots = '.'.repeat((Math.floor(frame / 18) % 3) + 1);
	const opacity = enter * (1 - exit);

	return (
		<div
			style={{
				background:
					'linear-gradient(180deg, #0C211D 0%, #123B33 48%, #081512 100%)',
				color: '#F6FFFD',
				height: '100%',
				inset: 0,
				opacity,
				overflow: 'hidden',
				padding: '86px 22px 28px',
				position: 'absolute',
				transform: `scale(${0.985 + enter * 0.015}) translateY(${exit * -18}px)`,
				width: '100%',
				zIndex: 4,
			}}
		>
			<div
				style={{
					background:
						'radial-gradient(circle, rgba(37, 211, 102, 0.36), transparent 62%)',
					height: 420,
					left: '50%',
					opacity: 0.76,
					position: 'absolute',
					top: 44,
					transform: `translateX(-50%) scale(${0.84 + enter * 0.16})`,
					width: 420,
				}}
			/>
			<div
				style={{
					alignItems: 'center',
					display: 'flex',
					flexDirection: 'column',
					gap: 18,
					position: 'relative',
					zIndex: 1,
				}}
			>
					<div
						style={{
							alignItems: 'center',
							backgroundColor: '#25D366',
							borderRadius: 26,
							boxShadow: `0 22px 46px rgba(37, 211, 102, 0.28), 0 0 ${24 + pulse * 34}px rgba(37, 211, 102, ${0.1 + notification * 0.28})`,
							display: 'flex',
							height: 82,
							justifyContent: 'center',
							transform: `translateY(${18 * (1 - enter) - pulse * notification * 5}px) scale(${1 + pulse * notification * 0.03})`,
							width: 82,
						}}
					>
					<svg
						aria-hidden
						viewBox="0 0 32 32"
						style={{ height: 48, width: 48 }}
					>
						<path
							d="M16 4.3A11.4 11.4 0 006.2 21.5L5 27l5.6-1.4A11.4 11.4 0 1016 4.3z"
							fill="none"
							stroke="#FFFFFF"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2.4"
						/>
						<path
							d="M12.1 10.9c-.3-.7-.7-.7-1-.7h-.8c-.3 0-.8.1-1.2.6-.4.5-1.5 1.5-1.5 3.6s1.5 4.1 1.8 4.4c.2.3 3 4.8 7.4 6.4 3.6 1.4 4.4 1.1 5.2 1 .8-.1 2.6-1.1 2.9-2.1.4-1 .4-1.9.3-2.1-.1-.2-.4-.3-.8-.5l-2.8-1.4c-.4-.2-.7-.2-1 .2-.3.5-1.1 1.4-1.4 1.7-.3.3-.5.3-.9.1-.4-.2-1.8-.7-3.4-2.1-1.3-1.1-2.1-2.5-2.4-2.9-.3-.5 0-.7.2-.9.2-.2.4-.5.7-.8.2-.3.3-.5.5-.9.2-.3.1-.6 0-.8l-1.3-3z"
							fill="#FFFFFF"
						/>
					</svg>
				</div>
				<div
					style={{
						fontSize: 15,
						fontWeight: 750,
						letterSpacing: 0,
						opacity: 0.78,
						textTransform: 'uppercase',
					}}
				>
					incoming customer
				</div>
					<div
						style={{
							background: 'rgba(255, 255, 255, 0.13)',
							backdropFilter: 'blur(16px)',
							border: '1px solid rgba(255, 255, 255, 0.14)',
							borderRadius: 24,
							boxShadow: `0 22px 56px rgba(0, 0, 0, 0.26), 0 0 ${notification * 34}px rgba(37, 211, 102, 0.18)`,
							display: 'flex',
							flexDirection: 'column',
							gap: 10,
							opacity: notification,
							padding: '18px 18px 16px',
							transform: `translateY(${22 * (1 - enter) - Math.sin(notification * Math.PI * 2.4) * 12 * notificationRest}px) scale(${0.96 + notification * 0.04})`,
							width: '100%',
							WebkitBackdropFilter: 'blur(16px)',
						}}
				>
					<div
						style={{
							alignItems: 'center',
							display: 'flex',
							gap: 10,
						}}
					>
						<div
							style={{
								backgroundColor: '#FFFFFF',
								borderRadius: 999,
								height: 10,
								opacity: 0.86,
								width: 10,
							}}
						/>
						<div
							style={{
								fontSize: 18,
								fontWeight: 760,
								letterSpacing: 0,
							}}
						>
							{content.businessName}
						</div>
					</div>
					<div
						style={{
							color: 'rgba(246, 255, 253, 0.82)',
							fontSize: 18,
							fontWeight: 560,
							lineHeight: 1.35,
						}}
					>
						{firstMessage?.text}
					</div>
				</div>
					<div
						style={{
							color: 'rgba(246, 255, 253, 0.68)',
							fontFamily: 'monospace',
							fontSize: 14,
							fontWeight: 700,
							letterSpacing: 0,
							marginTop: 4,
							opacity: clamp((notification - 0.24) / 0.76),
						}}
					>
					opening WhatsApp{openingDots}
				</div>
			</div>
		</div>
	);
}
