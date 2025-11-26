const axios = require('axios');
const UserAgent = require('user-agents');

const UA = new UserAgent({ deviceCategory: 'mobile' }).toString();

const headers = {
  'User-Agent': UA,
  'Accept': 'application/json',
  'Referer': 'https://www.tiktok.com/',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');

  const { url } = req.query;

  if (!url) {
    return res.json({
      creator: "Arham",
      api: "Arham TikTok API v2",
      endpoints: {
        video: "/?url=https://vm.tiktok.com/XXXXX",
        music: "/?url=VIDEO_URL&music=1"
      }
    });
  }

  try {
    // Extract video ID
    let id = url.match(/video\/(\d+)/)?.[1];
    if (!id) id = url.match(/\/(\d+)/)?.[1];
    if (!id) return res.status(400).json({ error: "Invalid TikTok URL" });

    // Latest working endpoint (Nov 2025)
    const apiUrl = `https://api22-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${id}&version_code=262&app_name=aweme&channel=googleplay&device_platform=android&aid=1180`;

    const response = await axios.get(apiUrl, { headers, timeout: 10000 });
    const aweme = response.data.aweme_list?.[0];

    if (!aweme) return res.status(404).json({ error: "Video not found or private" });

    const videoData = aweme.video;
    const musicData = aweme.music;

    const result = {
      id: aweme.aweme_id,
      desc: aweme.desc || "No caption",
      author: aweme.author?.nickname || "Unknown",
      author_username: aweme.author?.unique_id,
      likes: aweme.statistics?.digg_count,
      comments: aweme.statistics?.comment_count,
      shares: aweme.statistics?.share_count,
      play_count: aweme.statistics?.play_count,
      video: {
        no_watermark: videoData.play_addr?.url_list?.[0] || videoData.download_addr?.url_list?.[0],
        with_watermark: videoData.download_addr?.url_list?.[0],
        duration: videoData.duration,
        cover: videoData.cover?.url_list?.[0],
        dynamic_cover: videoData.dynamic_cover?.url_list?.[0]
      },
      music: {
        title: musicData.title,
        author: musicData.author,
        url: musicData.play_url?.url_list?.[0]
      },
      creator: "Arham API"
    };

    // Agar music=1 hai to sirf music do
    if (req.query.music === "1") {
      if (result.music.url) {
        return res.redirect(result.music.url);
      }
    }

    // Direct video download
    if (req.query.download === "1" || !req.query.json) {
      const videoUrl = result.video.no_watermark || result.video.with_watermark;
      const videoRes = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="arham_tiktok.mp4"');
      return res.send(videoRes.data);
    }

    // JSON response
    res.json(result);

  } catch (err) {
    res.status(500).json({ error: "Server error bhai, thodi der baad try karo" });
  }
};
