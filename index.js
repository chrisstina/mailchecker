const assert = require('assert');
const EventEmitter = require('events').EventEmitter;

const logger = require('./service/logger')('MAIL'),
    Mailbox = require('./service/mailbox');

// trust all certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const mailChecker = new EventEmitter;

/**
 * Проверяет почтовый ящик. Генерирует событие data на получение новых писем
 * @param {{user: string, password: string, host: string, port: number, tls: boolean}} mailboxConfig
 * @param {Config} appConfig
 */
const checkMailbox = function (mailboxConfig, appConfig) {

    assert(mailboxConfig.user !== undefined, 'Missing mailbox user');
    assert(mailboxConfig.password, 'Missing mailbox password');
    assert(mailboxConfig.host, 'Missing mailbox host');
    assert(mailboxConfig.port, 'Missing mailbox port');

    logger.info('Подключаемся к ' + mailboxConfig.user);
    const mailbox = new Mailbox(mailboxConfig, appConfig);
    mailbox.listNewMessages()
        .then(mailbox.parseNewMessages) // результат парсинга - массив готовых для работы объект сообщения
        .then(newMessages => {
            if (newMessages.length > 0) {
                mailChecker.emit('data', newMessages);
            }
        })
        .catch(e => {
            logger.error(`Failed to check ${mailboxConfig.user}: ${e.stack}`);
            mailChecker.emit('error', e);
        });
};

/**
 * Запускает процесс проверки и обработки настроенных почтовых ящиков с определенной периодичностью
 *
 * @param {{user: string, password: string, host: string, port: number, tls: boolean}[]} mailboxes
 * @param {{checkPeriod: number, messageChunkSize: number, storage: {}} options
 */
mailChecker.start = (mailboxes, options = {}) => {
    const config = require('./service/config')(options);

    try {
        logger.verbose('Mail client has been started...');
        mailboxes.map((mailbox, idx) => {
            setTimeout(
                () => {
                    setInterval(() => {
                        checkMailbox(mailbox, config)
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