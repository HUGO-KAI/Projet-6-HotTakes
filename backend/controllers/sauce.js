const Sauce = require("../models/Sauce");
const fs = require("fs");
const { throwError } = require("rxjs");
const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand, //modifier une sauce avec tous les champs
  GetCommand, //get une sauce par son id
  ScanCommand, //get les sauces avec un ou plusieurs champs
  UpdateCommand, //modifier une sauce avec un ou plusieurs champs
  DeleteCommand, //supprimer une sauce par son id
} = require("@aws-sdk/lib-dynamodb");
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

//Créer une sauce à la demande de l'utilisateur et l'enregistrer dans la base de donnée
//version AWS DynamoDB
exports.createSauce = async (req, res, next) => {
  try {
    // get sauce data from request body and parse it (because it's sent as a string with multer)
    const sauceObject = JSON.parse(req.body.sauce);

    // delete les champs qui ne doivent pas être enregistrés ou sont générés automatiquement
    delete sauceObject.id;
    delete sauceObject.userId;

    // create a new sauce object with all the necessary fields for DynamoDB
    const newSauce = {
      id: crypto.randomUUID(), // create a unique id for the sauce (DynamoDB doesn't auto-generate ids like MongoDB)
      ...sauceObject,
      userId: req.auth.userId,
      // use the file location provided by multer-s3 if an image was uploaded, otherwise set it to an empty string
      imageUrl: req.file ? req.file.location : "",
      likes: 0,
      dislikes: 0,
      usersLiked: [],
      usersDisliked: [],
      createdAt: new Date().toISOString(), // add a timestamp for when the sauce was created (optional but can be useful for sorting or other features)
    };

    // send the new sauce object to DynamoDB to be saved in the table
    await docClient.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_SAUCES,
        Item: newSauce,
        ConditionExpression: "attribute_not_exists(id)", // assure that we don't overwrite an existing sauce with the same id (shouldn't happen because we're using a UUID, but it's good to be safe)
      }),
    );

    // return a success response with the newly created sauce
    res.status(201).json({
      message: "Sauce enregistrée avec succès !",
      sauce: newSauce,
    });
  } catch (error) {
    console.error("create sauce failed:", error);
    res
      .status(500)
      .json({ error: "Une erreur est survenue lors de la création." });
  }
};

//Modifier une sauce suite à la demande de client
exports.modifySauce = async (req, res, next) => {
  try {
    const sauceId = req.params.id;
    const imageUrl = req.file ? req.file.location : null;

    // create a clean object from the request body
    const sauceObject = { ...req.body };

    // delete les champs qui ne doivent pas être modifiés ou sont générés automatiquement
    delete sauceObject.id;
    delete sauceObject.userId;

    let parts = []; // for building the UpdateExpression
    let expressionAttributeNames = {};
    let expressionAttributeValues = {
      ":currentUserId": req.auth.userId, // verify that the current user is the owner of the sauce (for ConditionExpression)
    };

    // create the UpdateExpression dynamically based on the fields provided in the request body
    Object.keys(sauceObject).forEach((key) => {
      expressionAttributeNames[`#${key}`] = key;
      // make sure to convert heat to a number, because DynamoDB expects the correct data type
      expressionAttributeValues[`:${key}`] =
        key === "heat" ? Number(sauceObject[key]) : sauceObject[key];
      parts.push(`#${key} = :${key}`);
    });

    // if an image was uploaded, include it in the UpdateExpression
    if (imageUrl) {
      expressionAttributeNames["#imgUrl"] = "imageUrl";
      expressionAttributeValues[":img"] = imageUrl;
      parts.push("#imgUrl = :img");
    }

    // use the parts array to build the final UpdateExpression string
    // exemple： "SET #name = :name, #manufacturer = :manufacturer, #imgUrl = :img"
    const finalUpdateExpression = "SET " + parts.join(", ");
    // 5. 发送更新指令
    await docClient.send(
      new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_SAUCES,
        Key: { id: sauceId },
        UpdateExpression: finalUpdateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: "userId = :currentUserId", // olny allow the update if the current user is the owner of the sauce
      }),
    );
    res.status(200).json({ message: "Sauce modifiée !" });
  } catch (error) {
    console.error("修改酱汁失败详情:", error);
    if (error.name === "ConditionalCheckFailedException") {
      return res
        .status(403)
        .json({ error: "Vous n'êtes pas autorisé à modifier cette sauce." });
    }
    res.status(500).json({ error: error.message });
  }
};

