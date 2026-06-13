require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_DB_URI).then(async () => {
  const UserData = require('./models/data');
  const Alert = require('./models/Alert');
  
  const users = await UserData.find({ name: { $in: ['Arpit', 'Vaibhav Patel'] } }).lean();
  console.log('User Data:', JSON.stringify(users.map(u => ({
      name: u.name,
      tiltDeg: u.tiltDeg,
      azimuthDeg: u.azimuthDeg,
      latitude: u.location?.latitude,
      longitude: u.location?.longitude,
      systemCapacity: u.systemCapacity
  })), null, 2));

  const siteAlerts = await Alert.find({ status: { $in: ["CREATED", "ACTIVE", "ESCALATED"] } }).lean();
  for (const alert of siteAlerts) {
      if (alert.user_id && alert.user_id.toString().toLowerCase().endsWith('31b5a0')) {
          console.log('Alert 31B5A0 ID:', alert._id, 'UserID:', alert.user_id, 'UserName:', alert.user_name);
          const userForAlert = await UserData.findById(alert.user_id).lean();
          console.log('User for 31B5A0:', userForAlert ? 'Found: ' + userForAlert.name : 'NOT FOUND');
      }
  }

  process.exit();
}).catch(console.error);
