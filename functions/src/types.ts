export interface CloudflareResponse {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  messages?: Array<{ code: number; message: string }>;
  result?: {
    uid: string;
    rtmps: {
      url: string;
      streamKey: string;
    };
    rtmpsPlayback?: {
      url: string;
      streamKey: string;
    };
    srt?: {
      url: string;
      streamId: string;
      passphrase: string;
    };
    srtPlayback?: {
      url: string;
      streamId: string;
      passphrase: string;
    };
    webRTC?: {
      url: string;
    };
    webRTCPlayback?: {
      url: string;
    };
    playback: {
      hls: string;
      dash: string;
    };
    created?: string;
    modified?: string;
    meta?: {
      name?: string;
      live?: boolean;
      uploadedBy?: string;
    };
    status?: {
      current: {
        state: string;
        reason: string;
        ingestProtocol: string;
        statusEnteredAt: string;
        statusLastSeen: string;
      };
      history: Array<any>;
    };
    recording?: {
      mode: string;
      requireSignedURLs: boolean;
      allowedOrigins: any;
      hideLiveViewerCount: boolean;
    };
    deleteRecordingAfterDays?: number | null;
  };
}

export interface RTDBUserData {
  email?: string;
  displayName?: string;
  photoURL?: string;
  title?: string;
  streamKey?: string;
  liveInputId?: string;
  rtmpsUrl?: string;
  playback?: {
    hls: string;
    dash: string;
  };
  timestamp?: number;
}

export interface RTDBCommentData {
  text: string;
  userId: string;
  timestamp: number;
  [key: string]: any;
}

export interface RTDBCommentsData {
  [streamId: string]: {
    [commentId: string]: RTDBCommentData;
  };
}

export interface CloudflareStreamResponse {
  uid: string;
  status?: {
    state: string;
  };
  meta?: {
    name?: string;
    uploadedBy?: string;
    viewerCount?: number;
  };
  thumbnail?: string;
}

export interface CloudflareStream {
  uid: string;
  meta?: {
    name?: string;
    uploaderId?: string;
    uploaderEmail?: string;
    uploaderPhotoURL?: string | null;
  };
  created: string;
}

export interface UserData {
  liveInputId?: string;
  displayName?: string;
  email?: string;
  title?: string;
  viewerCount?: number;
  thumbnailUrl?: string;
  photoURL?: string;
  playback?: {
    hls: string;
    dash: string;
  };
} 