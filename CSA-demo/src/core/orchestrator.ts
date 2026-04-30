import { spring, useVideoConfig } from 'remotion';
import { timeline, type SceneName } from './timeline';

const clamp = (value: number) => {
	return Math.min(Math.max(value, 0), 1);
};

const progressBetween = (frame: number, start: number, end: number) => {
	if (end <= start) {
		return frame >= start ? 1 : 0;
	}

	return clamp((frame - start) / (end - start));
};

// Kept for simple fades
const easeOut = (value: number) => {
	const clamped = clamp(value);
	return 1 - Math.pow(1 - clamped, 3);
};

const fadeFromProgress = (value: number) => {
	return easeOut(progressBetween(value, 0.58, 1));
};

const typingDots = (frame: number, start: number, end: number) => {
	const span = Math.max(end - start, 1);
	const phase = ((frame - start) / span) * 3;

	return [0, 1, 2].map((offset) => {
		const pulse = Math.sin((phase + offset * 0.42) * Math.PI * 2);
		return clamp(0.55 + pulse * 0.45);
	}) as [number, number, number];
};

export type SceneState = {
	phase: 'problem' | 'incoming' | 'chat';
	showIntro: boolean;
	showHook: boolean;
	showPhone: boolean;
	showChat: boolean;
	showMessage: boolean;
	isTyping: boolean;
	isThinking: boolean;
	intelligenceMoment: boolean;
	showResponse: boolean;
	introOpacity: number;
	phoneProgress: number;
	notificationProgress: number;
	chatProgress: number;
	userMessageProgress: number;
	userTimestampProgress: number;
	typingProgress: number;
	typingDotProgresses: [number, number, number];
	aiMessageProgress: number;
	aiTimestampProgress: number;
	thinkingPulseProgress: number;
};

export const useScene = (scene: SceneName, frame: number): SceneState => {
	const { fps } = useVideoConfig();
	const t = timeline[scene];
	const hookFadeStart = t.phoneEnter + 18;
	const phase =
		frame < t.phoneEnter
			? 'problem'
			: frame < t.chatStart
				? 'incoming'
				: 'chat';
	
	// Spring Physics Upgrades
	const phoneProgress = spring({
		frame: frame - t.phoneEnter,
		fps,
		config: { damping: 14, mass: 0.8, stiffness: 120 },
	});

	const notificationProgress = spring({
		frame: frame - t.notificationHit,
		fps,
		config: { damping: 10, mass: 0.55, stiffness: 180 },
	});
	
	const chatProgress = spring({
		frame: frame - t.chatStart,
		fps,
		config: { damping: 16, mass: 0.6, stiffness: 140 },
	});
	
	const userMessageProgress = spring({
		frame: frame - t.messageIn,
		fps,
		config: { damping: 12, mass: 0.5, stiffness: 150 },
	});
	
	const aiMessageProgress = spring({
		frame: frame - t.response,
		fps,
		config: { damping: 12, mass: 0.5, stiffness: 150 },
	});
	
	const typingProgress = spring({
		frame: frame - t.typingStart,
		fps,
		config: { damping: 14, stiffness: 140 },
	});

	// For the thinking pulse, we still want a smooth ease rather than a bounce
	const thinkingPulseProgress = easeOut(progressBetween(frame, t.thinking, t.response));

	return {
		phase,
		showIntro: frame >= t.hookStart && frame < t.hookExit,
		showHook: frame >= t.hookStart && frame < t.hookExit,
		showPhone: frame >= t.phoneEnter,
		showChat: frame >= t.chatStart,
		showMessage: frame >= t.messageIn,
		isTyping: frame >= t.typingStart && frame < t.response,
		isThinking: frame >= t.thinking && frame < t.response,
		intelligenceMoment: frame === t.thinking,
		showResponse: frame >= t.response,
		introOpacity:
			frame < hookFadeStart
				? 1
				: 1 - progressBetween(frame, hookFadeStart, t.hookExit),
		phoneProgress,
		notificationProgress,
		chatProgress,
		userMessageProgress,
		userTimestampProgress: fadeFromProgress(userMessageProgress),
		typingProgress,
		typingDotProgresses: typingDots(frame, t.typingStart, t.response),
		aiMessageProgress,
		aiTimestampProgress: fadeFromProgress(aiMessageProgress),
		thinkingPulseProgress,
	};
};
