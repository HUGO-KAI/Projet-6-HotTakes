const Sauce = require('../models/Sauce');
const fs = require('fs');
const { throwError } = require('rxjs');

//Créer une sauce à la demande de l'utilisateur et l'enregistrer dans la base de donnée
exports.createSauce = (req, res, next) => {
  const sauceObject = JSON.parse(req.body.sauce);
  delete sauceObject._id;
  delete sauceObject.userId;
  const sauce = new Sauce({
    ...sauceObject,
    userId: req.auth.userId,
    imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`,
    likes: 0,
    dislikes : 0,
    usersLiked : [],
    usersDisliked : []
  });
  sauce.save()
    .then(() => { res.status(201).json({message: 'Sauce enregistré !'})})
    .catch(error => { res.status(400).json( { error })})
};

//Chercher dans la base de donnée la sauce que l'utilisateur a selectionné pour afficher le détail et l'envoyer au front-end
exports.getOneSauce = (req, res, next) => {
  Sauce.findOne({
    _id: req.params.id
  }).then(
    (sauce) => {
      res.status(200).json(sauce);
    }
  ).catch(
    (error) => {
      res.status(404).json({
        error: error
      });
    }
  );
};

//Modifier une sauce dans la base de donnée suite à la demande de client
exports.modifySauce = (req, res, next) => {
  const sauceObject = req.file ? {
    ...JSON.parse(req.body.sauce),
    imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
  } : { ...req.body };
  delete sauceObject._userId;
  Sauce.findOne({_id: req.params.id})
    .then((sauce) => {
        if (sauce.userId != req.auth.userId) {
            res.status(403).json({ message : 'Unauthorized request'});
        } else {
          const filename = sauce.imageUrl.split('/images/')[1];
          if (req.file) {
            fs.unlink(`images/${filename}`, () => {
              Sauce.updateOne({ _id: req.params.id}, { ...sauceObject, _id: req.params.id})
                .then(() => res.status(200).json({message : 'Sauce modifié!'}))
                .catch(error => res.status(401).json({ error }));
          })}else {
            Sauce.updateOne({ _id: req.params.id}, { ...sauceObject, _id: req.params.id})
              .then(() => res.status(200).json({message : 'Sauce modifié!'}))
              .catch(error => res.status(401).json({ error }));
          }
      }})
        .catch((error) => {
        res.status(400).json({ error });
    }
  );
};

//Supprimer une sauce dans la base de donnée suite à la demande de client
exports.deleteSauce = (req, res, next) => {
  Sauce.findOne({ _id: req.params.id})
      .then(sauce => {
          if (sauce.userId != req.auth.userId) {
              res.status(401).json({message: 'Not authorized'});
          } else {
              const filename = sauce.imageUrl.split('/images/')[1];
              fs.unlink(`images/${filename}`, () => {
                  Sauce.deleteOne({_id: req.params.id})
                      .then(() => { res.status(200).json({message: 'Sauce supprimé !'})})
                      .catch(error => res.status(401).json({ error }));
              });
          }
      })
      .catch( error => {
          res.status(500).json({ error });
      });
 };

//Envoyer toutes les sauces existant dans la base de donnée au front-end
exports.getAllSauce = (req, res, next) => {
  Sauce.find().then(
    (sauces) => {
      res.status(200).json(sauces);
    }
  ).catch(
    (error) => {
      res.status(400).json({
        error: error
      });
    }
  );
};

/*
*Mettre à jour Le nombre total de « Like » et de « Dislike » 
*Mettre à jour les [usersLiked] et [usersDisliked]
*/
exports.like = (req, res, next) => {
  const sauceId = req.params.id;
  const userId = req.body.userId;
  const like = req.body.like;
  Sauce.findOne({ _id: req.params.id})
      .then(sauce => {
        if (like === 1 && !sauce.usersDisliked.includes(userId) && !sauce.usersLiked.includes(userId)) {
          
          Sauce.updateOne(
            { _id: sauceId },
            {
              $inc: { likes: like },
              $push: { usersLiked: userId },
            }
          )
          .then(() => res.status(200).json({ message: "Sauce appréciée" }))
          .catch((error) => res.status(500).json({ error }));
        }
        else if (like === -1 && !sauce.usersLiked.includes(userId) && !sauce.usersDisliked.includes(userId)) {
          Sauce.updateOne(
            { _id: sauceId },
            {
              $inc: { dislikes: -1 * like },
              $push: { usersDisliked: userId },
            }
          )
            .then(() => res.status(200).json({ message: "Sauce dépréciée" }))
            .catch((error) => res.status(500).json({ error }));
        }
        else if (like === 0) {
          Sauce.findOne({ _id: sauceId })
            .then((sauce) => {
              try{
                if (sauce.usersLiked.includes(userId)) {
                  Sauce.updateOne(
                    { _id: sauceId },
                    { $pull: { usersLiked: userId }, $inc: { likes: -1 } }
                  )
                    .then(() => {
                      res.status(200).json({ message: "Apprécié annulé" });
                    })
                    .catch((error) => res.status(500).json({ error }));
                  
                } else if (sauce.usersDisliked.includes(userId)) {
                  Sauce.updateOne(
                    { _id: sauceId },
                    {
                      $pull: { usersDisliked: userId },
                      $inc: { dislikes: -1 },
                    }
                  )
                    .then(() => {
                      res.status(200).json({ message: "Déprecié annulé" });
                    })
                    .catch((error) => res.status(500).json({ error }));
                }else{
                  throw 'Déjà annulé une fois!';
                }
              }
              catch(error) {
                res.status(403).json({ error });
            }
              
            })
            .catch((error) => res.status(401).json({ error }));
        }else (
          res.status(403).json({'error': 'Unauthorized request'})
        )
      
      })
      .catch( error => {
          res.status(500).json({ error });
      });
 };
  

    
