import type { SceneComponentProps } from '../core/registry';
import { ChatWorldScene } from '../modules/flow/CustomerFlowScene';

export function Scene3({ sceneId }: SceneComponentProps) {
	return <ChatWorldScene sceneId={sceneId} />;
}
