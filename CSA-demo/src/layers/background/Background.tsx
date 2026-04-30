import { AbsoluteFill } from 'remotion';

type BackgroundProps = {
	frame?: number;
	focusProgress?: number;
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

export function Background({
	frame = 0,
	focusProgress = 0,
}: BackgroundProps) {
	const focus = clamp(focusProgress);
	
	// Slow ambient movement
	const sweepX = 50 + Math.sin(frame / 120) * 15;
	const sweepY = 50 + Math.cos(frame / 150) * 15;
	
	// Secondary slower orbit for depth
	const orbX = 50 + Math.sin(frame / 200) * 30;
	const orbY = 50 + Math.cos(frame / 180) * 20;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#0a0d14', // Deep, dark cinematic base
				transform: `scale(${1 + focus * 0.05})`,
				filter: `blur(${focus * 4}px)`,
				overflow: 'hidden',
			}}
		>
			{/* Core Ambient Glow */}
			<AbsoluteFill
				style={{
					background: `radial-gradient(circle at ${sweepX}% ${sweepY}%, rgba(37, 211, 102, 0.15), transparent 60%)`,
				}}
			/>
			
			{/* Secondary Orb for volumetric feel */}
			<AbsoluteFill
				style={{
					background: `radial-gradient(circle at ${orbX}% ${orbY}%, rgba(20, 100, 200, 0.08), transparent 50%)`,
					mixBlendMode: 'screen',
				}}
			/>

			{/* Subtle Cyber Grid */}
			<AbsoluteFill
				style={{
					backgroundImage: `
						linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
						linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
					`,
					backgroundSize: '40px 40px',
					backgroundPosition: `center ${frame * 0.5}px`, // Slowly moves down
					opacity: 0.6,
					// Fade out grid towards edges
					maskImage: 'radial-gradient(circle at center, black 20%, transparent 80%)',
					WebkitMaskImage: 'radial-gradient(circle at center, black 20%, transparent 80%)',
				}}
			/>
			
			{/* Vignette to frame the scene perfectly */}
			<AbsoluteFill
				style={{
					background: 'radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.7) 100%)',
					pointerEvents: 'none',
				}}
			/>
		</AbsoluteFill>
	);
}
