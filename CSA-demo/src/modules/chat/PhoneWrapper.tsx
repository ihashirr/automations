import type { ReactNode } from 'react';

type PhoneWrapperProps = {
	active: boolean;
	progress?: number;
	notificationProgress?: number;
	children: ReactNode;
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

export function PhoneWrapper({
	active,
	notificationProgress = 0,
	progress = active ? 1 : 0,
	children,
}: PhoneWrapperProps) {
	const entranceProgress = clamp(progress);
	const attentionProgress = clamp(notificationProgress);
	const entrance = 1 - entranceProgress;
	const opacity = active ? clamp(entranceProgress * 1.2) : 0;
	const translateY = 180 * entrance;
	const attentionFalloff = Math.max(0, 1 - attentionProgress);
	const attentionShake = Math.sin(attentionProgress * Math.PI * 8) * 10 * attentionFalloff;
	const attentionLift = Math.sin(attentionProgress * Math.PI) * -18;
	const scale =
		0.92 +
		entranceProgress * 0.08 +
		Math.sin(attentionProgress * Math.PI) * 0.018;

	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'center',
				width: '100%',
				position: 'relative',
			}}
		>
			<div
				style={{
					aspectRatio: '390 / 844',
					// 1. Lighting gradient for the frame instead of flat black
					background: 'linear-gradient(135deg, #0a0a0a 0%, #151515 50%, #1a1a1a 100%)',
					// 2. Edge highlight (metal/glass transition)
					border: '1px solid rgba(255, 255, 255, 0.08)',
					borderRadius: 55, // 6. Perfect outer radius
					boxShadow:
						// Deep drop shadow
						'0 50px 100px -20px rgba(0, 0, 0, 0.4), ' +
						// Inner black frame recess
						'inset 0 0 0 2px #000000, ' +
						// Inner glare / edge highlight
						'inset 0 2px 4px rgba(255, 255, 255, 0.1)',
					display: 'flex',
					filter:
						attentionProgress > 0
							? `drop-shadow(0 0 ${26 * attentionFalloff}px rgba(37, 211, 102, 0.28))`
							: 'none',
					height: 1180,
					opacity,
					// Note: removed overflow: hidden so buttons can stick out
					padding: 18, // 6. Consistent bezel thickness
					transform: `translateX(${attentionShake}px) translateY(${translateY + attentionLift}px) scale(${scale})`,
					width: 546,
					position: 'relative',
					zIndex: 2,
				}}
			>
				{/* Hardware Buttons */}
				<div style={{ position: 'absolute', top: 180, left: -4, width: 4, height: 60, backgroundColor: '#1a1a1a', borderRadius: '4px 0 0 4px', boxShadow: 'inset 1px 0 2px rgba(255,255,255,0.1)' }} />
				<div style={{ position: 'absolute', top: 260, left: -4, width: 4, height: 60, backgroundColor: '#1a1a1a', borderRadius: '4px 0 0 4px', boxShadow: 'inset 1px 0 2px rgba(255,255,255,0.1)' }} />
				<div style={{ position: 'absolute', top: 200, right: -4, width: 4, height: 90, backgroundColor: '#1a1a1a', borderRadius: '0 4px 4px 0', boxShadow: 'inset -1px 0 2px rgba(255,255,255,0.1)' }} />

				{/* Inner Screen */}
				<div
					style={{
						backgroundColor: '#FFFFFF',
						// 6. Mathematically perfect inner corner: 55 (outer) - 14 (padding) = 41
						borderRadius: 41,
						display: 'flex',
						flex: 1,
						flexDirection: 'column',
						height: '100%',
						overflow: 'hidden', // Keeps the screen content inside
						width: '100%',
						position: 'relative',
						// 7. Depth separation (recessed screen)
						boxShadow: 'inset 0 0 12px rgba(0,0,0,0.15), inset 0 0 2px rgba(0,0,0,0.4)',
					}}
				>
					{/* 4. Glass Reflection Overlay */}
					<div
						style={{
							position: 'absolute',
							top: 0, left: 0, right: 0, bottom: 0,
							background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%, rgba(0,0,0,0.04) 100%)',
							pointerEvents: 'none',
							zIndex: 100, // On top of everything
						}}
					/>

					{/* 5. Micro Imperfection (Vignette) */}
					<div
						style={{
							position: 'absolute',
							top: 0, left: 0, right: 0, bottom: 0,
							background: 'radial-gradient(circle at center, transparent 60%, rgba(0,0,0,0.06) 150%)',
							pointerEvents: 'none',
							zIndex: 99,
						}}
					/>

					{/* 3. Dynamic Island / Notch */}
					<div
						style={{
							position: 'absolute',
							top: 12,
							left: '50%',
							transform: 'translateX(-50%)',
							width: 120,
							height: 35,
							backgroundColor: '#0a0a0a',
							borderRadius: 20,
							zIndex: 50,
							pointerEvents: 'none',
							// 3. Shadow under notch and inner edge glow
							boxShadow: '0 8px 24px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 2px 4px rgba(255,255,255,0.08)',
						}}
					>
						{/* Camera lenses */}
						<div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, borderRadius: '50%', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.04)', boxShadow: 'inset 0 0 4px rgba(255,255,255,0.1)' }} />
						<div style={{ position: 'absolute', right: 30, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.04)' }} />
					</div>

					{/* App Content */}
					<div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 10 }}>
						{children}
					</div>
				</div>
			</div>
		</div>
	);
}
