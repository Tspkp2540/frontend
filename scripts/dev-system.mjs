import { startStack } from './stack.mjs';
const stack = await startStack();
console.log(`Preview ready: ${stack.baseURL}`);
console.log('Temporary PostgreSQL with five rooms. Register an account in the UI. Stop this process to clean up.');
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { if (!stopping) { stopping = true; await stack.stop(); process.exit(); } });
