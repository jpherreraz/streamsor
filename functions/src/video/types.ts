export interface VideoMetadata {
  uid: string;
  meta?: {
    name?: string;
    uploadedBy?: string;
  };
  thumbnail?: string;
  playback?: {
    hls: string;
  };
  created?: string;
  status?: {
    current?: {
      state: string;
      statusLastSeen: string;
    }
  };
  liveInput?: string;
  duration?: number;
}

export interface StreamData {
  userId?: string;
  streamerId?: string;
}

export interface CloudflareVideo {
  uid: string;
  meta?: {
    name?: string;
    uploadedBy?: string;
  };
  thumbnail?: string;
  playback?: {
    hls?: string;
  };
  created?: string;
  liveInput?: string;
  duration?: number;
}

export interface ProcessedVideo {
  uid: string;
  title: string;
  thumbnail?: string;
  playbackUrl?: string;
  createdAt?: string;
  uploader: {
    id?: string;
    email: string;
    photoURL: string | null;
  };
} 