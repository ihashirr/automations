export type SceneTimeline = {
	start: number;
	hookStart: number;
	phoneEnter: number;
	notificationHit: number;
	hookExit: number;
	chatStart: number;
	messageIn: number;
	typingStart: number;
	thinking: number;
	response: number;
	end: number;
};

export const timeline = {
	scene1: {
		start: 0,
		hookStart: 0,
		phoneEnter: 999,
		notificationHit: 999,
		hookExit: 186,
		chatStart: 999,
		messageIn: 999,
		typingStart: 999,
		thinking: 999,
		response: 999,
		end: 186,
	},
	scene2: {
		start: 0,
		hookStart: 999,
		phoneEnter: 0,
		notificationHit: 40,
		hookExit: 999,
		chatStart: 999,
		messageIn: 999,
		typingStart: 999,
		thinking: 999,
		response: 999,
		end: 120,
	},
	scene3: {
		start: 0,
		hookStart: 999,
		phoneEnter: -36,
		notificationHit: 999,
		hookExit: 999,
		chatStart: 0,
		messageIn: 44,
		typingStart: 98,
		thinking: 156,
		response: 238,
		end: 378,
	},
} as const satisfies Record<string, SceneTimeline>;

export type SceneName = keyof typeof timeline;
