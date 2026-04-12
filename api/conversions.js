const crypto = require('crypto');

const PIXEL_ID = '933630359537212';
const ACCESS_TOKEN = 'EAAElZBl5s8hYBRFO9WZB3AXNu3tIM69xlwD9n1Hr2O6iumNc25yjHNWki6phhigZBEmSsT5ogZC9WOfvTU28UbErVzCZBMdYeilONnyVQ1ryZBS6EUV2VPpKKk0ggQynV4WOuIWuLGZBBN671SDTw7fZAR3Hq2uRzm6XvSig8eSCN24LVRTB7fLSmCE95jLoFR6dRAZDZD';
const API_VERSION = 'v19.0';

function hashSHA256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event_name, event_id, event_source_url, custom_data, user_data } = req.body;

    if (!event_name) {
      return res.status(400).json({ error: 'event_name is required' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress;
    const clientUserAgent = req.headers['user-agent'];

    const serverEvent = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: event_source_url || req.headers.referer,
      event_id,
      user_data: {
        client_ip_address: clientIp,
        client_user_agent: clientUserAgent,
        fbp: user_data?.fbp || undefined,
        fbc: user_data?.fbc || undefined,
        em: user_data?.email ? [hashSHA256(user_data.email)] : undefined,
        ph: user_data?.phone ? [hashSHA256(user_data.phone)] : undefined,
        fn: user_data?.first_name ? [hashSHA256(user_data.first_name)] : undefined,
        ln: user_data?.last_name ? [hashSHA256(user_data.last_name)] : undefined,
        ct: user_data?.city ? [hashSHA256(user_data.city)] : undefined,
        st: user_data?.state ? [hashSHA256(user_data.state)] : undefined,
        country: user_data?.country ? [hashSHA256(user_data.country)] : undefined,
      },
      custom_data: custom_data || undefined,
    };

    // Remove undefined fields
    Object.keys(serverEvent.user_data).forEach(key => {
      if (serverEvent.user_data[key] === undefined) delete serverEvent.user_data[key];
    });

    const payload = {
      data: [serverEvent],
    };

    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Meta CAPI error:', JSON.stringify(result));
      return res.status(response.status).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Conversions API error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
