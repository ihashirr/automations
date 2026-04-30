import { Img, staticFile } from 'remotion';
import type { ConversationMessage, SceneContent } from '../../core/content';
import type { SceneState } from '../../core/orchestrator';

const PHONE_BACKGROUND = '#E5DDD5';
const USER_BUBBLE = '#DCF8C6';
const AI_BUBBLE = '#FFFFFF';
const HEADER_COLOR = '#075E54';
const TEXT_PRIMARY = '#111B21';
const TEXT_SECONDARY = '#667781';
const WALLPAPER = `url('${staticFile('assets/chat_background_pattern.png')}')`;

type ChatState = Pick<
	SceneState,
	| 'showMessage'
	| 'isTyping'
	| 'isThinking'
	| 'showResponse'
	| 'userMessageProgress'
	| 'userTimestampProgress'
	| 'typingProgress'
	| 'typingDotProgresses'
	| 'aiMessageProgress'
	| 'aiTimestampProgress'
	| 'thinkingPulseProgress'
>;

type WhatsAppUIProps = {
	state: ChatState;
	content: SceneContent;
};

type MessageBubbleProps = {
	message: ConversationMessage;
	visible: boolean;
	progress: number;
	timestampProgress: number;
	align: 'left' | 'right';
	backgroundColor: string;
	cornerAccent: 'left' | 'right';
	showReadReceipts?: boolean;
};

const getTimestamp = (message: ConversationMessage) => {
	return message.timestamp ?? '';
};

function AttachmentIcon() {
	return (
		<svg
			aria-hidden
			viewBox="0 0 24 24"
			style={{ height: 24, width: 24 }}
		>
			<path
				d="M8.5 12.5l6.1-6.1a3 3 0 114.2 4.2l-8.5 8.5a5 5 0 11-7.1-7.1l8.9-8.9"
				fill="none"
				stroke="#667781"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
		</svg>
	);
}

function CameraIcon() {
	return (
		<svg
			aria-hidden
			viewBox="0 0 24 24"
			style={{ height: 24, width: 24 }}
		>
			<path
				d="M8 7l1.8-2h4.4L16 7h2a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2z"
				fill="none"
				stroke="#667781"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.8"
			/>
			<circle
				cx="12"
				cy="12.5"
				fill="none"
				r="3.4"
				stroke="#667781"
				strokeWidth="1.8"
			/>
		</svg>
	);
}

function EmojiIcon() {
	return (
		<svg
			aria-hidden
			viewBox="0 0 24 24"
			style={{ height: 24, width: 24 }}
		>
			<circle
				cx="12"
				cy="12"
				fill="none"
				r="9"
				stroke="#667781"
				strokeWidth="1.8"
			/>
			<circle cx="9" cy="10" fill="#667781" r="1" />
			<circle cx="15" cy="10" fill="#667781" r="1" />
			<path
				d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"
				fill="none"
				stroke="#667781"
				strokeLinecap="round"
				strokeWidth="1.8"
			/>
		</svg>
	);
}

function ReadReceipt() {
	return (
		<svg
			aria-hidden
			viewBox="0 0 18 12"
			style={{ height: 14, width: 18 }}
		>
			<path
				d="M1.5 6.5l2.6 2.6 4.4-5.2"
				fill="none"
				stroke="#53BDEB"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.8"
			/>
			<path
				d="M7.5 6.5l2.6 2.6 5.4-6.2"
				fill="none"
				stroke="#53BDEB"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.8"
			/>
		</svg>
	);
}

export function TypingIndicator({
	visible,
	progress,
	dotProgresses,
}: {
	visible: boolean;
	progress: number;
	dotProgresses: [number, number, number];
}) {
	const opacity = visible ? progress : 0;
	const translateY = 12 * (1 - progress);

	return (
		<div
			style={{
				alignSelf: 'flex-start',
				backgroundColor: AI_BUBBLE,
				borderRadius: 22,
				borderTopLeftRadius: 8,
				boxShadow:
					'0 1px 0 rgba(17, 27, 33, 0.08), 0 3px 8px rgba(17, 27, 33, 0.08)',
				display: 'flex',
				gap: 8,
				opacity,
				padding: '18px 20px',
				transform: `translateY(${translateY}px)`,
			}}
		>
			{[0, 1, 2].map((index) => {
				const dotProgress = dotProgresses[index];
				const dotOpacity = visible ? 0.35 + dotProgress * 0.65 : 0.35;
				const dotScale = visible ? 0.82 + dotProgress * 0.26 : 0.82;

				return (
					<div
						key={index}
						style={{
							backgroundColor: '#8696A0',
							borderRadius: 999,
							height: 10,
							opacity: dotOpacity,
							transform: `scale(${dotScale})`,
							width: 10,
						}}
					/>
				);
			})}
		</div>
	);
}

