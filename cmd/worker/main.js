import { createServer } from '../../pkg/worker/worker.js';

const serverPort = process.env.WORKER_PORT || '';
const coordinatorPort = process.env.COORDINATOR || 'coordinator:8080';

async function main() {
  try {
    const worker = createServer(serverPort, coordinatorPort);
    await worker.start();
  } catch (error) {
    console.error('Error while starting worker:', error);
    process.exit(1);
  }
}

main();
