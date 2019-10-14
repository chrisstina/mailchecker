const simpleParser = require('mailparser').simpleParser,
    Pop3Command = require('node-pop3');

const appConfig = require('./../config/app');
const processedMessage = require('./../model/processedmessage');
const logger = require('./../service/logger')('MAILBOX');

/**
 *
 * @param config
 * @constructor
 */
function Mailbox(config) {
    const getPOP3Command = function () {
        return new Pop3Command({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            debug: true
        });
    };

    /**
     * Цепочка промисов, получаем RAW сообщение
     *
     * @param messageId
     * @returns {Promise<*>}
     */
    const fetchMessage = function (messageId) {

        const pop3 = getPOP3Command();

        return pop3.RETR(messageId)
            .then(stream => {
                pop3.QUIT();
                return stream;
            })
            .catch(err => {
                logger.error(err);
                return pop3.QUIT();
            });
    };

    /**
     * Из всего списка сообщений в ящике возвращает те, которые не были обработаны
     *
     * @param allReceivedMessages - все сообщения ящика
     * @param mailbox
     * @return {Promise<{retrieveID: string, uniqueID: string}[]>}
     */
    const filterNew = async function (allReceivedMessages, mailbox) {
        const popIdx = 1; // индекс поля в UIDL, которое будем использовать для сравнения

        return Promise.all(allReceivedMessages.map(id => processedMessage.findOne(id[popIdx], mailbox)))
            .then(rows => {
                let processedIds = rows
                    .filter(row => row !== undefined && row !== null);

                return allReceivedMessages
                    .filter(listItem => processedIds.indexOf(listItem[popIdx]) === -1)
                    .map(newListItem => {
                        return {retrieveID: newListItem[0], uniqueID: newListItem[popIdx]}
                    });
            })
            .catch((err) => {
                logger.error(err);
                return [];
            });
    };

    /**
     * Получает список сообщений из ящика, которые еще не были обработаны
     * @return {Promise<*>}
     */
    this.listNewMessages = function () {
        const pop3 = getPOP3Command();
        return pop3.UIDL()
            .then(list => {
                pop3.QUIT();
                return list;
            })
            .then(list => filterNew(list, config.user))
            .catch((err) => {
                pop3.command('QUIT');
                logger.error(err);
            });
    };

    /**
     * По списку id новых сообщений в ящике парсит сообщения и
     * возвращает список распарсенных объектов почтовых сообщений
     *
     * @param {{retrieveID: string, uniqueID: string}[]} messageIds - массив новых сообщений
     * @return {Promise<*>}
     */
    this.parseNewMessages = function (messageIds) {
        // Не обрабатываем сразу все, а кусочками. Следующая партия будет обработана при следующей итерации.
        let chunkOfMessages = messageIds.slice(0, appConfig.messageChunkSize);
        // парсим новые письма параллельно
        return Promise.all(chunkOfMessages.map(mid => parseMessage(mid.retrieveID, mid.uniqueID)))
            .catch(err => logger.error(err));
    };

    /**
     * Берет письмо из ящика и возвращает в нужном формате.
     * Добавляет письмо в список обработанных
     * @param retrieveMsgId
     * @param uniqueMsgId
     * @return {Promise<*>}
     */
    const parseMessage = async function (retrieveMsgId, uniqueMsgId) {
        logger.verbose(`Обрабатываем сообщение ${retrieveMsgId} ${uniqueMsgId} ящика ${config.user}`);

        const rawMessage = await fetchMessage(retrieveMsgId);
        const parsedMessage = await simpleParser(rawMessage);
        await processedMessage.add(uniqueMsgId, config.user);
        logger.verbose(`Cообщение ${retrieveMsgId} ${uniqueMsgId} ящика ${config.user} прочитано`);
        return parsedMessage;
    }
}

module.exports = Mailbox;