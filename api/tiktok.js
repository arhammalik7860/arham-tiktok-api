const axios = require('axios');
const UserAgent = require('user-agents');

const getHeaders = () => {
  const ua = new UserAgent({ deviceCategory: 'mobile', platform: 'Android' });
  return {
    'User-Agent': ua.toString(),
    'Accept': 'application/json',
    'Referer': 'https://www.tiktok.com/',
    'Accept-Language': 'en-US,en;q=0.9',
  };
};

// Fallback 1: SnapTik (Most reliable Nov 2025)
async function getFromSnapTik(url) {
  try {
    const res = await axios.post('https://snaptik.app/abc2.php', 
      new URLSearchParams({ url }), 
      { 
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded', 
          'Origin': 'https://snaptik.app',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        },
        timeout: 15000 
      }
    );
    const html = res.data;
    const noWmMatch = html.match(/hdplay[^"]+"[^"]*without watermark[^"]*mp4[^"]*/i);
    if (noWmMatch) {
      return noWmMatch[0].replace(/hdplay[^"]+"([^"]+)"/i, '$1').replace(/&amp;/g, '&');
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Fallback 2: MusicallyDown (Alternative)
async function getFromMusicallyDown(url) {
  try {
    const res = await axios.post('https://musicaldown.com/api', 
      new URLSearchParams({ url }), 
      { 
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': getHeaders()['User-Agent']
        },
        timeout: 15000 
      }
    );
    const data = res.data;
    return data.video?.noWatermark || data.video?.hdplay;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.json({
      creator: "Arham",
      api: "Arham Private TikTok API v4 (Fixed Nov 2025)",
      endpoints: {
        info: "/?url=https://vm.tiktok.com/XXXXX",
        download: "/?url=VIDEO_URL&download=1",
        music: "/?url=VIDEO_URL&music=1"
      },
      status: "🚀 Fixed & Ready! (Fallbacks Added)"
    });
  }

  if (!url.includes('tiktok.com')) {
    return res.status(400).json({ error: "Bhai, valid TikTok URL daal!" });
  }

  try {
    // Step 1: Try Direct TikTok API (Quick check)
    let awemeId = url.match(/video\/(\d+)/)?.[1];
    if (!awemeId) {
      const shortRes = await axios.get(url, { headers: getHeaders(), maxRedirects: 0, validateStatus: () => true });
      const location = shortRes.headers.location;
      if (location) awemeId = location.match(/video\/(\d+)/)?.[1];
    }
    if (awemeId) {
      const apiUrl = `https://api-h2.tiktokv.com/aweme/v1/aweme/detail/?aweme_id=${awemeId}&aid=1988&app_name=tiktok_web&device_platform=web_mobile&version_code=190300`;
      const response = await axios.get(apiUrl, { headers: getHeaders(), timeout: 10000 });
      const aweme = response.data.aweme_list?.[0] || response.data.aweme_detail;
      if (aweme) {
        const videoData = aweme.video;
        const noWmUrl = videoData.play_addr?.url_list?.[0]?.replace('playwm', 'play') || videoData.download_addr?.url_list?.[0];
        if (noWmUrl) {
          // Direct success – use this
          const result = {
            success: true,
            video_no_watermark: noWmUrl,
            author: aweme.author?.nickname,
            description: aweme.desc,
            creator: "Arham API (Direct)"
          };
          if (req.query.download === '1') {
            const videoRes = await axios.get(result.video_no_watermark, { 
              headers: getHeaders(), 
              responseType: 'arraybuffer', 
              timeout: 30000 
            });
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', `attachment; filename="arham_tiktok_${awemeId}.mp4"`);
            return res.send(videoRes.data);
          }
          return res.json(result);
        }
      }
    }

    // Step 2: Fallback to SnapTik (Main method now)
    let videoUrl = await getFromSnapTik(url);
    if (!videoUrl) {
      videoUrl = await getFromMusicallyDown(url); // Backup
    }
    if (!videoUrl) {
      return res.status(500).json({ error: "Koi bhi method se video nahi mila. Dusra URL try karo!" });
    }

    if (req.query.download === '1') {
      const videoRes = await axios.get(videoUrl, { 
        headers: { ...getHeaders(), 'Referer': 'https://www.tiktok.com/' },
        responseType: 'arraybuffer',
        timeout: 30000 
      });
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="arham_tiktok_fixed.mp4"');
      return res.send(videoRes.data);
    }

    // For music, try SnapTik music link (simple regex)
    if (req.query.music === '1') {
      const musicRes = await axios.post('https://snaptik.app/abc2.php', new URLSearchParams({ url }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': 'https://snaptik.app' },
        timeout: 15000
      });
      const html = musicRes.data;
      const musicMatch = html.match(/music[^"]+"([^"]+\.mp3[^"]*)"/i);
      if (musicMatch) {
        return res.redirect(musicMatch[1]);
      }
      return res.status(404).json({ error: "Music nahi mila is video mein" });
    }

    // JSON info (basic from fallback)
    res.json({
      success: true,
      video_no_watermark: videoUrl,
      method: "Fallback (SnapTik)",
      message: "Download ready! Use &download=1 for direct MP4",
      creator: "Arham API v4 ❤️"
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server mein gadbad, 5 min baad try karo. Error: " + err.message });
  }
};
