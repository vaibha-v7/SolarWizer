const calculateStdDev = (values = []) => {
const numbers = values.map(Number).filter(Number.isFinite);
if (!numbers.length) return 0;
const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
const variance = numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numbers.length;
return Math.sqrt(variance);
};

module.exports = calculateStdDev;
