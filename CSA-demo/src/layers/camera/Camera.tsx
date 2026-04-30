import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, useVideoConfig } from 'remotion';

type CameraProps = {
	frame: number;
	focusProgress?: number;
	children: ReactNode;
};

export function Camera({ frame, focusProgress = 0, children }: CameraProps) {
	const { durationInFrames } = useVideoConfig();
	const progress = durationInFrames > 0 ? frame / durationInFrames : 0;

	// Keep the camera moving in, but preserve enough phone context for the chat payoff.
	const baseScale = interpolate(progress, [0, 1], [1.18, 1.56], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	const driftX = Math.sin(frame / 60) * 12;
	const driftY = Math.sin(frame / 90) * 8;

	// Cinematic Focus (Bullet-Time)
	// When focusProgress increases (during thinking), we push in even further and tilt
	const focusScale = focusProgress * 0.12;
	const rotateX = focusProgress * 5;
	const rotateY = focusProgress * -4;

	const scale = baseScale + focusScale;

	return (
		<AbsoluteFill
			style={{
				alignItems: 'center',
				display: 'flex',
				justifyContent: 'center',
				padding: 32,
				perspective: 1200,
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'center',
					transform: `translate3d(${driftX}px, ${driftY}px, 0) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
					transformStyle: 'preserve-3d',
					width: '100%',
				}}
			>
				{children}
			</div>
		</AbsoluteFill>
	);
}
