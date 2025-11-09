var supabase;
let localStream = null;
let peerConnections = new Map();
let currentRole = null;
let currentRoomId = null;
let currentUserId = null;
let realtimeChannel = null;
let audioContext = null;
let analyser = null;
let animationId = null;

// MP3 Playlist variables
let audioSource = 'microphone'; // 'microphone' or 'mp3'
let mp3Files = [];
let currentTrackIndex = 0;
let localAudioElement = null;
let isPlaying = false;
let mediaStreamDestination = null;
