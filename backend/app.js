const express = require('express');
const userRoutes = require('./routes/user');
const sauceRoutes = require('./routes/sauce');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet')
const mongodbSanitize = require('mongodb-sanitize');
require('dotenv').config();

const app = express();

app.use(express.json()); 
app.use(mongodbSanitize());
app.use(helmet());

//Connecter à la base de donnée mmongodb
const mongoString = process.env.DATABASE_URL;
mongoose.connect(mongoString,
  { useNewUrlParser: true,
    useUnifiedTopology: true })
  .then(() => console.log('Connexion à MongoDB réussie !'))
  .catch(() => console.log('Connexion à MongoDB échouée !'));

//Ajouter header aux toutes reponses afin que tous les utilisateurs peuvent accèder à l'API avec des méthodes pré-définies
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');    
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content, Accept, Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    next();
  });

//attribuer des middlewares aux différentes routes
app.use('/api/sauces', sauceRoutes);
app.use('/api/auth', userRoutes);  
app.use('/images', express.static(path.join(__dirname, 'images')));

module.exports = app;

