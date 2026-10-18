import dotenv from 'dotenv';
import app from './app.js';
import { startCallbackWorker } from '../services/callbackWorker.js';
import { createLogger } from '../utils/logger.js';

dotenv.config();

const log = createLogger({ service: 'api' });

const port = process.env.PORT || 3000;
if (process.env.CALLBACK_WORKER !== '0') {
  startCallbackWorker({ intervalMs: 3000 });
}
app.listen(port, () => {
  log.info({ port }, 'API listening');
});
