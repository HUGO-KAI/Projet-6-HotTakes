var passwordValidator = require('password-validator');

var passwordSchema = new passwordValidator();

passwordSchema
.is().min(8)                                    // Minimum length 8
.is().max(30)                                   // Maximum length 30
.has().uppercase()                              // Must have uppercase letters
.has().lowercase()                              // Must have lowercase letters
.has().digits(2)                                // Must have two numbers
.has().not().spaces()                           // Should not have spaces
.is().not().oneOf(['Passw0rd', 'Password123']); // Blacklist these values


//Valider le password
module.exports = (req,res,next) => {
    if (passwordSchema.validate(req.body.password)){
        next();
    }else {
        const err = passwordSchema.validate(req.body.password, { details: true });
        res
        .status(400)
        .json(err)
    }
};