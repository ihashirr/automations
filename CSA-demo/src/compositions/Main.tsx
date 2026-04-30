import { Sequence } from 'remotion';
import { scenes } from '../core/registry';

export function Main() {
	let cursor = 0;
	const sequences = scenes.map((scene) => {
		const Comp = scene.component;
		const from = cursor;
		cursor += scene.duration;

		return (
			<Sequence
				key={scene.id}
				from={from}
				durationInFrames={scene.duration}
			>
				<Comp sceneId={scene.id} />
			</Sequence>
		);
	});

	return <>{sequences}</>;
}
