import { useCurrentFrame } from 'remotion';

type ThinkingPulseProps = {
	active: boolean;
	progress: number;
};

export function ThinkingPulse({ active, progress }: ThinkingPulseProps) {
	const frame = useCurrentFrame();
	
	// Complex opacity mapping for a pulsating "boot up" feel
	const opacity = active ? 0.8 * (1 - Math.abs(progress - 0.5) * 1.5) : 0;
	// Scale starts tight and expands organically
	const scale = 0.8 + progress * 0.4;

	// Rotations for different rings
	const rot1 = frame * 2;
	const rot2 = frame * -1.5;
	const rot3 = frame * 3;

	return (
		<div
			style={{
				height: 800,
				left: '50%',
				opacity: Math.max(0, opacity),
				pointerEvents: 'none',
				position: 'absolute',
				top: '50%',
				transform: `translate(-50%, -50%) scale(${scale})`,
				width: 800,
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
			}}
		>
			{/* Inner core glow */}
			<div
				style={{
					position: 'absolute',
					width: 400,
					height: 400,
					background: 'radial-gradient(circle, rgba(37, 211, 102, 0.4), transparent 60%)',
					filter: 'blur(20px)',
					opacity: 0.6 + Math.sin(frame / 5) * 0.4, // Fast pulsing core
				}}
			/>

			<svg width="100%" height="100%" viewBox="0 0 800 800" style={{ position: 'absolute' }}>
				{/* Outer Data Ring (Dashed) */}
				<circle
					cx="400"
					cy="400"
					r="380"
					fill="none"
					stroke="rgba(37, 211, 102, 0.2)"
					strokeWidth="2"
					strokeDasharray="4 12"
					style={{
						transformOrigin: '400px 400px',
						transform: `rotate(${rot1}deg)`,
					}}
				/>

				{/* Middle Bold Ring (Fragmented) */}
				<circle
					cx="400"
					cy="400"
					r="340"
					fill="none"
					stroke="rgba(37, 211, 102, 0.4)"
					strokeWidth="6"
					strokeDasharray="100 60 20 60 300 100"
					style={{
						transformOrigin: '400px 400px',
						transform: `rotate(${rot2}deg)`,
					}}
				/>

				{/* Inner Fine Ring */}
				<circle
					cx="400"
					cy="400"
					r="280"
					fill="none"
					stroke="rgba(37, 211, 102, 0.6)"
					strokeWidth="1"
					strokeDasharray="2 4"
					style={{
						transformOrigin: '400px 400px',
						transform: `rotate(${rot3}deg)`,
					}}
				/>

				{/* Scanning Sweep */}
				<path
					d="M 400 400 L 400 20 A 380 380 0 0 1 580 50 Z"
					fill="url(#scanGradient)"
					style={{
						transformOrigin: '400px 400px',
						transform: `rotate(${frame * 4}deg)`,
						opacity: 0.4,
						mixBlendMode: 'screen',
					}}
				/>

				<defs>
					<radialGradient id="scanGradient" cx="50%" cy="50%" r="50%">
						<stop offset="0%" stopColor="rgba(37, 211, 102, 0)" />
						<stop offset="100%" stopColor="rgba(37, 211, 102, 0.8)" />
					</radialGradient>
				</defs>
			</svg>
		</div>
	);
}
