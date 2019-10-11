const logger = require('./../service/logger')('MODEL');

let self;

/**
 * @todo переделать на репозиторий, или как-то еще по-умному
 * @constructor
 */
const ProcessedMessage = function () {
    self = this;
    this.storage = require('./../storage-adapter/basic-node-storage').getStorage();
};

ProcessedMessage.prototype.findAll = async function (messageIds, mailbox) {
   throw Error('Not implemented');
};

/**
 * Выбирает все существующие записи из списка полученных сообщений
 * @param messageId
 * @param mailbox
 * @return {Promise<*>}
 */
ProcessedMessage.prototype.findOne = async function (messageId, mailbox) {
    try {
        return await self.storage.getByKey(getProcessedMessageKey(messageId, mailbox));
    } catch (e) {
        logger.error(e.toString());
        return null;
    }
};

/**
 * Добавляет сообщение в список обработанных в БД.
 * @param messageId
 * @param mailbox
 * @returns {Promise<void>}
 */
ProcessedMessage.prototype.add = async function(messageId, mailbox) {
    await self.storage.set(getProcessedMessageKey(messageId, mailbox), messageId);
    logger.verbose('Сохранили сообщение #' + messageId + '/' + mailbox + ' в обработанных');
};

function getProcessedMessageKey(messageId, mailbox) {
    return `${mailbox}-${messageId}`;
}

module.exports = new ProcessedMessage();