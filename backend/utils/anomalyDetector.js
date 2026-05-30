const calculateStdDev = require("./calculateStdDev");

const detectAnomaly = (value, values = []) => {
const numbers = values.map(Number).filter(Number.isFinite);
const current = Number(value);
if (!Number.isFinite(current) || numbers.length < 2) {
return { isAnomaly: false, zScore: 0 };
}
const mean = numbers.reduce((sum, item) => sum + item, 0) / numbers.length;
const stdDev = calculateStdDev(numbers);
if (!stdDev) return { isAnomaly: false, zScore: 0 };
const zScore = (current - mean) / stdDev;
return { isAnomaly: Math.abs(zScore) >= 2.5, zScore };
};

module.exports = {
detectAnomaly
};
