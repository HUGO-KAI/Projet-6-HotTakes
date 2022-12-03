var passwordValidator = require('password-validator');

// Creation du schéma
var passwordSchema = new passwordValidator();

// Add properties to it

passwordSchema
.is().min(8)                                    // Minimum length 8
.is().max(30)                                  // Maximum length 100
.has().uppercase()                              // Must have uppercase letters
.has().lowercase()                              // Must have lowercase letters
.has().not().spaces()                           // Should not have spaces
.is().not().oneOf(['Passw0rd', 'Password123']); // Blacklist these values

//Valider le password
module.exports = (req,res,next) => {
    if (passwordSchema.validate(req.body.password)){
        next();
    }else {
        const err = passwordSchema.validate(req.body.password, { details: true });
        res
        .status(422)
        .json(err)
    }
};