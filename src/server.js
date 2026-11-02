const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;

if (!process.env.NOTES_API_TOKEN) {
  console.warn('NOTES_API_TOKEN is not set, so write requests use the token "dev-token".');
}

createApp().listen(port, () => {
  console.log(`notes-api listening on http://localhost:${port}`);
});
