import { getDBConnectionString } from '../../pkg/common/common.js';
import { createServer } from '../../pkg/coordinator/coordinator.js';

const coordinatorPort = process.env.COORDINATOR_PORT || ':8080';

async function main() {
  try {
    const dbConnectionString = getDBConnectionString();
    const coordinator = createServer(coordinatorPort, dbConnectionString);
    await coordinator.start();
  } catch (error) {
    console.error('Error while starting coordinator:', error);
    process.exit(1);
  }
}

main();
