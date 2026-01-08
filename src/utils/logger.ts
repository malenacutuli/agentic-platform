import pino from "pino";

const logLevel = process.env.LOG_LEVEL || "info";
const logFormat = process.env.LOG_FORMAT || "pretty";

const transport =
  logFormat === "json"
    ? undefined
    : pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      });

export const logger = pino(
  {
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport
);

export default logger;
