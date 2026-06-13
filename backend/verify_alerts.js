require('dotenv').config();
const mongoose = require('mongoose');
const Alert = require('./models/Alert.js');
const SiteDailyPerformance = require('./models/SiteDailyPerformance.js');
const UserData = require('./models/data.js');

mongoose.connect(process.env.MONGO_DB_URI)
.then(async () => {
    try {
        const ghasyari = await UserData.findOne({ name: /ghasyari/i }).lean();
        if (ghasyari) {
            console.log('Ghasyari:', ghasyari.name, 'siteId:', ghasyari.siteId, 'sn:', ghasyari.inverterSerialNumber);
            const alertsForGhasyari = await Alert.find({ user_id: ghasyari._id }).lean();
            console.log('Alerts for Ghasyari:', alertsForGhasyari.map(a => `${a.alert_type} (${a.status})`));
            const latestGhasyari = await SiteDailyPerformance.findOne({ user_id: ghasyari._id }).sort({ date: -1 }).lean();
            console.log('Latest data source for Ghasyari:', latestGhasyari?.data_source);
            console.log('Latest actual_generation_kwh for Ghasyari:', latestGhasyari?.actual_generation_kwh);
        } else {
            console.log('Ghasyari not found');
        }
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
});
