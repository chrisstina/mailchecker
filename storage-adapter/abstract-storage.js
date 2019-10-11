class AbstractStorage {
    constructor() {}
    async increment(key) {}
    async getByKey(key) {}
    async set(key, data) {}
    async delete(key) {}
    async getByKeyMatch(keyMask) {}
}

module.exports = AbstractStorage;