const assert = require('assert');

const STORAGE_KNEX = 'knex';
const STORAGE_JSON_DB = 'json-db';
const ALLOWED_STORAGE_TYPES = [STORAGE_KNEX, STORAGE_JSON_DB];

module.exports = function (options) {
    /**
     * @constructor
     */
    function Config(options) {

        /* OPTIONS CHECK */
        assert(options.checkPeriod !== undefined && options.checkPeriod > 0, 'Не задан период проверки почтовых ящиков');
        assert(options.messageChunkSize !== undefined && options.messageChunkSize > 0, 'Не задано количество одновременно обрабатываемых сообщений');
        assert(options.storage !== undefined && ALLOWED_STORAGE_TYPES.indexOf(options.storage.type) !== -1, 'Не задан тип хранилища');

        if (options.storage === STORAGE_KNEX) {
            assert(options.storage.db !== undefined, 'Не заданы параметры подключения knex')
        }

        this.checkPeriod = options.checkPeriod;
        this.messageChunkSize = options.messageChunkSize;
        this.storage = {};
        this.storage.type = options.storage.type;
        this.storage.db = options.storage.db;

        this.getStorageModule = function () {
            if (this.storage.type === STORAGE_KNEX) {
                return require('../storage-adapter/knex-storage');
            } else if (this.storage.type === STORAGE_JSON_DB) {
                return require('../storage-adapter/json-db-storage');
            }
        }
    }

    return new Config(options);
};