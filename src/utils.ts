export const log = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(...args);
  }
};
export const warn = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(...args);
  }
};

export const logError = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error(...args);
  }
};
