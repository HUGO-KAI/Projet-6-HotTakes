const express = require('express');
const router = express.Router();

const userCtrl = require('../controllers/user');

//Définir les routes des requêtes concernant les utilisateurs
router.post('/signup', userCtrl.signup);
router.post('/login', userCtrl.login);

module.exports = router;