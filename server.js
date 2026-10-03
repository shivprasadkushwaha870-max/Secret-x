const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Provide Firebase configuration dynamically
app.get('/api/config.js', (req, res) => {
  res.type('application/javascript');
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyCX9myU2sx-LCyGAUsKuVEOJJXo7jhurdg',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'secret-x-c3045.firebaseapp.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'secret-x-c3045',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'secret-x-c3045.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '116252360970',
    appId: process.env.FIREBASE_APP_ID || '1:116252360970:web:98622eb77bf5646c89baf3'
  };
  res.send(`window.FIREBASE_CONFIG = ${JSON.stringify(config)};`);
});

// Serve static directory
app.use(express.static(path.join(__dirname, '.')));

// Fallback for subroutes (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Secret-x server listening on http://${HOST}:${PORT}`);
});
