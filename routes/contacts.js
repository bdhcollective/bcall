const express = require('express');
const router = express.Router();
const db = require('../db');

// Ajouter un contact
router.post('/', (req, res) => {
  const { phone, name } = req.body;
  db.run('INSERT OR REPLACE INTO contacts (phone, name) VALUES (?, ?)', [phone, name], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, phone, name });
  });
});

// Obtenir tous les contacts
router.get('/', (req, res) => {
  db.all('SELECT * FROM contacts', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Obtenir un contact par numéro
router.get('/:phone', (req, res) => {
  const phone = req.params.phone;
  db.get('SELECT * FROM contacts WHERE phone = ?', [phone], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'Contact non trouvé' });
    }
  });
});

module.exports = router;
