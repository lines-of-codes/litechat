# About the Keystore

This document explains the technical details and what the Keystore feature does behind the scenes.

To summarize the process of exporting and importing the keys:

Encrypt -> Create -> Fetch -> Decrypt -> Delete.

## Exporting

Source: [exportPrivateKey.lazy.ts](https://github.com/lines-of-codes/litechat/blob/main/src/views/exportPrivateKey.lazy.ts)

### Encrypt

1. Search for all keys cached locally, and filter out any keys that might be unused (such as keys from deleted chats)
2. Ask the user for key protection password, if the user didn't enter anything, generate a 6 character alphanumeric password.
3. Import the password as a PBKDF2 key, then derive the key into an AES-GCM key.
4. Store the salt of the PBKDF2 key as JSON data on the database.
5. Use the AES-GCM key to encrypt the data of the keys to be uploaded.
c
### Create

Upload the keys to the `keystore` collection on the PocketBase database server.

# Importing

Source: [importPrivateKey.lazy.ts](https://github.com/lines-of-codes/litechat/blob/main/src/views/importPrivateKey.lazy.ts)

## Fetch

Fetch all the keys stored on the keystore.

## Decrypt

Decrypt and imports all the keys that was fetched.

1. Ask the user for the password of the keystore.
2. Import the password as a PBKDF2 key, then derive the key into an AES-GCM key with the same salt used in the encryption process.
3. Use the AES-GCM key to decrypt all fetched keys.
4. Import all the decrypted keys into the localStorage.

## Delete

Delete all keys stored on the keystore that is marked as one-time.

Currently, all keys uploaded to the keystore is all marked as one-time use.
