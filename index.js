const assert = require("assert");
const EventEmitter = require("events").EventEmitter;

const logger = require("./service/logger")("MAIL"),
  Mailbox = require("./service/mailbox"),
  migrate = require("./service/migration"),
  Config = require("./service/config");

// trust all certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const mailChecker = new EventEmitter();
/**
 * @type {Config|null}
 */
mailChecker.config = null;

/**
 * @param {{checkPeriod:number, messageChunkSize: number, storage:{}}} options
 */
mailChecker.setConfig = function (options) {
  this.config = new Config(options);
};

/**
 * Проверяет почтовый ящик. Генерирует событие data на получение новых писем
 * @param {Mailbox} mailbox
 */
const checkMailbox = function (mailbox) {
  mailbox
    .openMailbox()
    .then(mailbox.listNewMessages)
    .then(mailbox.parseNewMessages) // результат парсинга - массив готовых для работы объект сообщения
    .then((newMessages) => {
      if (newMessages.length > 0) {
        mailChecker.emit("data", newMessages);
      }
    })
    .catch((e) => {
      logger.error(`Failed to check: ${e.stack}`);
      mailChecker.emit("error", e);
    })
    .finally(mailbox.closeMailbox);
};

/**
 * Запускает процесс проверки и обработки настроенных почтовых ящиков с определенной периодичностью
 *
 * @param {{user: string, password: string, host: string, port: number, tls: boolean}[]} mailboxes
 */
mailChecker.start = async (mailboxes) => {
  assert(
    mailChecker.config,
    "Missing options, use setConfig() method to set mailchecker options",
  );

  try {
    await migrate(mailChecker.config); // run migration is table does not exist

    logger.verbose("Mail client has been started...");

    mailboxes.map((mailboxConfig, idx) => {
      const mailbox = new Mailbox(mailboxConfig, mailChecker.config);
      setTimeout(
        () => {
          setInterval(() => {
            checkMailbox(mailbox);
          }, mailChecker.config.checkPeriod);
        },
        idx * (mailChecker.config.checkPeriod / 2),
      );
    });
  } catch (e) {
    logger.error("Could not start mail client: " + e.stack);
    mailChecker.emit("error", e);
  }
};

/**
 * Убирает сообщения в указанном диапазоне дат из прочитанных. При следуюзем прогоне эти сообщения будут интерпретированы как новые.
 */
mailChecker.unprocess = async function (mailboxes, dateStart, dateEnd) {
  logger.info(`Unprocessing messages ${dateStart} - ${dateEnd}`);
  mailboxes.map(async (mailboxConfig) => {
    const mailbox = new Mailbox(mailboxConfig, mailChecker.config);
    try {
      const unprocessedCount = await mailbox.unprocessMessages(
        dateStart,
        dateEnd,
      );
      mailChecker.emit("unprocessed", unprocessedCount);
    } catch (e) {
      mailChecker.emit("error", e);
    }
  });
};

module.exports = mailChecker;
