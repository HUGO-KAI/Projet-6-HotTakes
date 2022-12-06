const express = require('express');
const router = express.Router();
const passwordValidator = require ('../middleware/password');
const emailValidator = require ('../middleware/email')
const userCtrl = require('../controllers/user');

//Définir les routes des requêtes concernant les utilisateurs
router.post('/signup', emailValidator, passwordValidator, userCtrl.signup);
router.post('/login', userCtrl.login);

module.exports = router;