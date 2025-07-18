const express = require('express');
const bodyParser = require('body-parser');
const Pusher = require('pusher');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

// Endpoint for the client to trigger events
app.post('/api/pusher/trigger', (req, res) => {
  const { channel, event, data } = req.body;
  pusher.trigger(channel, event, data);
  res.status(200).send('Event triggered');
});

// Serve the main app for any other GET request
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'index.html'));
});

module.exports = app;
