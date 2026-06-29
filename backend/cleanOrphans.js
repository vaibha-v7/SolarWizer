require('dotenv').config();
const mongoose = require('mongoose');

async function cleanOrphans() {
	try {
		await mongoose.connect(process.env.MONGO_DB_URI || process.env.MONGO_URI);
		const db = mongoose.connection.db;
		const users = await db.collection('userdatas').find().toArray();
		const userIds = users.map(u => String(u._id));
		
		const collections = ['monthlydatas', 'dailypredictions', 'sitedailyperformances', 'usermonthlyproductions', 'sitemonitoringstates', 'alerts', 'soic_alert_history'];
		
		for (const coll of collections) {
			const docs = await db.collection(coll).find().toArray();
			for (const doc of docs) {
				const refId = String(doc.userId || doc.userDataId || doc.user_id);
				if (!userIds.includes(refId) && refId !== 'undefined') {
					await db.collection(coll).deleteOne({ _id: doc._id });
					console.log(`Deleted orphaned doc from ${coll} (ID: ${doc._id})`);
				}
			}
		}
		console.log('Cleanup complete');
	} catch (err) {
		console.error(err);
	} finally {
		process.exit(0);
	}
}

cleanOrphans();
