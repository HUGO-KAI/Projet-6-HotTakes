const express = require('express');
const router = express.Router();
const passwordValidator = require ('../middleware/password');
const emailValidator = require ('../middleware/email')
const userCtrl = require('../controllers/user');
const limiter = require('../middleware/rateLimit');


//Définir les routes des requêtes concernant les utilisateurs
router.post('/signup', limiter,emailValidator, passwordValidator, userCtrl.signup);
router.post('/login',limiter, userCtrl.login);

module.exports = router;