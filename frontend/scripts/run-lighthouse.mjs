import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });

const startPreview = () =>
  spawn(
    'npm',
    ['run', 'preview', '--', '--host', '0.0.0.0', '--port', '4173'],
    {
      cwd: projectRoot,
      stdio: 'inherit',
    },
  );

const runLighthouse = async () => {
  let previewProcess;
  try {
    await runCommand('npm', ['run', 'build'], { cwd: projectRoot });

    previewProcess = startPreview();
    await delay(5000);

    await runCommand('npx', [
      'lighthouse',
      'http://127.0.0.1:4173',
      '--quiet',
      '--chrome-flags="--headless --no-sandbox"',
      `--output-path=${join(projectRoot, 'lighthouse-report.html')}`,
      '--preset=desktop',
    ]);
  } finally {
    if (previewProcess) {
      previewProcess.kill('SIGINT');
    }
  }
};

runLighthouse().catch((error) => {
  console.error(error);
  process.exit(1);
});

