# litechat

A chat app designed to be lightweight, fast, and secure.

This app is partially inspired by [Signal](https://signal.org/), a chat app focused on
privacy and security. But this might not be as secure as Signal.

However, you might see some similarity between Signal and litechat's terms of service.

_(litechat is not endorsed or affiliated by Signal!)_

> [!IMPORTANT]
> For users: litechat depends on some new & recent browser features.
> Please keep your browsers updated to make sure litechat will function
> properly and securely.

## Security

*You are free to perform security audits and report any vulnerabilities through GitHub or through Email.*

litechat makes use of the Web Crypto API and has the following process.

When creating an account: generate a RSA-OAEP key pair and store the private key locally,
and public key on the server.

When starting a conversation:

1. The conversation starter generates a random AES-GCM key, and encrypt it with the recipient's public key.
2. The recipient decrypts the new symmetric key with their private key, and cache the key locally.
3. All chat messages will then be encrypted with the symmetric key.

The symmetric key can be rotated when requested, but older chat messages will also be lost.

> [!NOTE]
> As of current and initial plans, Only message content and attachments will be encrypted.
> So your profile picture, display name, chat name, chat photo are not encrypted.

## Dependencies

-   [PocketBase](https://pocketbase.io/): A lightweight database software
-   [Mithril.js](https://mithril.js.org/): A lightweight JavaScript framework for Single Page Applications.
-   [DOMPurify](https://github.com/cure53/DOMPurify): Sanitize messages.
-   [Marked](https://github.com/markedjs/marked): A markdown parser and compiler.
-   [Bootstrap Icons](https://icons.getbootstrap.com/)

## DevDependencies

-   [vite](https://vite.dev/): bundling
-   [less](https://lesscss.org/): A language extension for CSS
-   [typescript](https://www.typescriptlang.org/): the typescript compiler

## Building & Hosting

After cloning the Git repository,
To build the project, you must have pnpm.
If you do not have pnpm, use corepack to install and enable it.

```
corepack install
corepack enable
```

Next, install the project's dependencies using `pnpm install`

> [!IMPORTANT]
> When building the application, make sure to create a `.env.local` file,
> and inside it add `VITE_PB_URL=http://127.0.0.1:8090` and replace the URL
> with wherever you're hosting your PocketBase.

Then, To start a development server, use `pnpm dev`
To build it, use the `pnpm build` command, and by default, the output should be in the `dist` folder.

**When hosting your own litechat instance, You must adapt litechat's Terms of Service appropriately.**

To host the application, You can seperately host the database and the frontend, or host both with the same tool.

To seperately host, just copy the contents of the `dist` folder to your desired web hosting software.
(Nginx, Apache HTTP server, lighttpd, etc.) and start PocketBase.

To host both the database and the frontend with the same tool, In the `pocketbase` folder,
Create a folder called `pb_public` and copy the contents of the `dist` folder into the new `pb_public` folder.

Please do note that the PocketBase binary provided within the `pocketbase` folder of this repository 
is for x64 Linux.

Finally, to start PocketBase, you could:

-   Start it locally by doing `./pocketbase serve`
-   Allow connections from anywhere by doing `./pocketbase serve --http 0.0.0.0:8090`, replace `8090` with your preferred port.
-   For deploying in production, please refer to [PocketBase's documentation](https://pocketbase.io/docs/going-to-production/)

## PocketBase Setup

After you've started PocketBase, please make sure to set it up properly.

On first start, it'll prompt you to create a new superuser account.
If you're running in a headless environment, you could create a superuser
account using `./pocketbase superuser create [email] [password]`

Next, open up your browser and open the PocketBase dashboard.
PocketBase should tell you where the dashboard is when running
the serve command.

```
❯ ./pocketbase serve
2024/12/28 18:43:57 Server started at http://127.0.0.1:8090
├─ REST API:  http://127.0.0.1:8090/api/
└─ Dashboard: http://127.0.0.1:8090/_/
```

Then, In the dashboard, open up the Setting menu, and "Import collections"
Pick the `pb_schema.json` file. (In the Git repo, should be located at `/pocketbase/pb_schema.json`)
and follow the on-screen prompt to import the collections.

> [!NOTE]
> Especially in development versions, The PocketBase database schema might change often.
> When updating your litechat instance, check if /pocketbase/pb_schema.json is changed.
> If it is changed, follow the above instruction again to import the collections.

PocketBase should be ready for use with litechat now.

It is recommended that you explore the PocketBase settings and set everything to match with your
environment and your needs and follow PocketBase's guide on
[going to production.](https://pocketbase.io/docs/going-to-production/)
