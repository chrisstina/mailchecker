const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;

const AbstractStorage = require('./abstract-storage');

const DBNAME = "data/mailchecker";
const TABLENAME = "/processedMessages";

class BasicNodeStorage extends AbstractStorage {

    constructor(db) {
        super();
        this.db = new JsonDB(new Config(DBNAME, true, false, '/'));
    }

    /**
     * @param key
     * @return {Promise<*>}
     */
    async getByKey(key) {
        return this.db.getData(generateKey(key));
    }

    /**
     *
     * @param key
     * @param data
     * @return {Promise<void>}
     */
    async set(key, data) {
        this.db.push(generateKey(key), data);
    }
}

function generateKey(key) {
    return `${TABLENAME}/${key}`;
}

module.exports = {
    /**
     * @todo вынести выше в фабрику
     * @return {BasicNodeStorage}
     */
    getStorage: function () {
        return new BasicNodeStorage();
    }
};