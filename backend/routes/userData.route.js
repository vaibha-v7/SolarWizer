const express = require("express");
const { createUserData } = require("../controllers/userData.controller");

const router = express.Router();

router.post("/", createUserData);

module.exports = router;
