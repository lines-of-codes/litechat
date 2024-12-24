# litechat

A chat app designed to be lightweight, fast, and secure.

Though, this might not be as secure as something like [Signal](https://signal.org/).

## Security

litechat makes use of the Web Crypto API and has the following process.

When creating an account: generate a Ed25519 key pair and store the private key locally, 
and public key on the server.

When starting a conversation:

1. The conversation starter generates a random AES-GCM key, and encrypt it with the recipient's public key.
2. The recipient decrypts the new symmetric key with their private key, and cache the key locally.
3. All chat messages will then be encrypted with the symmetric key.

The symmetric key can be rotated when requested, but older chat messages will also be lost.

## Dependencies

- PocketBase: A lightweight database software

## DevDependencies

- vite: bundling
- typescript: the typescript compiler
