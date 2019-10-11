const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, label } = format;

module.exports = function (tag) {
    return createLogger({
        format: combine(
            timestamp(),
            colorize(),
            label({label: tag}),
            printf(info => `${info.timestamp} ${info.label} ${info.level}: ${info.message}`)
        ),
        transports: [new transports.Console({level: 'verbose'})]
    });
}