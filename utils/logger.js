import fs from 'fs';
import path from 'path';
import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE || path.resolve(process.cwd(), 'logs', 'app.log');

function ensureDir(filePath) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  } catch (_) {}
}

const stdoutLogger = pino({ level });
let fileLogger = null;
if (logFile) {
  ensureDir(logFile);
  fileLogger = pino({ level }, pino.destination({ dest: logFile, sync: false }));
}

export function createLogger(bindings = {}) {
  function emit(levelName, msg, obj) {
    const data = { ...bindings, ...(obj || {}) };
    stdoutLogger[levelName](data, msg);
    if (fileLogger) fileLogger[levelName](data, msg);
  }
  return {
    child(extra) {
      return createLogger({ ...bindings, ...(extra || {}) });
    },
    info: (obj, msg) => emit('info', msg || '', obj),
    warn: (obj, msg) => emit('warn', msg || '', obj),
    error: (obj, msg) => emit('error', msg || '', obj),
    debug: (obj, msg) => emit('debug', msg || '', obj),
  };
}
