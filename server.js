// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const contactRoutes = require('./routes/contacts');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use('/api/contacts', contactRoutes);

const TwilioNumbers = process.env.TWILIO_NUMBERS.split(',');
const BernardsonNumbers = process.env.TWILIO_NUMBERS.split(',').slice(3, 5);
const BDHNumbers = process.env.TWILIO_NUMBERS.split(',').slice(0, 3);;
app.get('/getHistory', async (req, res) => {
  const number = req.query.number;
  const secret = process.env.MY_SECRET;

  if (!number) {
    return res.status(400).json({ success: false, error: 'Numéro requis' });
  }

  try {
    const response = await fetch(`https://historyappservice-7315.twil.io/getHistory?number=${encodeURIComponent(number)}&secret=${encodeURIComponent(secret)}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/sendSms', async (req, res) => {
  const { to, message, from } = req.body;
  const secret = process.env.MY_SECRET;

  if (!to || !message || !from) {
    return res.status(400).json({ success: false, error: 'Paramètres "to", "from" et "message" requis' });
  }

  try {
    const response = await fetch('https://messagingappservice-6767.twil.io/sendSms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message, from, secret })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/getContacts', async (req, res) => {
  const secret = process.env.MY_SECRET;
  const number = req.query.number;

  if (!number) {
    return res.status(400).json({ success: false, error: 'Numéro requis' });
  }
  try {
    const url = `https://recentcontacts-1749.twil.io/getRecentsContacts?number=${encodeURIComponent(number)}&secret=${encodeURIComponent(secret)}`;

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ success: false, error: `Erreur de la fonction Twilio : ${text}` });
    }

    const data = await response.json();

    res.status(200).json(data);
  } catch (err) {
    console.error('Erreur dans /getRecentsContacts backend :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/makeCall', async (req, res) => {
  const { to, from } = req.body;
  const secret = process.env.MY_SECRET;

  if (!to || !from) {
    return res.status(400).json({ success: false, error: 'Paramètres "to" et "from" requis' });
  }

  try {
    const response = await fetch('https://callappservice-3872.twil.io/makeCall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, from, secret })
    });

    const data = await response.json().catch(() => null);
    if (!data) {
      return res.status(502).json({ success: false, error: 'Réponse invalide du serveur Twilio' });
    }

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/hangupCall', async (req, res) => {
  const { sid } = req.body;
  const secret = process.env.MY_SECRET;

  if (!sid) {
    return res.status(400).json({ success: false, error: 'CallSid requis' });
  }

  try {
    const response = await fetch('https://hangup-call-7130.twil.io/hangupCall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid: sid, secret })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/getTwilioNumbers', (req, res) => {
  res.json({ success: true, numbers: TwilioNumbers });
});
app.get('/getBernardsonNumbers', (req, res) => {
  res.json({ success: true, numbers: BernardsonNumbers });
});

app.get('/getBdhNumbers', (req, res) => {
  res.json({ success: true, numbers: BDHNumbers });
});


app.post('/makeCallThru', async (req, res) => {
  const { to, from } = req.body;
  const secret = process.env.MY_SECRET;

  if (!to || !from) {
    return res.status(400).json({ success: false, error: 'Paramètres "to" et "from" requis' });
  }

  try {
    const response = await fetch('https://call-thru-function-8055.twil.io/call-thru', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, from, secret })
    });

    const data = await response.json().catch(() => null);
    if (!data) {
      return res.status(502).json({ success: false, error: 'Réponse invalide du serveur Twilio' });
    }

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const db = require('./db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT
    )
  `);
});

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
