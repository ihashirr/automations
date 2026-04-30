import { Composition } from 'remotion';
import { Main } from './compositions/Main';
import { totalDurationInFrames } from './core/registry';
import './index.css';

export function RemotionRoot() {
	return (
		<Composition
			id="Main"
			component={Main}
			durationInFrames={totalDurationInFrames}
			fps={60}
			width={1080}
			height={1920}
		/>
	);
}
