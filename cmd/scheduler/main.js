import { getDBConnectionString } from '../../pkg/common/common.js';
import { createServer } from '../../pkg/scheduler/scheduler.js';

const schedulerPort = process.env.SCHEDULER_PORT || ':8081';

async function main() {
  try {
    const dbConnectionString = getDBConnectionString();
    const schedulerServer = createServer(schedulerPort, dbConnectionString);
    await schedulerServer.start();
  } catch (error) {
    console.error('Error while starting server:', error);
    process.exit(1);
  }
}

main();
