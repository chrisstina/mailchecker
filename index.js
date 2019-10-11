const assert = require('assert');
const EventEmitter = require('events').EventEmitter;

const appConfig = require('./config/app'),
    logger = require('./service/logger')('MAIL'),
    Mailbox = require('./service/mailbox');

// trust all certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const mailChecker = new EventEmitter;

/**
 * Проверяет почтовый ящик. Генерирует событие data на получение новых писем
 * @param {{user: string, password: string, host: string, port: number, tls: boolean}} mailboxConfig
 */
const checkMailbox = function (mailboxConfig) {

    assert(mailboxConfig.user !== undefined, 'Missing mailbox user');
    assert(mailboxConfig.password, 'Missing mailbox password');
    assert(mailboxConfig.host, 'Missing mailbox host');
    assert(mailboxConfig.port, 'Missing mailbox port');

    logger.info('Подключаемся к ' + mailboxConfig.user);
    const mailbox = new Mailbox(mailboxConfig);
    mailbox.listNewMessages()
        .then(mailbox.parseNewMessages) // результат парсинга - массив готовых для работы объект сообщения
        .then(newMessages => mailChecker.emit('data', newMessages))
        .catch(err => {
            logger.error(err);
            mailChecker.emit('error', err);
        });
};

/**
 * Запускает процесс проверки и обработки настроенных почтовых ящиков с определенной периодичностью
 *
 * @param {{user: string, password: string, host: string, port: number, tls: boolean}[]} mailboxes
 * @param {{checkPeriod: number}} options
 */
mailChecker.start = (mailboxes, options) => {
    const checkPeriod = options.checkPeriod || appConfig.checkPeriod;
    try {
        logger.verbose('Начинаем проверять почту...');
        mailboxes.map((mailbox, idx) => {
            setTimeout(
                () => {
                    setInterval(() => {
                        checkMailbox(mailbox)
                    }, checkPeriod);
                },
                idx * (checkPeriod / 2)
            );
        });
    } catch (err) {
        logger.error('Не удалось запустить почтовый клиент, ошибка: ' + err);
        mailChecker.emit('error', err);
    }
};

module.exports = mailChecker;