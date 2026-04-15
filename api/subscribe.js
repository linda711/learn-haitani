const crypto = require('crypto');

export default async function handler(req, res) {
    // CORS headers — allow requests from your domain
    res.setHeader('Access-Control-Allow-Origin', 'https://learn.haitani.org');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, tag } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const API_KEY  = process.env.MAILCHIMP_API_KEY;
    const LIST_ID  = process.env.MAILCHIMP_LIST_ID;
    const SERVER   = API_KEY.split('-')[1]; // e.g. 'us14'
    const AUTH     = Buffer.from(`anystring:${API_KEY}`).toString('base64');

    const subscriberHash = crypto
        .createHash('md5')
        .update(email.toLowerCase())
        .digest('hex');

    const baseUrl = `https://${SERVER}.api.mailchimp.com/3.0/lists/${LIST_ID}/members`;
    const headers = {
        'Authorization': `Basic ${AUTH}`,
        'Content-Type': 'application/json',
    };

    try {
        // PUT = upsert: adds new subscriber or updates existing — no errors for already-subscribed
        const memberRes = await fetch(`${baseUrl}/${subscriberHash}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                email_address: email,
                status_if_new: 'subscribed',
            }),
        });

        if (!memberRes.ok) {
            const err = await memberRes.json();
            return res.status(400).json({ error: err.detail || 'MailChimp error' });
        }

        // Apply tag if provided
        if (tag) {
            await fetch(`${baseUrl}/${subscriberHash}/tags`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    tags: [{ name: tag, status: 'active' }],
                }),
            });
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
}
