import type { SceneComponentProps } from '../core/registry';
import { ProblemPunchScene } from '../modules/flow/CustomerFlowScene';

export function Scene1({ sceneId }: SceneComponentProps) {
	return <ProblemPunchScene sceneId={sceneId} />;
}
