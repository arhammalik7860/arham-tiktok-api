    
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
      api: "Arham Private TikTok API v3 (Nov 2025)",
      endpoints: {
        info: "/?url=https://vm.tiktok.com/XXXXX",
        download: "/?url=VIDEO_URL&download=1",
        music: "/?url=VIDEO_URL&music=1"
      },
      status: "🚀 Ready!"
    });
  }

  if (!url.includes('tiktok.com')) {
    return res.status(400).json({ error: "Bhai, valid TikTok URL daal!" });
  }

  try {
    // Extract aweme_id (video ID)
    let awemeId = url.match(/video\/(\d+)/)?.[1];
    if (!awemeId) {
      // Handle short links – redirect to full URL first
      const shortRes = await axios.get(url, { headers: getHeaders(), maxRedirects: 0, validateStatus: () => true });
      const location = shortRes.headers.location;
      if (location) {
        awemeId = location.match(/video\/(\d+)/)?.[1];
      }
    }
    if (!awemeId) return res.status(400).json({ error: "Video ID nahi mila!" });

    // Updated Endpoint: aweme/detail (working Nov 2025, with better params)
    const apiUrl = `https://api-h2.tiktokv.com/aweme/v1/aweme/detail/?aweme_id=${awemeId}&aid=1988&app_name=tiktok_web&device_platform=web_mobile&version_code=190300&version_name=19.03.00`;

    const response = await axios.get(apiUrl, { 
      headers: getHeaders(), 
      timeout: 15000 
    });

    const aweme = response.data.aweme_list?.[0] || response.data.aweme_detail;

    if (!aweme) return res.status(404).json({ error: "Video not found ya private hai 😔" });

    const videoData = aweme.video;
    const musicData = aweme.music;

    const result = {
      id: aweme.aweme_id,
      description: aweme.desc || "No caption",
      author: aweme.author?.nickname || "Unknown",
      username: aweme.author?.unique_id,
      likes: aweme.statistics?.digg_count,
      comments: aweme.statistics?.comment_count,
      shares: aweme.statistics?.share_count,
      views: aweme.statistics?.play_count,
      video: {
        no_watermark: videoData.play_addr?.url_list?.[0]?.replace('playwm', 'play') || videoData.download_addr?.url_list?.[0],
        with_watermark: videoData.download_addr?.url_list?.[0],
        duration: videoData.duration,
        height: videoData.height,
        width: videoData.width,
        cover: videoData.cover?.url_list?.[0]
      },
      music: {
        title: musicData?.title,
        author: musicData?.author,
        url: musicData?.play_url?.url_list?.[0]
      },
      creator: "Made by Arham ❤️"
    };

    // Music only
    if (req.query.music === '1') {
      if (result.music.url) return res.redirect(result.music.url);
      return res.status(404).json({ error: "No music found" });
    }

    // Direct download
    if (req.query.download === '1') {
      const videoUrl = result.video.no_watermark || result.video.with_watermark;
      if (!videoUrl) return res.status(404).json({ error: "No video URL" });

      const videoRes = await axios.get(videoUrl, { 
        headers: { ...getHeaders(), 'Referer': 'https://www.tiktok.com/' },
        responseType: 'arraybuffer',
        timeout: 30000 
      });

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="arham_tiktok_${awemeId}.mp4"`);
      res.setHeader('Content-Length', videoRes.headers['content-length']);
      return res.send(videoRes.data);
    }

    // JSON response
    res.json(result);

  } catch (err) {
    console.error(err.message);
    // Fallback: Try SnapTik if direct API fails (rare)
    if (err.response?.status === 404 || err.code === 'ENOTFOUND') {
      try {
        const fallbackRes = await axios.post('https://snaptik.app/abc2.php', 
          new URLSearchParams({ url }), 
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': 'https://snaptik.app' } }
        );
        const html = fallbackRes.data;
        const match = html.match(/"(https?:\/\/[^"]+\.mp4[^"]*without watermark[^"]*)"/);
        if (match) return res.redirect(match[1].slice(1, -1));
      } catch (fallbackErr) {
        // Ignore fallback error
      }
    }
    res.status(500).json({ error: "Thodi der baad try karo, TikTok update kar raha hai 🙏" });
  }
};
