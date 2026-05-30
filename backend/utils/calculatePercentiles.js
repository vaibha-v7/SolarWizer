const calculatePercentile = (sortedValues, percentile) => {
if (!sortedValues.length) return 0;
const index = (percentile / 100) * (sortedValues.length - 1);
const lower = Math.floor(index);
const upper = Math.ceil(index);
if (lower === upper) return sortedValues[lower];
const weight = index - lower;
return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
};

const calculatePercentiles = (values = [], percentiles = [10, 25, 50, 75, 90]) => {
const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
return percentiles.reduce((acc, percentile) => {
acc[`p${percentile}`] = calculatePercentile(sorted, percentile);
return acc;
}, {});
};

module.exports = calculatePercentiles;
