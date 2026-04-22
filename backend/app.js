const express = require("express");
const dotenv = require("dotenv");

dotenv.config();
require("./services/db");

const app = express();
app.use(express.json());

