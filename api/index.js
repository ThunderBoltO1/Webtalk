const express = require('express');
const bodyParser = require('body-parser');
const Pusher = require('pusher');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const pusher = new Pusher({
  appId: 'YOUR_PUSHER_APP_ID',
  key: 'YOUR_PUSHER_KEY',
  secret: 'YOUR_PUSHER_SECRET',
  cluster: 'YOUR_PUSHER_CLUSTER',
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
