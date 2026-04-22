const mongoose = require("mongoose");

const userDataSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    systemCapacity: { type: Number, required: true },
    tiltDeg: { type: Number, required: true },
    azimuthDeg: { type: Number, required: true },
    shadingFactor: { type: Number, required: true },
    soilingLossPercent: { type: Number, required: true },
    inverterLossPercent: { type: Number, required: true },
    wiringLossPercent: { type: Number, required: true },
    miscLossPercent: { type: Number, required: true }
});

module.exports = mongoose.model("UserData", userDataSchema);