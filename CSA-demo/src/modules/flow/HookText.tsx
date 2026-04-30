type HookTextProps = {
	active: boolean;
	frame: number;
	opacity: number;
};

type TypeTextProps = {
	text: string;
	start: number;
	speed?: number;
	frame: number;
};

type HookMessage = Omit<TypeTextProps, 'frame'> & {
	tone: 'calm' | 'interrupt' | 'impact' | 'resolve';
	x: number;
};

const pauseForChar = (char: string, index: number) => {
	if (char === ' ') {
		return 3;
	}

	if (char === '.' || char === ',' || char === '!') {
		return 5;
	}

	return index > 0 && index % 7 === 0 ? 0.75 : 0;
};

const getTypedLength = (text: string, elapsed: number, speed: number) => {
	if (elapsed <= 0) {
		return 0;
	}

	let cursor = 0;

	for (let index = 0; index < text.length; index += 1) {
		cursor += speed + pauseForChar(text[index], index);

		if (elapsed < cursor) {
			return index;
		}
	}

	return text.length;
};

const getTypingDuration = (text: string, speed: number) => {
	return text.split('').reduce(
		(total, char, index) => total + speed + pauseForChar(char, index),
		0,
	);
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

export const TypeText = ({
	text,
	start,
	speed = 2,
	frame,
}: TypeTextProps) => {
	const progress = Math.max(frame - start, 0);
	const length = getTypedLength(text, progress, speed);

	return text.slice(0, length);
};

const Cursor = ({ frame }: { frame: number }) => (
	<span
		style={{
			opacity: Math.floor(frame / 20) % 2 === 0 ? 1 : 0.12,
		}}
	>
		|
	</span>
);

const HOOK_MESSAGES: HookMessage[] = [
	{
		text: 'Customers message you...',
		start: 8,
		speed: 1.65,
		tone: 'calm',
		x: -72,
	},
	{
		text: 'You reply late',
		start: 52,
		speed: 1.45,
		tone: 'interrupt',
		x: 58,
	},
	{
		text: 'You lose the sale',
		start: 88,
		speed: 1.3,
		tone: 'impact',
		x: -28,
	},
	{
		text: 'Now watch this',
		start: 122,
		speed: 1.45,
		tone: 'resolve',
		x: 38,
	},
];

const toneStyles = {
	calm: {
		background: 'rgba(255, 255, 255, 0.62)',
		color: 'rgba(31, 42, 36, 0.58)',
		fontSize: 40,
		fontWeight: 620,
		shadow: '0 14px 34px rgba(25, 72, 61, 0.08)',
	},
	interrupt: {
		background: 'rgba(255, 255, 255, 0.76)',
		color: '#39443D',
		fontSize: 46,
		fontWeight: 680,
		shadow: '0 16px 42px rgba(25, 72, 61, 0.12)',
	},
	impact: {
		background: 'rgba(255, 255, 255, 0.88)',
		color: '#17231E',
		fontSize: 58,
		fontWeight: 780,
		shadow: '0 22px 54px rgba(10, 24, 18, 0.18)',
	},
	resolve: {
		background: 'rgba(245, 255, 251, 0.9)',
		color: '#075E54',
		fontSize: 60,
		fontWeight: 800,
		shadow:
			'0 24px 60px rgba(7, 94, 84, 0.18), 0 0 34px rgba(0, 255, 194, 0.2)',
	},
} as const;

export function HookText({
	active,
	frame,
	opacity,
}: HookTextProps) {
	if (!active && opacity <= 0) {
		return null;
	}

	const statusProgress = clamp((frame - 6) / 20);
	const handoffProgress = clamp((frame - 122) / 34);
	const unansweredSeconds = String(Math.min(18, Math.floor(frame / 10))).padStart(
		2,
		'0',
	);
	const statusLabel =
		handoffProgress > 0.2 ? 'AUTO-REPLY READY' : 'LIVE CUSTOMER INBOX';
	const timerLabel =
		handoffProgress > 0.2 ? 'handoff queued' : `00:${unansweredSeconds} unanswered`;

	return (
		<div
			style={{
				alignItems: 'center',
				display: 'flex',
				height: '100%',
				justifyContent: 'center',
				opacity,
				padding: 64,
				pointerEvents: 'none',
				width: '100%',
			}}
		>
			<div
				style={{
					alignItems: 'center',
					display: 'flex',
					flexDirection: 'column',
					gap: 14,
					minHeight: 430,
					textAlign: 'left',
					width: 760,
				}}
			>
				<div
					style={{
						alignItems: 'center',
						background: 'rgba(255, 255, 255, 0.68)',
						backdropFilter: 'blur(14px)',
						border: '1px solid rgba(255, 255, 255, 0.62)',
						borderRadius: 999,
						boxShadow: '0 18px 42px rgba(25, 72, 61, 0.1)',
						color: '#23342D',
						display: 'grid',
						gap: 14,
						gridTemplateColumns: 'auto 1fr auto',
						letterSpacing: 0,
						minWidth: 520,
						opacity: statusProgress,
						padding: '12px 16px',
						transform: `translateY(${12 * (1 - statusProgress)}px)`,
						WebkitBackdropFilter: 'blur(14px)',
					}}
				>
					<div
						style={{
							background:
								handoffProgress > 0.2
									? '#25D366'
									: 'rgba(255, 94, 75, 0.88)',
							borderRadius: 999,
							boxShadow:
								handoffProgress > 0.2
									? '0 0 22px rgba(37, 211, 102, 0.35)'
									: '0 0 22px rgba(255, 94, 75, 0.28)',
							height: 12,
							width: 12,
						}}
					/>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
						<div
							style={{
								fontSize: 13,
								fontWeight: 780,
							}}
						>
							{statusLabel}
						</div>
						<div
							style={{
								backgroundColor: 'rgba(31, 42, 36, 0.1)',
								borderRadius: 999,
								height: 4,
								overflow: 'hidden',
								width: '100%',
							}}
						>
							<div
								style={{
									background:
										handoffProgress > 0.2
											? '#25D366'
											: 'rgba(31, 42, 36, 0.48)',
									borderRadius: 999,
									height: '100%',
									transform: `scaleX(${clamp(frame / 220)})`,
									transformOrigin: 'left center',
									width: '100%',
								}}
							/>
						</div>
					</div>
					<div
						style={{
							color: handoffProgress > 0.2 ? '#075E54' : 'rgba(31, 42, 36, 0.62)',
							fontFamily: 'monospace',
							fontSize: 16,
							fontWeight: 700,
						}}
					>
						{timerLabel}
					</div>
				</div>
				{HOOK_MESSAGES.map((message) => {
					if (frame < message.start) {
						return null;
					}

					const speed = message.speed ?? 2;
					const typedText = TypeText({
						text: message.text,
						start: message.start,
						speed,
						frame,
					});
					const typingDuration = getTypingDuration(message.text, speed);
					const progress = clamp((frame - message.start) / typingDuration);
					const isTyping = typedText.length < message.text.length;
					const tone = toneStyles[message.tone];

					return (
						<div
							key={message.text}
							style={{
								alignSelf: 'center',
								background: tone.background,
								backdropFilter: 'blur(10px)',
								border: '1px solid rgba(255, 255, 255, 0.64)',
								borderRadius: 16,
								boxShadow: tone.shadow,
								color: tone.color,
								fontSize: tone.fontSize,
								fontWeight: tone.fontWeight,
								letterSpacing: 0,
								lineHeight: 1.08,
								minHeight: 70,
								minWidth: message.tone === 'impact' ? 510 : 430,
								opacity: progress,
								padding: '16px 20px',
								transform: `translateX(${message.x}px) translateY(${14 * (1 - progress)}px) scale(${0.98 + progress * 0.02})`,
								whiteSpace: 'pre',
								WebkitBackdropFilter: 'blur(10px)',
							}}
						>
							{typedText}
							{isTyping ? <Cursor frame={frame} /> : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}
