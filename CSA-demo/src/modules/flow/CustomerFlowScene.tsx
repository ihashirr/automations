import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { content } from '../../core/content';
import { useScene } from '../../core/orchestrator';
import type { SceneComponentProps } from '../../core/registry';
import { Background } from '../../layers/background/Background';
import { Camera } from '../../layers/camera/Camera';
import { Vignette } from '../../layers/effects/Vignette';
import { PhoneLaunchScreen } from '../chat/PhoneLaunchScreen';
import { PhoneWrapper } from '../chat/PhoneWrapper';
import { WhatsAppUI } from '../chat/WhatsAppUI';
import { ThinkingPulse } from '../perception/ThinkingPulse';
import { SystemActivity } from '../system/SystemActivity';
import { HookText } from './HookText';

export function ProblemPunchScene({ sceneId }: SceneComponentProps) {
	const frame = useCurrentFrame();
	const state = useScene(sceneId, frame);

	return (
		<AbsoluteFill>
			<Background
				focusProgress={state.introOpacity * 0.9}
				frame={frame}
			/>
			<HookText
				active={state.showHook}
				frame={frame}
				opacity={state.introOpacity}
			/>
			<Vignette />
		</AbsoluteFill>
	);
}

export function IncomingRealityScene({ sceneId }: SceneComponentProps) {
	const frame = useCurrentFrame();
	const state = useScene(sceneId, frame);
	const data = content[sceneId];

	return (
		<AbsoluteFill>
			<Background
				focusProgress={state.phoneProgress * 0.6}
				frame={frame}
			/>
			<Camera frame={frame}>
				<PhoneWrapper
					active={state.showPhone}
					progress={state.phoneProgress}
					notificationProgress={state.notificationProgress}
				>
					<PhoneLaunchScreen
						content={data}
						exitProgress={0}
						frame={frame}
						notificationProgress={state.notificationProgress}
						progress={state.phoneProgress}
					/>
				</PhoneWrapper>
			</Camera>
			<SystemActivity
				active={false}
				activeLabel={data.activeSystemLabel}
				idleLabel={data.idleSystemLabel}
				progress={state.phoneProgress}
			/>
			<Vignette />
		</AbsoluteFill>
	);
}

export function ChatWorldScene({ sceneId }: SceneComponentProps) {
	const frame = useCurrentFrame();
	const state = useScene(sceneId, frame);
	const data = content[sceneId];

	return (
		<AbsoluteFill>
			<Background
				focusProgress={state.isThinking ? state.thinkingPulseProgress * 0.8 : 0.2}
				frame={frame}
			/>
			<Camera frame={frame} focusProgress={state.thinkingPulseProgress}>
				<PhoneWrapper
					active={state.showPhone}
					progress={state.phoneProgress}
				>
					<div
						style={{
							display: 'flex',
							flex: 1,
							height: '100%',
							opacity: state.chatProgress,
							transform: `translateY(${32 * (1 - state.chatProgress)}px) scale(${0.985 + state.chatProgress * 0.015})`,
							width: '100%',
						}}
					>
						<WhatsAppUI
							state={state}
							content={data}
						/>
					</div>
				</PhoneWrapper>
			</Camera>
			<SystemActivity
				active={state.isTyping || state.isThinking || state.showResponse}
				activeLabel={data.activeSystemLabel}
				idleLabel={data.idleSystemLabel}
				progress={state.phoneProgress}
			/>
			<ThinkingPulse
				active={state.isThinking}
				progress={state.thinkingPulseProgress}
			/>
			<Vignette />
		</AbsoluteFill>
	);
}
