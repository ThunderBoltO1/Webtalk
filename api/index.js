const express = require('express');
const bodyParser = require('body-parser');
const Pusher = require('pusher');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const pusher = new Pusher({
  appId: "2024275",
  key: "37361f4cd7d0f575faac",
  secret: "453020ddb6516ad38f7e",
  cluster: "ap1",
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
