#mailchecker

> Event-based POP3 mail client with message parser and local storage

`mailchecker` connects to a mailbox, fetches new messages, 
parses a chunk of messages and fires an event when new message is found.
The module checks mailboxes once in an indicated period of time.

- The module adapts [POP3 client](https://github.com/lianxh/node-pop3) to work with mailboxes.
- Processed message ids are stored in an embedded [JSON database](https://github.com/Belphemur/node-json-db) so emails don't get parsed twice.
- Message parsing is done by the [Nodemailer mailparser](https://nodemailer.com/extras/mailparser/) module. 

## Usage

In order to start receiving messages from a mailbox you need to call the `start` method of the `mailchecker` module
along with the mailbox credentials.


Each mailbox you pass will get checked with an indicated frequency, default is `10000ms`. 
The number of new messages returned in each iteration is limited to 5 by default.

### Events

The module emits two events: `data` and `error`. 
The `data` event is fired each time a new message is successfully parsed. 
The event returns a collection of new messages, parsed and ready for use.

### Message object

Mails get parsed with the [mailparser](https://nodemailer.com/extras/mailparser/) module.
Parsed message object has the following properties

- headers – a Map object with lowercase header keys
- subject is the subject line (also available from the header mail.headers.get(‘subject’))
- from is an address object for the From: header
- to is an address object for the To: header
- cc is an address object for the Cc: header
- bcc is an address object for the Bcc: header (usually not present)
- date is a Date object for the Date: header
- messageId is the Message-ID value string
- inReplyTo is the In-Reply-To value string
- reply-to is an address object for the Cc: header
- references is an array of referenced Message-ID values
- html is the HTML body of the message. If the message included embedded images as cid: urls then these are all replaced with base64 formatted data: URIs
- text is the plaintext body of the message
- textAsHtml is the plaintext body of the message formatted as HTML
- attachments is an array of attachments.

### Options

#### Mailboxes

The `start` method accepts an array of objects containing mailbox credentials.

```json
{
    "user": "yyy@yyy.yy",
    "password": "yyyyy",
    "host": "mail.xxxx.yy",
    "port": 110,
    "tls": true
}
```

#### Frequency of checking email

You may pass the frequency of checking mailbox in `ms` in the `checkPeriod` parameter.


#### Config

TBA

## Basic usage

```
const mailchecker = require('./');
mailchecker.start([
        {
            user: 'yyy@yyy.yy',
            password: 'yyyyy',
            host: 'mail.xxxx.yy',
            port: 110,
            tls: true,
        }],
    {checkPeriod: 5000});
    
    
    mailchecker.on('data', (data) => {
        // process an array of messages
    });
```
