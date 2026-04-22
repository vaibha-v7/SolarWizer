const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_DB_URI)
.then(() => {
    console.log("MongoDB connected");
})
.catch((err) => {
    console.log(err);
});