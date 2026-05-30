const calculateLinearRegression = (values = []) => {
const points = values.map(Number).filter(Number.isFinite);
const n = points.length;
if (!n) {
return { slope: 0, intercept: 0, r_squared: 0 };
}

let sumX = 0;
let sumY = 0;
let sumXY = 0;
let sumXX = 0;
for (let i = 0; i < n; i += 1) {
sumX += i;
sumY += points[i];
sumXY += i * points[i];
sumXX += i * i;
}

const denominator = n * sumXX - sumX * sumX;
const slope = denominator ? (n * sumXY - sumX * sumY) / denominator : 0;
const intercept = n ? (sumY - slope * sumX) / n : 0;

const meanY = sumY / n;
let ssRes = 0;
let ssTot = 0;
for (let i = 0; i < n; i += 1) {
const predicted = slope * i + intercept;
ssRes += (points[i] - predicted) ** 2;
ssTot += (points[i] - meanY) ** 2;
}
const r_squared = ssTot ? 1 - ssRes / ssTot : 0;

return { slope, intercept, r_squared };
};

module.exports = calculateLinearRegression;
