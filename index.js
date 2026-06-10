const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI);

app.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error || !code || !state) return res.send('Authorization failed: ' + (error || 'missing params'));
    const [guildId, creatorId] = state.split(':');
    try {
        const params = new URLSearchParams({
            client_key: process.env.TIKTOK_CLIENT_KEY,
            client_secret: process.env.TIKTOK_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.TIKTOK_REDIRECT_URI,
        });
        const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.data?.access_token) return res.send('Failed: ' + JSON.stringify(tokenData));
        const { access_token, refresh_token, expires_in, open_id } = tokenData.data;
        await mongoose.connection.collection('guildconfigs').updateOne(
            { guildId, 'contentCreators.id': creatorId },
            { $set: {
                'contentCreators.$.tiktokAccessToken': access_token,
                'contentCreators.$.tiktokRefreshToken': refresh_token,
                'contentCreators.$.tiktokTokenExpiry': new Date(Date.now() + expires_in * 1000),
                'contentCreators.$.tiktokOpenId': open_id,
            }}
        );
        res.send('<h2>TikTok connected!</h2><p>You can close this window. The bot will now post notifications when new videos are uploaded.</p>');
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

app.listen(PORT, () => console.log('Listening on', PORT));
