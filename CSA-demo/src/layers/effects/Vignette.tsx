import { AbsoluteFill } from 'remotion';

export function Vignette() {
	return (
		<AbsoluteFill
			style={{
				boxShadow: 'inset 0 0 120px rgba(0, 0, 0, 0.2)',
				pointerEvents: 'none',
			}}
		/>
	);
}
