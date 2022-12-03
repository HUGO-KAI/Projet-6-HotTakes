const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

// Créer le schema de l'idenfiant utilisateur
const userSchema = mongoose.Schema({
  email: {type: String , required:true , unique: true},
  password: {type: String, required:true} 
});

//Garantir une adresse mail n'utilise qu'une seule fois pour l'inscription
userSchema.plugin(uniqueValidator);

module.exports = mongoose.model('User', userSchema);