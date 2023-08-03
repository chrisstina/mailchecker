const assert = require("assert");
const Pop3Command = require("node-pop3");
const { simpleParser } = require("mailparser");
const ProcessedMessageModel = require("./../model/processedmessage");
const logger = require("./../service/logger")("MAILBOX");

/**
 *
 * @param {{user: string, password: string, host: string, port: number, tls: boolean}}  mailboxConfig
 * @param {Config} appConfig
 * @constructor
 */
function Mailbox(mailboxConfig, appConfig) {
  assert(mailboxConfig.user !== undefined, "Missing mailbox user");
  assert(mailboxConfig.password, "Missing mailbox password");
  assert(mailboxConfig.host, "Missing mailbox host");
  assert(mailboxConfig.port, "Missing mailbox port");

  function createPOP3Command() {
    return new Pop3Command({
      host: mailboxConfig.host,
      port: mailboxConfig.port,
      user: mailboxConfig.user,
      password: mailboxConfig.password,
      debug: true,
    });
  }

  function createProcessedMessageModel() {
    return new ProcessedMessageModel(appConfig.storage);
  }

  const processedMessageModel = createProcessedMessageModel();
  const pop3 = createPOP3Command();

  /**
   * Из всего списка сообщений в ящике возвращает те, которые не были обработаны
   * @param {[]} allReceivedMessages - все сообщения ящика
   * @param {string} mailbox
   * @return {Promise<{retrieveID: string, uniqueID: string}[]>}
   */
  const filterNew = async function (allReceivedMessages, mailbox) {
    const popIdx = 1; // индекс поля в UIDL, которое будем использовать для сравнения
    const messageIds = allReceivedMessages.map((id) => {
      return id[popIdx];
    });

    try {
      // @todo - не выбирать все существующие, а искать каждое сообщение в processed
      const savedMessages = await processedMessageModel.listByMessageIds(
        mailbox,
        messageIds,
      );
      const processedIds = savedMessages.map((row) => row["message_id"]);

      return allReceivedMessages
        .filter((listItem) => processedIds.indexOf(listItem[popIdx]) === -1)
        .map((newListItem) => {
          return { retrieveID: newListItem[0], uniqueID: newListItem[popIdx] };
        });
    } catch (e) {
      logger.error(`Failed to filter out new messages: ${e.stack}`);
      return [];
    }
  };

  /**
   * Берет письмо из ящика и возвращает в нужном формате.
   * Добавляет письмо в список обработанных
   * @param retrieveMsgId
   * @param uniqueMsgId
   * @return {Promise<{headers:[],body:string}>}
   */
  const fetchAndParseMessage = async function (retrieveMsgId, uniqueMsgId) {
    const rawMessage = await fetchMessage(retrieveMsgId);
    logger.verbose(
      `Parsing message ${retrieveMsgId} ${uniqueMsgId} of ${mailboxConfig.user}`,
    );
    const parsedMessage = await simpleParser(rawMessage);
    await processedMessageModel.add(uniqueMsgId, mailboxConfig.user);
    logger.verbose(
      `The message ${retrieveMsgId} ${uniqueMsgId} of ${mailboxConfig.user} has been parsed`,
    );
    return parsedMessage;
  };

  /**
   * Цепочка промисов, получаем RAW сообщение
   *
   * @param messageId
   * @returns {Promise<*>}
   */
  const fetchMessage = function (messageId) {
    logger.verbose(
      `Fetching message ${messageId} of ${mailboxConfig.user} via POP3`,
    );
    return pop3
      .RETR(messageId)
      .then((stream) => {
        return stream;
      })
      .catch((e) => {
        logger.error(`Could not fetch a message via POP3: ${e.stack}`);
      });
  };

  this.closeMailbox = function () {
    logger.info(`Closing ${mailboxConfig.user}`);
    return pop3
      .QUIT()
      .then((quitInfo) => logger.info("QUIT result: " + quitInfo));
  };

  /**
   * Получает список сообщений из ящика, которые еще не были обработаны
   * @return {Promise<*>}
   */
  this.listNewMessages = function () {
    logger.info(`Connecting to ${mailboxConfig.user}`);
    return pop3
      .UIDL()
      .then((list) => filterNew(list, mailboxConfig.user))
      .catch((e) => {
        logger.error(`Failed to list messages via POP3: ${e.stack}`);
      });
  };

  /**
   * По списку id новых сообщений в ящике парсит сообщения и
   * возвращает список распарсенных объектов почтовых сообщений
   *
   * @param {{retrieveID: string, uniqueID: string}[]} messageIds - массив новых сообщений
   * @return {Promise<{headers: [], body: string}[]>}
   */
  this.parseNewMessages = function (messageIds) {
    if (!messageIds) {
      logger.warn("No messages to parse");
      return Promise.resolve([]);
    }
    // Не обрабатываем сразу все, а кусочками. Следующая партия будет обработана при следующей итерации.
    let chunkOfMessageIds = messageIds.slice(0, appConfig.messageChunkSize);
    // парсим новые письма параллельно
    return Promise.all(
      chunkOfMessageIds.map((mid) =>
        fetchAndParseMessage(mid.retrieveID, mid.uniqueID),
      ),
    ).catch((e) => logger.error(`Failed to parse messages: ${e.stack}`));
  };

  /**
   * Помечает сообщения в ящике как непрочитанные
   * @param dateStart
   * @param dateEnd
   * @return {Promise<void>}
   */
  this.unprocessMessages = async function (dateStart, dateEnd) {
    const messagesUnprocessed = await processedMessageModel.listByDateRange(
      mailboxConfig.user,
      dateStart,
      dateEnd,
    );
    await processedMessageModel.deleteByDateRange(
      mailboxConfig.user,
      dateStart,
      dateEnd,
    );
    return messagesUnprocessed.length;
  };
}

module.exports = Mailbox;
