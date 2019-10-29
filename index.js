const EventEmitter = require('events').EventEmitter;

const logger = require('./service/logger')('MAIL'),
    Mailbox = require('./service/mailbox'),
    migrate = require('./service/migration');

// trust all certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const mailChecker = new EventEmitter;

/**
 * Проверяет почтовый ящик. Генерирует событие data на получение новых писем
 * @param {Mailbox} mailbox
 */
const checkMailbox = function (mailbox) {

    mailbox.listNewMessages()
        .then(mailbox.parseNewMessages) // результат парсинга - массив готовых для работы объект сообщения
        .then(newMessages => {
            if (newMessages.length > 0) {
                mailChecker.emit('data', newMessages);
            }
        })
        .catch(e => {
            logger.error(`Failed to check: ${e.stack}`);
            mailChecker.emit('error', e);
        });
};

/**
 * Запускает процесс проверки и обработки настроенных почтовых ящиков с определенной периодичностью
 *
 * @param {{user: string, password: string, host: string, port: number, tls: boolean}[]} mailboxes
 * @param {{checkPeriod: number, messageChunkSize: number, storage: {}} options
 */
mailChecker.start = async (mailboxes, options = {}) => {
    const config = require('./service/config')(options);

    try {
        await migrate(config); // run migration is table does not exist

        logger.verbose('Mail client has been started...');

        mailboxes.map((mailboxConfig, idx) => {
            const mailbox = new Mailbox(mailboxConfig, config);
            logger.info(`Connected to ${mailboxConfig.user}`);
            setTimeout(
                () => {
                    setInterval(() => {
                        checkMailbox(mailbox)
                    }, config.checkPeriod);
                },
                idx * (config.checkPeriod / 2)
            );
        });
    } catch (e) {
        logger.error('Could not start mail client: ' + e.stack);
        mailChecker.emit('error', e);
    }
};

module.exports = mailChecker;