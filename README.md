# YouTube Watch Party

This application requires a YouTube Data API key to enable video search functionality. 

Please follow these steps to get your key:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Enable the "YouTube Data API v3" for your project.
4. Create credentials for your project and get an API key.
5. Replace `'YOUR_API_KEY_HERE'` in `script.js` with your actual API key.

This application also uses Pusher for real-time features. You will need to create a free account at [Pusher.com](https://pusher.com/) and get your credentials.

1. Create a new "Channels" app on your Pusher dashboard.
2. In `api/index.js`, replace `YOUR_PUSHER_APP_ID`, `YOUR_PUSHER_KEY`, `YOUR_PUSHER_SECRET`, and `YOUR_PUSHER_CLUSTER` with your actual Pusher credentials.
3. In `script.js`, replace `YOUR_PUSHER_KEY` and `YOUR_PUSHER_CLUSTER` with your client-side credentials.
