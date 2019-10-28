const simpleParser = require('mailparser').simpleParser,
    Pop3Command = require('node-pop3');

const logger = require('./../service/logger')('MAILBOX');

/**
 *
 * @param mailboxConfig
 * @param {Config} appConfig
 * @constructor
 */
function Mailbox(mailboxConfig, appConfig) {

    const processedMessage = new require('./../model/processedmessage')(appConfig.storage);

    const getPOP3Command = function () {
        return new Pop3Command({
            host: mailboxConfig.host,
            port: mailboxConfig.port,
            user: mailboxConfig.user,
            password: mailboxConfig.password,
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
            .catch(e => {
                logger.error(`Could not fetch a message via POP3: ${e.stack}`);
                return pop3.QUIT();
            });
    };

    /**
     * Из всего списка сообщений в ящике возвращает те, которые не были обработаны
     * @param {[]} allReceivedMessages - все сообщения ящика
     * @param {string} mailbox
     * @return {Promise<{retrieveID: string, uniqueID: string}[]>}
     */
    const filterNew = async function (allReceivedMessages, mailbox) {
        const popIdx = 1; // индекс поля в UIDL, которое будем использовать для сравнения
        const messageIds = allReceivedMessages.map((id) => { return id[popIdx]; });

        try {
            const savedMessages = await processedMessage.listAll(messageIds, mailbox);
            const processedIds = savedMessages.map((row) => row['message_id']);

            return allReceivedMessages
                .filter(listItem => processedIds.indexOf(listItem[popIdx]) === -1)
                .map(newListItem => {
                    return {retrieveID: newListItem[0], uniqueID: newListItem[popIdx]};
                });
        } catch (e) {
            logger.error(`Failed to filter out new messages: ${e.stack}`);
            return [];
        }
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
            .then(list => filterNew(list, mailboxConfig.user))
            .catch((e) => {
                pop3.command('QUIT');
                logger.error(`Failed to list messages via POP3: ${e.stack}`);
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
            .catch(e => logger.error(`Failed to parse messages: ${e.stack}`));
    };

    /**
     * Берет письмо из ящика и возвращает в нужном формате.
     * Добавляет письмо в список обработанных
     * @param retrieveMsgId
     * @param uniqueMsgId
     * @return {Promise<*>}
     */
    const parseMessage = async function (retrieveMsgId, uniqueMsgId) {
        logger.verbose(`Parsing message ${retrieveMsgId} ${uniqueMsgId} of ${mailboxConfig.user}`);

        const rawMessage = await fetchMessage(retrieveMsgId);
        const parsedMessage = await simpleParser(rawMessage);
        await processedMessage.add(uniqueMsgId, mailboxConfig.user);
        logger.verbose(`The message ${retrieveMsgId} ${uniqueMsgId} of ${mailboxConfig.user} has been parsed`);
        return parsedMessage;
    }
}

module.exports = Mailbox;