const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'out');

const env = process.env;
const entry = env.RENDER_ENTRY || 'src/index.ts';
const comp = env.RENDER_COMP || 'Main';
const framesDir = path.resolve(root, env.RENDER_FRAMES_DIR || 'out/frames-crisp');
const output = env.RENDER_OUT || 'out/main-rtx3050-crisp-master.mp4';
const fps = env.RENDER_FPS || '60';
const mode = env.RENDER_MODE || 'constqp';
const preset = env.RENDER_PRESET || 'p7';
const tune = env.RENDER_TUNE || 'hq';
const pixelFormat = env.RENDER_PIXEL_FORMAT || 'yuv420p';
const profile = env.RENDER_PROFILE || 'high';
const qp = env.RENDER_QP || '12';
const bitrate = env.RENDER_BITRATE || '40M';
const maxrate = env.RENDER_MAXRATE || '60M';
const bufsize = env.RENDER_BUFSIZE || '120M';

const run = (command, args) => {
	const executable = process.platform === 'win32' && command === 'npx'
		? 'npx.cmd'
		: command;
	const result = spawnSync(executable, args, {
		cwd: root,
		stdio: 'inherit',
	});

	if (result.status !== 0) {
		process.exit(result.status || 1);
	}
};

if (!framesDir.startsWith(outDir + path.sep)) {
	throw new Error(`Refusing to clean frames outside out/: ${framesDir}`);
}

fs.rmSync(framesDir, { force: true, recursive: true });

run('npx', [
	'remotion',
	'render',
	entry,
	comp,
	'--sequence',
	`--output=${path.relative(root, framesDir)}`,
	'--image-format=png',
	'--image-sequence-pattern=frame-[frame].[ext]',
	'--chrome-mode=chrome-for-testing',
	'--gl=angle',
]);

const encodeArgs = [
	'-y',
	'-framerate',
	fps,
	'-start_number',
	'0',
	'-i',
	path.join(path.relative(root, framesDir), 'frame-%04d.png'),
	'-c:v',
	'h264_nvenc',
	'-preset',
	preset,
	'-tune',
	tune,
];

if (mode === 'vbr') {
	encodeArgs.push(
		'-rc',
		'vbr',
		'-cq',
		env.RENDER_CQ || '16',
		'-b:v',
		bitrate,
		'-maxrate',
		maxrate,
		'-bufsize',
		bufsize,
	);
} else {
	encodeArgs.push('-rc', 'constqp', '-qp', qp);
}

encodeArgs.push(
	'-profile:v',
	profile,
	'-pix_fmt',
	pixelFormat,
	'-movflags',
	'+faststart',
	output,
);

run('ffmpeg', encodeArgs);
