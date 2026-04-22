const UserData = require("../models/data");

const createUserData = async (req, res) => {
	try {
		const createdRecord = await UserData.create(req.body);
		return res.status(201).json({
			message: "User data created successfully",
			data: createdRecord
		});
	} catch (error) {
		return res.status(400).json({
			message: "Failed to create user data",
			error: error.message
		});
	}
};

module.exports = {
	createUserData
};
