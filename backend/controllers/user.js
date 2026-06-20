const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/User");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);
require("dotenv").config();

// user signup
exports.signup = (req, res, next) => {
  bcrypt
    .hash(req.body.password, 10)
    .then(async (hash) => {
      await docClient.send(
        new PutCommand({
          TableName: process.env.DYNAMODB_TABLE_USER,
          Item: {
            id: crypto.randomUUID(),
            email: req.body.email,
            password: hash,
            createdAt: new Date().toISOString(),
          },
          //user email is unique
          ConditionExpression: "attribute_not_exists(email)",
        }),
      );
    })
    .then(() => res.status(201).json({ message: "Utilisateur créé !" }))
    .catch((error) => {
      // email already exist
      if (error.name === "ConditionalCheckFailedException") {
        return res
          .status(400)
          .json({ message: "Cet email est déjà utilisé !" });
      }
      res.status(500).json({ error: error.message });
    });
};
//user login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    // get user
    const command = new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_USER,
      Key: {
        email: email,
      },
    });

    const response = await docClient.send(command);
    // user not found
    if (!response.Item) {
      return res
        .status(401)
        .json({ message: "Paire identifiant/mot de passe incorrecte !" });
    }
    const user = response.Item;
    delete user.password;

    res.status(200).json({
      userId: user.id,
      token: jwt.sign({ userId: user.id }, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: "24h",
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
