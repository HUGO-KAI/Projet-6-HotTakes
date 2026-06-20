const path = require("path");
require("dotenv").config();
const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";
require("dotenv").config({
  path: path.resolve(__dirname, envFile),
});
const cors = require("cors");
const express = require("express");
const userRoutes = require("./routes/user");
const sauceRoutes = require("./routes/sauce");

//const mongoose = require("mongoose");
const helmet = require("helmet");
//const mongodbSanitize = require("mongodb-sanitize");
const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");

const s3TestClient = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const app = express();
const serverless = require("serverless-http");

app.use(cors());
app.use(express.json());
//app.use(mongodbSanitize());
app.use(helmet());

//Connecter à la base de donnée mmongodb
/* const mongoString = process.env.DATABASE_URL;
mongoose
  .connect(mongoString, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connexion à MongoDB réussie !"))
  .catch(() => console.log("Connexion à MongoDB échouée !")); */

// 模拟 S3 连接测试
s3TestClient
  .send(new HeadBucketCommand({ Bucket: process.env.AWS_BUCKET_NAME }))
  .then(() => {
    console.log("Connexion à Amazon S3 réussie ! (Bucket accessible)");
  })
  .catch((err) => {
    console.log("Connexion à Amazon S3 échouée ! 请检查密钥或桶名称。");
    // console.error(err); // 如果需要看具体错误可以取消注释
  });
//Ajouter header aux toutes reponses afin que tous les utilisateurs peuvent accèder à l'API avec des méthodes pré-définies
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content, Accept, Content-Type, Authorization",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
});

//attribuer des middlewares aux différentes routes
app.use("/api/sauces", sauceRoutes);
app.use("/api/auth", userRoutes);
app.use("/images", express.static(path.join(__dirname, "images")));

if (process.env.LAMBDA_TASK_ROOT) {
  // handler pour aws Lambda
  module.exports.handler = serverless(app);
} else {
  // sinon app pour server.js
  module.exports = app;
}