function MessageBubble({
	message,
	visible,
	progress,
	timestampProgress,
	align,
	backgroundColor,
	cornerAccent,
	showReadReceipts = false,
}: MessageBubbleProps) {
	const opacity = visible ? progress : 0;
	const translateY = 42 * (1 - progress);

	return (
		<div
			style={{
				alignSelf: align === 'right' ? 'flex-end' : 'flex-start',
				display: 'flex',
				justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
				opacity,
				transform: `translateY(${translateY}px)`,
				width: '100%',
			}}
		>
			<div
				style={{
					backgroundColor,
					borderRadius: 18,
					borderTopLeftRadius: cornerAccent === 'left' ? 6 : 18,
					borderTopRightRadius: cornerAccent === 'right' ? 6 : 18,
					boxShadow:
						'0 1px 0 rgba(17, 27, 33, 0.10), 0 4px 10px rgba(17, 27, 33, 0.09)',
					color: TEXT_PRIMARY,
					display: 'flex',
					flexDirection: 'column',
					gap: 10,
					maxWidth: '86%',
					minWidth: 170,
					padding: '14px 16px 10px',
				}}
			>
				<div
					style={{
						fontSize: 22,
						fontWeight: 450,
						lineHeight: 1.34,
						whiteSpace: 'pre-wrap',
					}}
				>
					{message.text}
				</div>
				<div
					style={{
						alignItems: 'center',
						display: 'flex',
						gap: 4,
						justifyContent: 'flex-end',
					}}
				>
					<div
						style={{
							color: TEXT_SECONDARY,
							fontSize: 14,
							letterSpacing: 0,
							opacity: timestampProgress,
						}}
					>
						{getTimestamp(message)}
					</div>
					{showReadReceipts ? <ReadReceipt /> : null}
				</div>
			</div>
		</div>
	);
}

export function UserMessage({
	message,
	visible,
	progress,
	timestampProgress,
}: {
	message: ConversationMessage;
	visible: boolean;
	progress: number;
	timestampProgress: number;
}) {
	return (
		<MessageBubble
			align="right"
			backgroundColor={USER_BUBBLE}
			cornerAccent="right"
			message={message}
			progress={progress}
			showReadReceipts
			timestampProgress={timestampProgress}
			visible={visible}
		/>
	);
}

export function AIMessage({
	message,
	visible,
	progress,
	timestampProgress,
}: {
	message: ConversationMessage;
	visible: boolean;
	progress: number;
	timestampProgress: number;
}) {
	return (
		<MessageBubble
			align="left"
			backgroundColor={AI_BUBBLE}
			cornerAccent="left"
			message={message}
			progress={progress}
			timestampProgress={timestampProgress}
			visible={visible}
		/>
	);
}

