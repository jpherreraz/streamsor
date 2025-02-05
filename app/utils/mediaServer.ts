// Get the media server base URL based on environment
export function getStreamBaseUrl(): string {
  // For development, use local network IP
  if (__DEV__) {
    return 'http://10.10.1.100:8001';
  }
  
  // For production, use Firebase Hosting URL
  return 'https://streamsor-6fb0e.web.app';
}

interface Stream {
  playback?: {
    hls: string;
    dash: string;
  };
  rtmps?: {
    url: string;
    streamKey: string;
  };
}

// Get the stream playback URL
export function getStreamPlaybackUrl(stream: Stream): string {
  if (!stream?.playback?.hls) {
    return '';
  }

  // Return the HLS playback URL from Cloudflare
  return stream.playback.hls;
}

// Get the RTMP ingest URL for broadcasters
export function getStreamIngestUrl(stream: Stream): string {
  if (!stream?.rtmps?.url || !stream?.rtmps?.streamKey) {
    return '';
  }

  // Return the RTMPS URL and stream key
  return `${stream.rtmps.url}/${stream.rtmps.streamKey}`;
}

const mediaServer = {
  getStreamBaseUrl,
  getStreamPlaybackUrl,
  getStreamIngestUrl
};

export default mediaServer; 