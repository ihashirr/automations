import type { SceneName } from './timeline';

export type ConversationMessage = {
	type: 'user' | 'ai';
	text: string;
	timestamp?: string;
};

export type SceneContent = {
	title: string;
	subtitle: string;
	businessName: string;
	avatarLabel: string;
	statusLabel: string;
	inputPlaceholder: string;
	messages: ConversationMessage[];
	pendingUserLabel: string;
	typingLabel: string;
	pendingResponseLabel: string;
	thinkingLabel: string;
	idleSystemLabel: string;
	activeSystemLabel: string;
	perceptionLabel: string;
};

const customerLeadContent: SceneContent = {
	title: 'Retail Inventory Agent',
	subtitle: 'WhatsApp lead handled in real time',
	businessName: 'Markt Footwear',
	avatarLabel: 'MF',
	statusLabel: 'online',
	inputPlaceholder: 'Message',
	messages: [
		{
			type: 'user',
			text: 'Do you have black shoes size 42?',
			timestamp: '2:31',
		},
		{
			type: 'ai',
			text: 'Yes, we have them in stock. Would you like me to place the order?',
			timestamp: '2:32',
		},
	],
	pendingUserLabel: 'Waiting for incoming customer message...',
	typingLabel: 'Agent is composing a reply...',
	pendingResponseLabel: 'Reply pending.',
	thinkingLabel: 'Inventory lookup, intent routing, and reply drafting in progress.',
	idleSystemLabel: 'System activity: waiting for a WhatsApp lead',
	activeSystemLabel: 'System activity: checking stock, context, and close-ready response logic',
	perceptionLabel: 'Stock verified. Conversion response prepared.',
};

export const content: Record<SceneName, SceneContent> = {
	scene1: customerLeadContent,
	scene2: customerLeadContent,
	scene3: customerLeadContent,
};
