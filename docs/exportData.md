# Export data feature

> [!NOTE]
> As of writing, the feature is missing the ability to export all attachments.

The feature fetches data from `/api/litechat/users/export/{userId}` and process
the server response.

Due to how litechat works, the data sent from the server is purely the encrypted
messages and attachments. meaning, the client is responsible for decrypting all
messages, so this feature is intense on both the client and the server, especially
when you have a lot of data.

The following export formats are available:

-   JSON
-   Markdown
-   Plain Text (Log File)

## JSON

The most verbose and versatile format.

Options available:

-   Included data
-   Encryption key format (JWK/Base64)
-   Simplify
-   Decrypt

The JSON format is the following:

```json
{
	"options": {
		"simplified": true,
		"decrypt": true
	},
	"undecryptableChat": ["chat name (chat id)"],
	"messages": [
		{
			"attachments": ["link_to_attachment.ext.aes"],
			"created": "2025-02-04 10:34:31.164Z",
			"updated": "2025-02-04 10:34:31.164Z",
			"chat": "yuh",
			"sender": "username (user id)",
			"content": ""
		}
	],
	"chats": [
		{
			"id": "chat id",
			"created": "2024-12-29 05:59:54.989Z",
			"updated": "2024-12-29 05:59:54.989Z",
			"name": "",
			"photo": "",
			"theme": "",
			"members": ["username (userid)"]
		}
	],
	"encryptionKeys": {
		"chat_0ouc663a8akede0": "jwk data"
	},
	"relatedPeople": [
		{
			"avatar": "link_to_avatar.png",
			"id": "user id",
			"name": "username",
			"created": "2024-12-21 12:58:56.919Z",
			"updated": "2024-12-29 07:28:35.572Z"
		}
	]
}
```

What the simplify option does:

-   In the chat property in the messages array, The value is the chat name instead of the chat id.
-   Convert file names to actual links

If the decrypt option is disabled, The `content` field will be a Base64 representation of the encrypted data, and the `iv` field needed for decryption of both the message (in the content field) and the attchments will be provided alongside the `content` field in a string format with the content of the string as JSON.

The content of the IV field may look like the following:

```json
{
	"message": [12, 34, 56, 78, 90, 100, 110, 120, 130, 140, 150, 160],
	"attachment.ext.aes": [
		170, 180, 190, 200, 210, 220, 230, 240, 250, 0, 10, 20
	]
}
```

(but is a string, not stored as a JSON object)

The `undecryptableChat` array contains the chat will have
its content missing from the export because the chat's
secret key is not available at the time of export.

When picking the encryption key format, If JWK is chosen,
All the keys are included within the JSON file (as seen
above), But if the format PEM is chosen, all keys are
converted into Base64 and is included in its own `.pem`
file. Choosing the PEM format option will also make the
output be a `.zip` file containing all the `.pem` files
alongside the data instead of just one `.json` file.

When the PEM format is picked, The chat encryption keys (AES secret keys) is exported as the raw format and encoded into Base64, and the PEM label is "SECRET KEY". The encryption keys of related people is exported as the "SubjectPublicKeyInfo" (SPKI) format then encoded into Base64, and the PEM label is "PUBLIC KEY". The private key is exported as the "PKCS#8" format then encoded into Base64, and the PEM label is "PRIVATE KEY".

```
-----START SECRET/PUBLIC/PRIVATE KEY-----
base64 data
-----END SECRET/PUBLIC/PRIVATE KEY-----
```

## Markdown

Options available:

-   Included data
-   Encryption key format (JWK/Base64)
-   Simplify

The Markdown format is the following:

```
# litechat Data Export 2025-02-07T15:06:38.539Z

## Chat List

- username (user id)

## Related People

- **Avatar:** link_to_picture.png
- **ID:** user id
- **Name:** username
- **Created:** 2024-12-21 12\:58\:56.919Z
- **Updated:** 2024-12-29 07\:28\:35.572Z

## Encryption Keys

### privateKey/user_abcdefghij/chat_abcdefghij

\`\`\`
a codeblock containing private/public/secret key in JWK or PEM format.
\`\`\`

## chat name (chat id)

**username (user id)** (sent on 2025-02-04 09\:57\:13.686Z):
message
```

(Any sections not selected in the "Included data" option will be omitted.)

## Plain Text

The plain text is the simplest format with no configuration options available.

Only contains information about messages.

The plain text format is the following:

```
litechat Data Export 2025-02-07T14:44:24.198Z
[chat] chat name (chat id)

username (user id) (sent on 2025-02-04 09:57:13.686Z):
Attachments: attachment_url.ext.aes
message
```
