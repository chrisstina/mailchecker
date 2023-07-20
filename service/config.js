const assert = require("assert");

const STORAGE_KNEX = "knex";
const ALLOWED_STORAGE_TYPES = [STORAGE_KNEX];

/**
 * @param options
 */
module.exports = function Config(options) {
  /* OPTIONS CHECK */
  assert(
    options.checkPeriod !== undefined && options.checkPeriod > 0,
    "Не задан период проверки почтовых ящиков",
  );
  assert(
    options.messageChunkSize !== undefined && options.messageChunkSize > 0,
    "Не задано количество одновременно обрабатываемых сообщений",
  );
  assert(
    options.storage !== undefined &&
      ALLOWED_STORAGE_TYPES.indexOf(options.storage.type) !== -1,
    "Не задан тип хранилища",
  );

  if (options.storage.type === STORAGE_KNEX) {
    assert(
      options.storage.db !== undefined,
      "Не заданы параметры подключения knex",
    );
    assert(options.storage.db.client, "Не указан тип БД");
    assert(
      options.storage.db.connection.database &&
        options.storage.db.connection.user &&
        options.storage.db.connection.password,
      "Не указано подключение БД (логин, пароль)",
    );
  }

  this.checkPeriod = options.checkPeriod;
  this.messageChunkSize = options.messageChunkSize;
  this.storage = {};
  this.storage.type = options.storage.type;
  this.storage.tableName = options.storage.tableName || "processedmessage";
  this.storage.db = options.storage.db;

  if (options.storage === STORAGE_KNEX) {
    this.storage.db.pool.min = options.storage.db.pool.min || 1;
    this.storage.db.pool.max = options.storage.db.pool.min || 2;
    this.storage.db.debug = options.storage.db.debug || true;
  }
  //
  // this.getStorageModule = function () {
  //     if (this.storage.type === STORAGE_KNEX) {
  //         return require('../storage-adapter/knex-storage');
  //     } else if (this.storage.type === STORAGE_JSON_DB) {
  //         return require('../storage-adapter/json-db-storage');
  //     }
  // }
};
