const express = require("express");
const dotenv = require("dotenv");
const userDataRoute = require("./routes/userData.route");

dotenv.config();
require("./services/db");

const app = express();
app.use(express.json());

app.use("/", userDataRoute);

app.get("/", (req, res) => {
	res.send("Backend running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});

