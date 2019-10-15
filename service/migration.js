const logger = require('./logger')('MIGRATION');
module.exports = async function migrate(config) {
    const knex = require('knex')(config.storage.db);

    knex.schema.hasTable(config.storage.tableName).then(function (exists) {
        if ( ! exists) {
            return knex.schema.createTable(config.storage.tableName, table => {
                table.increments('id').primary();
                table.string('message_id').notNullable();
                table.string('mailbox').notNullable();
                table.dateTime('date').notNullable();
                table.index('message_id');
            }).then(res => logger.info(`A new table ${config.storage.tableName} has been created`));
        } else {
            logger.info(`Table ${config.storage.tableName} already exists`);
        }
    });
};