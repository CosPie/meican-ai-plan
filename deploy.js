import SftpClient from 'ssh2-sftp-client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const config = {
  host: process.env.DEPLOY_HOST,
  username: process.env.DEPLOY_USER,
  password: process.env.DEPLOY_PASSWORD,
  port: parseInt(process.env.DEPLOY_PORT),
  remotePath: process.env.DEPLOY_PATH,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localPath = path.join(__dirname, 'dist');

const client = new SftpClient();

async function deploy() {
  try {
    console.log(`Connecting to ${config.host}...`);
    await client.connect(config);
    console.log('Connected!');

    console.log(`Uploading files from ${localPath} to ${config.remotePath}...`);
    
    // Ensure remote directory exists
    const exists = await client.exists(config.remotePath);
    if (!exists) {
        console.log(`Remote path ${config.remotePath} does not exist, creating...`);
        await client.mkdir(config.remotePath, true);
    }

    // Upload directory
    await client.uploadDir(localPath, config.remotePath);

    console.log('Deployment successful!');
  } catch (err) {
    console.error('Deployment failed:', err.message);
  } finally {
    client.end();
  }
}

deploy();
