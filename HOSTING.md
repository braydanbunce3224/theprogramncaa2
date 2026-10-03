# Hosting Dribble on GoDaddy

The game runs as a Node.js server. Saves stay in the browser. Sign-in is off. Nothing in the game calls the Grok host at runtime.

GoDaddy builds this repo, then runs `npm start`. That starts `start.mjs`, which listens on `process.env.PORT` and `0.0.0.0`.

## Branch

Connect **feat/title-dribble-play**. `main` does not have this server.

## Release

1. Change the game in this repository.
2. Push to `feat/title-dribble-play`.
3. In GoDaddy, open the Node.js app and use **Update Preview**.
4. Open the preview URL. The address bar must stay on that preview host. Play a minute of the game, refresh the page, and refresh `/gym`.
5. Only after that preview works, publish to Live.

Do not turn on domain forwarding. Do not point the domain at a Grok URL.

## DNS, only after the preview works

1. Remove the forwarding rule on `playdribble.app`. Leave MX, TXT, and email records alone.
2. In the Node.js app, attach `playdribble.app` and `www.playdribble.app`.
3. Let GoDaddy write the routing records and the certificate.
4. Publish the verified preview to Live.
5. Open `https://playdribble.app` and `https://www.playdribble.app`. The address bar must stay on those names. It must not jump to a `grok.me` URL.
