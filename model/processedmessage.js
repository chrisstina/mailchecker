const logger = require('./../service/logger')('MODEL');

let self;

/**
 * @param {Config.storage} storageConfig
 * @constructor
 */
const ProcessedMessage = function (storageConfig) {
    self = this;
    /**
     * @type {Knex.QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]> | Knex<any, unknown[]>}
     */
    this.storage = require('knex')(storageConfig.db);
    this.tableName = storageConfig.tableName;
};

ProcessedMessage.prototype.migrate = async function () {
    knex.schema.hasTable(config.storage.tableName).then(function(exists) {
        if (!exists) {
            return knex.schema.createTable('config.storage.tableName', function(t) {
                t.increments('id').primary();
                t.string('first_name', 100);
                t.string('last_name', 100);
                t.text('bio');
            });
        }
    });
};

/**
 * Выбирает все существующие записи из списка полученных сообщений
 *
 * @param {string[]} messageIds
 * @param {string} mailbox
 * @return {*|string|QueryBuilder<TRecord extends {}, TResult>}
 */
ProcessedMessage.prototype.listAll = async function (messageIds, mailbox) {
    return await this.storage.select('message_id').from(this.tableName)
        .where('mailbox', mailbox)
        .whereIn('message_id', messageIds);
};

/**
 * Добавляет сообщение в список обработанных в БД.
 * @param {string} messageId
 * @param {string} mailbox
 * @return {Promise<T>}
 */
ProcessedMessage.prototype.add = async function(messageId, mailbox) {
    try {
        await this.storage(this.tableName).insert([{'message_id': messageId, 'mailbox': mailbox, 'date': new Date()}]);
        logger.verbose(`Message has been saved #${messageId}/${mailbox} as read`);
    } catch (e) {
        logger.error(`Failed to save the message #${messageId}/${mailbox} as read: ${e.stack}`);
    }
};

module.exports = function (storage) {
    return new ProcessedMessage(storage);
};