const isDev = import.meta.env.DEV;

export const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};

export const warn = (...args: any[]) => {
  if (isDev) console.warn(...args);
};

export const error = (...args: any[]) => {
  if (isDev) console.error(...args);
};
