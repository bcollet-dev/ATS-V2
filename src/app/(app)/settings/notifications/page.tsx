import { getGlobalSlackWebhook } from "./actions";
import { NotificationsClient } from "./NotificationsClient";

export default async function NotificationsPage() {
  const webhookUrl = await getGlobalSlackWebhook();
  return <NotificationsClient initialWebhookUrl={webhookUrl} />;
}