export function WhatsAppUI({
	state,
	content,
}: WhatsAppUIProps) {
	const userMessage = content.messages.find((message) => message.type === 'user');
	const aiMessage = content.messages.find((message) => message.type === 'ai');
	const shouldShowUserMessage = Boolean(userMessage && state.showMessage);
	const shouldShowTyping = state.isTyping;
	const shouldShowAiMessage = Boolean(aiMessage && state.showResponse);

	return (
		<div
			style={{
				backgroundColor: '#FFFFFF',
				display: 'grid',
				flex: 1,
				gridTemplateRows: '128px minmax(0, 1fr)',
				height: '100%',
				minHeight: 0,
				width: '100%',
			}}
		>
			<div
				style={{
					backgroundColor: HEADER_COLOR,
					color: '#FFFFFF',
					display: 'flex',
					gap: 14,
					alignItems: 'flex-end',
					minHeight: 0,
					padding: '62px 20px 16px',
					position: 'sticky',
					top: 0,
					zIndex: 2,
				}}
			>
				<div
					style={{
						alignItems: 'center',
						background:
							'linear-gradient(180deg, #7B61FF 0%, #6D28D9 100%)',
						borderRadius: 999,
						display: 'flex',
						fontSize: 16,
						fontWeight: 700,
						height: 52,
						justifyContent: 'center',
						letterSpacing: 0,
						width: 52,
						overflow: 'hidden',
					}}
				>
					<Img
						src={staticFile('assets/business_avatar_icon.png')}
						style={{ height: '100%', objectFit: 'cover', width: '100%' }}
					/>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
					<div
						style={{
							fontSize: 24,
							fontWeight: 700,
							letterSpacing: 0,
						}}
					>
						{content.businessName}
					</div>
					<div
						style={{
							fontSize: 16,
							fontWeight: 500,
							opacity: 0.92,
						}}
					>
						{content.statusLabel}
					</div>
				</div>
			</div>

			<div
				style={{
					backgroundColor: PHONE_BACKGROUND,
					display: 'block',
					height: '100%',
					minHeight: 0,
					padding: '22px 18px 124px',
					position: 'relative',
					overflow: 'hidden',
				}}
			>
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundImage: WALLPAPER,
						backgroundPosition: 'center',
						opacity: 0.2,
						pointerEvents: 'none',
					}}
				/>
				{state.isThinking ? (
					<div
						style={{
							alignItems: 'center',
							backgroundColor: 'rgba(7, 94, 84, 0.9)',
							border: '1px solid rgba(255, 255, 255, 0.32)',
							borderRadius: 999,
							boxShadow: '0 14px 36px rgba(7, 94, 84, 0.28)',
							color: '#FFFFFF',
							display: 'flex',
							fontFamily: 'monospace',
							fontSize: 13,
							fontWeight: 800,
							gap: 10,
							left: 22,
							letterSpacing: 0,
							opacity: state.thinkingPulseProgress,
							padding: '10px 14px',
							position: 'absolute',
							textTransform: 'uppercase',
							top: 20,
							transform: `translateY(${12 * (1 - state.thinkingPulseProgress)}px)`,
							zIndex: 2,
						}}
					>
						<span
							style={{
								backgroundColor: '#25D366',
								borderRadius: 999,
								boxShadow: '0 0 18px rgba(37, 211, 102, 0.8)',
								height: 9,
								width: 9,
							}}
						/>
						checking stock...
					</div>
				) : null}
				<div
					style={{
						bottom: 124,
						display: 'flex',
						flexDirection: 'column',
						gap: 14,
						left: 18,
						position: 'absolute',
						right: 18,
					}}
				>
					{userMessage && shouldShowUserMessage ? (
						<UserMessage
							message={userMessage}
							progress={state.userMessageProgress}
							timestampProgress={state.userTimestampProgress}
							visible={state.showMessage}
						/>
					) : null}
					{shouldShowTyping ? (
						<TypingIndicator
							dotProgresses={state.typingDotProgresses}
							progress={state.typingProgress}
							visible={state.isTyping}
						/>
					) : null}
					{aiMessage && shouldShowAiMessage ? (
						<AIMessage
							message={aiMessage}
							progress={state.aiMessageProgress}
							timestampProgress={state.aiTimestampProgress}
							visible={state.showResponse}
						/>
					) : null}
				</div>

				<div
					style={{
						alignItems: 'center',
						backgroundColor: PHONE_BACKGROUND,
						bottom: 0,
						display: 'flex',
						gap: 12,
						left: 0,
						minHeight: 96,
						padding: '14px 16px 16px',
						position: 'absolute',
						right: 0,
						zIndex: 2,
					}}
				>
					<div
						style={{
							alignItems: 'center',
							backgroundColor: '#FFFFFF',
							borderRadius: 999,
							display: 'flex',
							flex: 1,
							gap: 12,
							padding: '15px 16px',
						}}
					>
						<EmojiIcon />
						<div
							style={{
								color: '#8696A0',
								flex: 1,
								fontSize: 20,
								fontWeight: 400,
							}}
						>
							{content.inputPlaceholder}
						</div>
						<AttachmentIcon />
						<CameraIcon />
					</div>
					<div
						style={{
							alignItems: 'center',
							backgroundColor: '#25D366',
							borderRadius: 999,
							display: 'flex',
							height: 58,
							justifyContent: 'center',
							width: 58,
						}}
					>
						<svg
							aria-hidden
							viewBox="0 0 24 24"
							style={{ height: 24, width: 24 }}
						>
							<path
								d="M12 15.5a3.2 3.2 0 003.2-3.2V7.7A3.2 3.2 0 0012 4.5a3.2 3.2 0 00-3.2 3.2v4.6a3.2 3.2 0 003.2 3.2zm5-3.5a5 5 0 01-10 0M12 17v3m-3 0h6"
								fill="none"
								stroke="#FFFFFF"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
							/>
						</svg>
					</div>
				</div>
			</div>
		</div>
	);
}
