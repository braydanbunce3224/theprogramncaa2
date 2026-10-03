// GoDaddy Node.js Hosting starts this file with `npm start`.
// The Nitro build writes `.output/server/index.mjs`, which listens itself.
// HOST must be 0.0.0.0 or the platform cannot reach the process.
const port = process.env.PORT || "3000";
process.env.PORT = String(port);
process.env.HOST = process.env.HOST || "0.0.0.0";
process.env.NITRO_HOST = process.env.NITRO_HOST || process.env.HOST;

await import("./.output/server/index.mjs");
