const express = require("express");
const dotenv = require("dotenv");
const userDataRoute = require("./routes/userData.route");

dotenv.config();
require("./services/db");

const app = express();
app.use(express.json());
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

	if (req.method === "OPTIONS") {
		return res.sendStatus(204);
	}

	next();
});

app.use("/", userDataRoute);

app.get("/", (req, res) => {
	res.send("Backend running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});

