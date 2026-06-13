const mongoose = require('mongoose');
const Alert = require('./backend/models/Alert.js');
const SiteDailyPerformance = require('./backend/models/SiteDailyPerformance.js');

mongoose.connect('mongodb://localhost:27017/solar', { useNewUrlParser: true, useUnifiedTopology: true })
.then(async () => {
    try {
        const noRealTimeAlerts = await Alert.find({ alert_type: 'No Real-Time Data', status: { $in: ['CREATED', 'ACTIVE', 'ESCALATED'] } }).lean();
        console.log('Active No Real-Time Data alerts:', noRealTimeAlerts.length);
        
        let foundIssue = false;
        for (const alert of noRealTimeAlerts) {
            const latest = await SiteDailyPerformance.findOne({ user_id: alert.user_id }).sort({ date: -1 }).lean();
            if (latest && latest.data_source === 'daily_prediction_inverter') {
                console.log('Site ID:', alert.user_id);
                console.log('Alert Status:', alert.status);
                console.log('Latest Telemetry data_source:', latest.data_source);
                console.log('hasActualTelemetry (implied): true');
                console.log('Latest Performance Ratio:', latest.performance_ratio);
                foundIssue = true;
                break;
            }
        }
        if (!foundIssue) {
            console.log('No such sequence found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
});
