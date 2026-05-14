const cors = require("cors");
const express = require("express");
const userRoutes = require("./routes/user");
const sauceRoutes = require("./routes/sauce");
const path = require("path");
const mongoose = require("mongoose");
const helmet = require("helmet");
const mongodbSanitize = require("mongodb-sanitize");
require("dotenv").config();

const app = express();
const serverless = require("serverless-http");

app.use(cors());
app.use(express.json());
app.use(mongodbSanitize());
app.use(helmet());

//Connecter à la base de donnée mmongodb
const mongoString = process.env.DATABASE_URL;
mongoose
  .connect(mongoString, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connexion à MongoDB réussie !"))
  .catch(() => console.log("Connexion à MongoDB échouée !"));

//attribuer des middlewares aux différentes routes
app.use("/api/sauces", sauceRoutes);
app.use("/api/auth", userRoutes);
app.use(
  "/images",
  express.static(path.join(__dirname, "images"), {
    setHeaders: (res) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin"); //Any site can get images
    },
  }),
);

if (process.env.LAMBDA_TASK_ROOT) {
  // handler pour aws Lambda
  module.exports.handler = serverless(app);
} else {
  // sinon app pour server.js
  module.exports = app;
}
