const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v25.0';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mytoken';

const sendTextMessage = async ({phoneNumberId, to, body}) => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('Missing WHATSAPP_ACCESS_TOKEN env var. Cannot send reply.');
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            preview_url: false,
            body,
          },
        }),
      },
    );

    const responseBody = await response.text();

    if (!response.ok) {
      console.error(
        `WhatsApp reply failed: ${response.status} ${response.statusText} ${responseBody}`,
      );
      return;
    }

    console.log(`WhatsApp reply sent: ${responseBody}`);
  } catch (error) {
    console.error('WhatsApp reply request failed:', error);
  }
};

const replyToIncomingMessages = async (body) => {
  const entries = body?.entry || [];
  const replies = [];

  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;

      if (!phoneNumberId || !Array.isArray(value?.messages)) {
        continue;
      }

      for (const message of value.messages) {
        if (!message?.from) {
          continue;
        }

        replies.push(
          sendTextMessage({
            phoneNumberId,
            to: message.from,
            body: 'haya',
          }),
        );
      }
    }
  }

  await Promise.all(replies);
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    console.log(JSON.stringify(req.body));
    await replyToIncomingMessages(req.body);

    return res.status(200).send('OK');
  }

  return res.status(405).send('Method Not Allowed');
}
