// server.js
// Node 18+ (fetch disponible), Express API pour Twilio + SQLite

// ----------------------------
// Imports & setup de base
// ----------------------------
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Twilio (token voix)
const { twiml: { VoiceResponse } } = require('twilio');
const { jwt: { AccessToken } } = require('twilio');
const VoiceGrant = AccessToken.VoiceGrant;

// DB locale (SQLite) : suppose un fichier ./db.js déjà présent
const db = require('./db');

// ----------------------------
// Constantes & ENV
// ----------------------------
const app = express();
const PORT = Number(process.env.PORT || 4000);

// Variables Twilio (token voix)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID || '';
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET || '';
const TWILIO_APP_SID = process.env.TWILIO_APP_SID || '';

// Sécrets applicatifs
const API_KEY = process.env.API_KEY || '';      // pour middleware d’auth simple
const MY_SECRET = process.env.MY_SECRET || '';  // partagé avec vos Twilio Functions

// Listes de numéros (séparées par des virgules dans .env)
const TWILIO_NUMBERS = (process.env.TWILIO_NUMBERS || '').split(',').map(s => s.trim()).filter(Boolean);
const BERNARDSON_NUMBERS = (process.env.BERNARDSON_NUMBERS || '').split(',').map(s => s.trim()).filter(Boolean);
const BDH_NUMBERS = (process.env.BDH_NUMBERS || '').split(',').map(s => s.trim()).filter(Boolean);

// URLs Twilio Functions (gardez-les en ENV si vous préférez)
const URL_HISTORY   = process.env.URL_HISTORY   || 'https://historyapiservice-7315.twil.io/getHistory';
const URL_SEND_SMS  = process.env.URL_SEND_SMS  || 'https://messagingappservice-6767.twil.io/sendSms';
const URL_RECENTS   = process.env.URL_RECENTS   || 'https://recentcontacts-1749.twil.io/getRecentsContacts';
const URL_HANGUP    = process.env.URL_HANGUP    || 'https://hangup-call-7138.twil.io/hangupCall';
const URL_CALL_THRU = process.env.URL_CALL_THRU || 'https://call-thru-function-8055.twil.io/call-thru';

// ----------------------------
// Middlewares globaux
// ----------------------------

// Fait confiance au reverse proxy (Nginx) pour req.secure / X-Forwarded-Proto
app.set('trust proxy', 1);

// (Optionnel mais recommandé) Redirection HTTP -> HTTPS côté app
// Nginx fait déjà --redirect, mais ceci couvre les cas intermédiaires.
app.use((req, res, next) => {
  if (!req.secure) {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// Sécurité de base
app.use(helmet({
  // Ajustez si vous servez du front sur le même domaine et avez besoin d'inline/eval
  contentSecurityPolicy: false
}));

// CORS strict sur vos domaines
app.use(cors({
  origin: ['https://bcall.dev', 'https://www.bcall.dev'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));

// Parse JSON & x-www-form-urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------------------
// Auth API Key (facile à retirer)
// ----------------------------
app.use('/api/', (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!API_KEY || key === API_KEY) return next();
  return res.status(403).json({ success: false, error: 'Unauthorized access' });
});

// ----------------------------
// Token Voix Twilio
// ----------------------------
app.get('/generate-token', (req, res) => {
  try {
    // Identité côté client – à remplacer selon votre logique
    const identity = 'user-call-frontend-123';

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY_SID,
      TWILIO_API_KEY_SECRET,
      { ttl: 3600 } // 1h
    );

    token.identity = identity;

    const grant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_APP_SID,
      incomingAllow: true
    });

    token.addGrant(grant);

    return res.json({ success: true, token: token.toJwt(), identity });
  } catch (err) {
    console.error('Error in /generate-token', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------
// Proxy Twilio Functions
// ----------------------------

// Historique d’appels/messages pour un numéro donné
app.get('/getHistory', async (req, res) => {
  const number = (req.query.number || '').trim();
  const twilioNumber = (req.query.twilioNumber || '').trim();
  const secret = MY_SECRET;

  if (!number)        return res.status(400).json({ success: false, error: 'Number required' });
  if (!twilioNumber)  return res.status(400).json({ success: false, error: 'Twilio Number required' });

  try {
    const url = `${URL_HISTORY}?number=${encodeURIComponent(number)}&twilioNumber=${encodeURIComponent(twilioNumber)}&secret=${encodeURIComponent(secret)}`;
    const response = await fetch(url);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Error in /getHistory', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Envoi d’un SMS via Twilio Function
app.post('/sendSms', async (req, res) => {
  const { to, message, from } = req.body;
  const secret = MY_SECRET;

  if (!to || !message || !from) {
    return res.status(400).json({ success: false, error: '"to", "from" and "message" parameters required' });
  }

  try {
    const response = await fetch(URL_SEND_SMS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message, from, secret })
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Error in /sendSms', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Derniers contacts
app.get('/getContacts', async (req, res) => {
  const number = (req.query.number || '').trim();
  if (!number) return res.status(400).json({ success: false, error: 'Number required' });

  try {
    const url = `${URL_RECENTS}?number=${encodeURIComponent(number)}&secret=${encodeURIComponent(MY_SECRET)}`;
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ success: false, error: `Twilio Function Error : ${text}` });
    }
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error('Error in /getContacts', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Raccrocher un appel (via Function)
app.post('/hangupCall', async (req, res) => {
  const { sid } = req.body;
  if (!sid) return res.status(400).json({ success: false, error: 'CallSid required' });

  try {
    const response = await fetch(URL_HANGUP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid: sid, secret: MY_SECRET })
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Error in /hangupCall', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Exposer vos listes de numéros (si utile au front)
app.get('/getTwilioNumbers',  (_, res) => res.json({ success: true, numbers: TWILIO_NUMBERS }));
app.get('/getBernardsonNumbers', (_, res) => res.json({ success: true, numbers: BERNARDSON_NUMBERS }));
app.get('/getBdhNumbers',       (_, res) => res.json({ success: true, numbers: BDH_NUMBERS }));

// Call-thru (num perso)
app.post('/makeCallThru', async (req, res) => {
  const { to, from, personalNumber } = req.body;
  if (!to || !from || !personalNumber) {
    return res.status(400).json({ success: false, error: '"to", "from" and "personalNumber" parameters required' });
  }

  try {
    // Cette Function attend un form-urlencoded
    const params = new URLSearchParams();
    params.append('to', to);
    params.append('from', from);
    params.append('personalNumber', personalNumber);
    params.append('secret', MY_SECRET);

    const response = await fetch(URL_CALL_THRU, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const text = await response.text();
    // La Function peut renvoyer du JSON ou du texte
    try {
      const maybeJson = JSON.parse(text);
      return res.status(response.status).json(maybeJson);
    } catch {
      return res.status(response.status).send(text);
    }
  } catch (err) {
    console.error('Error in /makeCallThru', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------
// Routage divers
// ----------------------------

// Santé / monitoring
app.get('/healthz', (_, res) => res.json({ ok: true }));

// 404 JSON propre
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Gestion d’erreurs Express
// (gardez en dernier)
app.use((err, req, res, next) => {
  console.error('Unhandled app error:', err);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// Pièges globaux – éviter un crash du process
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// ----------------------------
// Démarrage + init DB
// ----------------------------
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT
    )
  `);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log('✅ Server started on http://localhost:%s', PORT);
  console.log('Connecté à la base de données SQLite.');
});

