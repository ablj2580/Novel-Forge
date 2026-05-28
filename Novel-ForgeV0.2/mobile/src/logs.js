/**
 * 日志桥接 — 与桌面端共享 LOGS_STORAGE_KEY,api.js 通过 setAddLog 调用
 */
import { LOGS_STORAGE_KEY } from '../../src/constants.js';

const loadLogs = () => {
  try {
    const stored = localStorage.getItem(LOGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

let logs = loadLogs();
let logFilter = '';

const saveLogs = () => {
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('save logs failed', e);
  }
};

export const addLog = (type, message, details = null) => {
  const log = {
    id: `${type}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    type,
    message,
    details
  };
  logs.unshift(log);
  if (logs.length > 100) logs = logs.slice(0, 100);
  saveLogs();
};

export const getLogs = () => {
  logs = loadLogs();
  return logs;
};

export const clearLogs = () => {
  logs = [];
  saveLogs();
};

export const getLogFilter = () => logFilter;
export const setLogFilter = (f) => { logFilter = f; };