//Supprimer une sauce dans la base de donnée suite à la demande de client
exports.deleteSauce = async (req, res, next) => {
  try {
    const sauceId = req.params.id;
    const userId = req.auth.userId;

    //find the sauce by its id
    const sauce = await docClient.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_SAUCES,
        Key: { id: sauceId },
      }),
    );

    if (!sauce.Item) {
      return res.status(404).json({ error: "Sauce non trouvée." });
    }
    // check if the user is the owner of the sauce before deleting
    if (sauce.Item.userId !== userId) {
      return res
        .status(403)
        .json({ error: "Vous n'êtes pas autorisé à supprimer cette sauce." });
    }

    // delete the sauce from DynamoDB
    await docClient.send(
      new DeleteCommand({
        TableName: process.env.DYNAMODB_TABLE_SAUCES,
        Key: { id: sauceId },
      }),
    );

    res.status(200).json({ message: "Sauce supprimée !" });
  } catch (error) {
    console.error("delete sauce failed:", error);
    res.status(500).json({ error: error.message });
  }
};

//Envoyer toutes les sauces existant dans la base de donnée au front-end
exports.getAllSauce = async (req, res, next) => {
  try {
    const limit = 30; // limite le nombre de résultats retournés par page
    const { nextKey } = req.query; // pageKey from the front-end, used for pagination (the "key" to start the next scan from)

    const scanOptions = {
      TableName: process.env.DYNAMODB_TABLE_SAUCES,
      Limit: limit,
    };

    // if the front-end sent a nextKey, we need to decode it and pass it to DynamoDB to continue scanning from where we left off
    if (nextKey) {
      try {
        // decode the nextKey from the front-end (which is a Base64 string) back into a JSON object that DynamoDB can understand as the ExclusiveStartKey
        const decodedKey = Buffer.from(nextKey, "base64").toString("utf-8");
        scanOptions.ExclusiveStartKey = JSON.parse(decodedKey);
      } catch (e) {
        return res.status(400).json({ error: "bad nextKey format" });
      }
    }

    const command = new ScanCommand(scanOptions);
    const response = await docClient.send(command);

    // result to return to the front-end, including the data and the nextKey for pagination if there are more results
    const result = {
      data: response.Items || [],
      nextKey: null, // no next page by default
    };

    // if the response from DynamoDB includes a LastEvaluatedKey, it means there are more results to fetch, so we need to prepare the nextKey for the front-end
    if (response.LastEvaluatedKey) {
      // encode the LastEvaluatedKey as a Base64 string to send back to the front-end, so it can be used as the nextKey for the next request
      const stringifiedKey = JSON.stringify(response.LastEvaluatedKey);
      result.nextKey = Buffer.from(stringifiedKey).toString("base64");
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("getAllSauce failed:", error);
    res.status(500).json({ error: error.message });
  }
};
//Envoyer toutes les sauces de l'utilisateur existant dans la base de donnée au front-end
exports.getUserSauces = async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const limit = 30; // limit the number of results returned per page
    const { nextKey } = req.query; // pageKey from the front-end, used for pagination (the "key" to start the next scan from)

    const scanOptions = {
      TableName: process.env.DYNAMODB_TABLE_SAUCES,
      Limit: limit,
      FilterExpression: "userId = :uid",

      ExpressionAttributeValues: {
        ":uid": userId,
      },
    };

    // if the front-end sent a nextKey, we need to decode it and pass it to DynamoDB to continue scanning from where we left off
    if (nextKey) {
      try {
        // decode the nextKey from the front-end (which is a Base64 string) back into a JSON object that DynamoDB can understand as the ExclusiveStartKey
        const decodedKey = Buffer.from(nextKey, "base64").toString("utf-8");
        scanOptions.ExclusiveStartKey = JSON.parse(decodedKey);
      } catch (e) {
        return res.status(400).json({ error: "bad nextKey format" });
      }
    }

    const command = new ScanCommand(scanOptions);
    const response = await docClient.send(command);

    // result to return to the front-end
    const result = {
      data: response.Items || [],
      nextKey: null, // no next page by default
    };

    // if the response from DynamoDB includes a LastEvaluatedKey, it means there are more results to fetch, so we need to prepare the nextKey for the front-end
    if (response.LastEvaluatedKey) {
      // encode the LastEvaluatedKey as a Base64 string to send back to the front-end, so it can be used as the nextKey for the next request
      const stringifiedKey = JSON.stringify(response.LastEvaluatedKey);
      result.nextKey = Buffer.from(stringifiedKey).toString("base64");
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("getUserSauces failed:", error);
    res.status(500).json({ error: error.message });
  }
};
//get one sause by id and send it to front-end
exports.getOneSauce = async (req, res, next) => {
  try {
    const command = new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_SAUCES,
      Key: {
        id: req.params.id, //only need the id to get the sauce, other fields are not necessary for the query because we are getting the whole item by its primary key (id)
      },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      return res.status(200).json({});
    }

    res.status(200).json(response.Item);
  } catch (error) {
    console.error("getOneSauce failed:", error);
    res.status(500).json({ error: error.message });
  }
};

