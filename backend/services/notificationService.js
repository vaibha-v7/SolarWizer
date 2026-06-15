class NotificationProvider {
	async sendNotification(alertData) {
		throw new Error("Method 'sendNotification()' must be implemented.");
	}
}

class EmailProvider extends NotificationProvider {
	async sendNotification(alertData) {
		// Mock implementation - ready for Nodemailer
		console.log(`[EmailProvider] Sending Email for Site: ${alertData.site_name} | Severity: ${alertData.severity}`);
		console.log(`[EmailProvider] Details - Expected: ${alertData.predicted_kwh} kWh, Actual: ${alertData.actual_kwh} kWh, Perf: ${alertData.performance_percent}%`);
	}
}

class WhatsAppProvider extends NotificationProvider {
	async sendNotification(alertData) {
		// Mock implementation - ready for Twilio/WhatsApp Cloud API
		console.log(`[WhatsAppProvider] Sending WhatsApp for Site: ${alertData.site_name} | Severity: ${alertData.severity}`);
		console.log(`[WhatsAppProvider] Details - Perf: ${alertData.performance_percent}%, Days Active: ${alertData.consecutive_days}`);
	}
}

class NotificationService {
	constructor() {
		this.providers = [new EmailProvider(), new WhatsAppProvider()];
	}

	async notifyAlertCreated(alertData) {
		const promises = this.providers.map(provider => provider.sendNotification(alertData).catch(err => {
			console.error(`[NotificationService] Error sending notification:`, err.message);
		}));
		await Promise.allSettled(promises);
	}
	
	async notifyAlertUpgraded(alertData) {
		const promises = this.providers.map(provider => provider.sendNotification(alertData).catch(err => {
			console.error(`[NotificationService] Error sending notification:`, err.message);
		}));
		await Promise.allSettled(promises);
	}
}

module.exports = new NotificationService();
