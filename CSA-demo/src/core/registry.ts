import type { ComponentType } from 'react';
import { Scene1 } from '../scenes/Scene1';
import { Scene2 } from '../scenes/Scene2';
import { Scene3 } from '../scenes/Scene3';
import { timeline, type SceneName } from './timeline';

export type SceneComponentProps = {
	sceneId: SceneName;
};

export type SceneDefinition = {
	id: SceneName;
	component: ComponentType<SceneComponentProps>;
	duration: number;
};

export const scenes: SceneDefinition[] = [
	{
		id: 'scene1',
		component: Scene1,
		duration: timeline.scene1.end - timeline.scene1.start,
	},
	{
		id: 'scene2',
		component: Scene2,
		duration: timeline.scene2.end - timeline.scene2.start,
	},
	{
		id: 'scene3',
		component: Scene3,
		duration: timeline.scene3.end - timeline.scene3.start,
	},
];

export const totalDurationInFrames = scenes.reduce(
		(total, scene) => total + scene.duration,
		0,
);