/*
 *Mettre à jour Le nombre total de « Like » et de « Dislike »
 *Mettre à jour les [usersLiked] et [usersDisliked]
 */
exports.like = async (req, res, next) => {
  try {
    const sauceId = req.params.id;
    const userId = req.body.userId;
    const like = req.body.like;
    //trouver la sauce par son id et vérifier si l'utilisateur a déjà aimé ou déprécié la sauce
    const sauce = await docClient.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_SAUCES,
        Key: { id: sauceId },
      }),
    );

    if (!sauce.Item) {
      return res.status(404).json({ error: "Sauce non trouvée." });
    }
    // initialize the usersLiked and usersDisliked arrays and the current likes/dislikes counts, in case they are not defined in the database (for backward compatibility with older items that might not have these fields)
    const usersLiked = sauce.usersLiked || [];
    const usersDisliked = sauce.usersDisliked || [];
    const currentLikes = sauce.likes || 0;
    const currentDislikes = sauce.dislikes || 0;
    // prepare the variables for the UpdateExpression and ExpressionAttributeValues based on the like value and whether the user has already liked or disliked the sauce, to handle all cases (like, dislike, cancel like, cancel dislike) in a single database update operation
    let updateExpression = "";
    let expressionAttributeValues = {};
    let successMessage = "";
    if (
      like === 1 &&
      !usersDisliked.includes(userId) &&
      !usersLiked.includes(userId)
    ) {
      //like
      updateExpression =
        "SET likes = :newLikes, usersLiked = list_append(if_not_exists(usersLiked, :empty_list), :user_arr)";
      expressionAttributeValues = {
        ":newLikes": currentLikes + 1,
        ":user_arr": [userId],
        ":empty_list": [],
      };
      successMessage = "Sauce appréciée";
    } else if (
      like === -1 &&
      !usersLiked.includes(userId) &&
      !usersDisliked.includes(userId)
    ) {
      //dislike
      updateExpression =
        "SET dislikes = :newDislikes, usersDisliked = list_append(if_not_exists(usersDisliked, :empty_list), :user_arr)";
      expressionAttributeValues = {
        ":newDislikes": currentDislikes + 1,
        ":user_arr": [userId],
        ":empty_list": [],
      };
      successMessage = "Sauce dépréciée";
    } else if (like === 0) {
      //cancel like or cancel dislike
      if (usersLiked.includes(userId)) {
        const updatedLikedList = usersLiked.filter((id) => id !== userId);

        updateExpression = "SET likes = :newLikes, usersLiked = :new_list";
        expressionAttributeValues = {
          ":newLikes": Math.max(0, currentLikes - 1), // avoid negative likes count
          ":new_list": updatedLikedList,
        };
        successMessage = "Apprécié annulé";
      } else if (usersDisliked.includes(userId)) {
        const updatedDislikedList = usersDisliked.filter((id) => id !== userId);

        updateExpression =
          "SET dislikes = :newDislikes, usersDisliked = :new_list";
        expressionAttributeValues = {
          ":newDislikes": Math.max(0, currentDislikes - 1),
          ":new_list": updatedDislikedList,
        };
        successMessage = "Déprecié annulé";
      } else {
        return res.status(200).json({ message: "Already cancelled !" });
      }
    } else {
      return res.status(400).json({ error: "bad request" });
    }
    // update the sauce in DynamoDB with the new likes/dislikes counts and the updated usersLiked/usersDisliked lists, all in one operation to ensure data consistency
    await docClient.send(
      new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_SAUCES,
        Key: { id: sauceId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );
    res.status(200).json({ message: successMessage });
  } catch (error) {
    console.error("update like/dislike failed:", error);
    res.status(500).json({ error: error.message });
  }
};
