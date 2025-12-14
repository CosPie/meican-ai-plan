import { NodeSSH } from 'node-ssh';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

// Load root .env.local
dotenv.config({ path: '.env.local' });

const ssh = new NodeSSH();

const config = {
  host: process.env.DEPLOY_HOST,
  username: process.env.DEPLOY_USER,
  password: process.env.DEPLOY_PASSWORD,
  port: parseInt(process.env.DEPLOY_PORT || '22'),
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.join(__dirname, 'backend');
const localDistPath = path.join(backendDir, 'dist');
const localEnvPath = path.join(backendDir, '.env.local');
const localPackageJson = path.join(backendDir, 'package.json');

const remoteRoot = '/root/Code/meican-ai-plan';
const remoteBackend = `${remoteRoot}/backend`;
const remoteDistPath = `${remoteBackend}/dist`;
const remoteEnvPath = `${remoteBackend}/.env.local`;
const remotePackageJson = `${remoteBackend}/package.json`;

async function deploy() {
  try {
    // 1. Local Build
    console.log('Building backend locally...');
    // Ensure dependencies are installed and build is run
    await execAsync('npm install && npm run build', { cwd: backendDir });
    console.log('Local build successful.');

    // 2. Connect SSH
    console.log(`Connecting to ${config.host}...`);
    await ssh.connect(config);
    console.log('Connected!');

    // 3. Upload Files
    console.log('Uploading files...');
    
    // Ensure remote directory exists
    await ssh.execCommand(`mkdir -p ${remoteBackend}`);

    // Upload dist directory
    console.log(`Uploading ${localDistPath} to ${remoteDistPath}...`);
    await ssh.putDirectory(localDistPath, remoteDistPath, {
      recursive: true,
      concurrency: 10,
    });

    // Upload package.json
    console.log(`Uploading ${localPackageJson} to ${remotePackageJson}...`);
    await ssh.putFile(localPackageJson, remotePackageJson);

    // Upload .env.local
    console.log(`Uploading ${localEnvPath} to ${remoteEnvPath}...`);
    await ssh.putFile(localEnvPath, remoteEnvPath);
    
    console.log('Upload complete.');

    // 4. Remote Install & Restart
    console.log('Installing dependencies and restarting backend...');
    
    // Note: nvm use 16 might need sourcing nvm first. 
    const nvmSource = 'source ~/.nvm/nvm.sh || source ~/.bashrc || source ~/.profile || true';
    
    const remoteCommands = [
      `${nvmSource}`,
      `nvm use 16`,
      `cd ${remoteBackend}`,
      `npm install --production`, // Only install runtime dependencies
      `npm install -g pm2`,
      `pm2 restart meican-backend || pm2 start dist/index.js --name meican-backend`
    ].join(' && ');

    const resultRemote = await ssh.execCommand(remoteCommands);
    console.log('STDOUT:', resultRemote.stdout);
    console.log('STDERR:', resultRemote.stderr);

    console.log('Backend deployment successful!');
  } catch (err) {
    console.error('Deployment failed:', err);
  } finally {
    ssh.dispose();
  }
}

deploy();
