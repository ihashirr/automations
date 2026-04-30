import type { SceneComponentProps } from '../core/registry';
import { IncomingRealityScene } from '../modules/flow/CustomerFlowScene';

export function Scene2({ sceneId }: SceneComponentProps) {
	return <IncomingRealityScene sceneId={sceneId} />;
}
