// WebRTC Audio Streaming App with MP3 Playlist Support
// Main Application Logic

let supabase;
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

// Initialize Supabase
function initSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        addLog('Supabase inicializado', 'success');
        return true;
    } catch (error) {
        addLog('Erro ao inicializar Supabase: ' + error.message, 'error');
        return false;
    }
}

// Add log entry
function addLog(message, type = 'info') {
    const logContainer = document.getElementById('logContainer');
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';

    const time = new Date().toLocaleTimeString('pt-BR');
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${time}]`;

    const messageSpan = document.createElement('span');
    messageSpan.className = `log-${type}`;
    messageSpan.textContent = ' ' + message;

    logEntry.appendChild(timeSpan);
    logEntry.appendChild(messageSpan);
    logContainer.insertBefore(logEntry, logContainer.firstChild);

    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }

    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Handle audio source change
function setupAudioSourceListeners() {
    const radioButtons = document.querySelectorAll('input[name="audioSource"]');
    const mp3Section = document.getElementById('mp3Section');
    const mp3FilesInput = document.getElementById('mp3Files');
    const playlistPreview = document.getElementById('playlistPreview');

    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            audioSource = e.target.value;
            if (audioSource === 'mp3') {
                mp3Section.classList.remove('hidden');
            } else {
                mp3Section.classList.add('hidden');
            }
        });
    });

    mp3FilesInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        mp3Files = files;

        playlistPreview.innerHTML = '';
        if (files.length > 0) {
            files.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `<span>🎵 ${index + 1}. ${file.name}</span>`;
                playlistPreview.appendChild(fileItem);
            });
            addLog(`${files.length} arquivo(s) MP3 carregado(s)`, 'success');
        }
    });
}

// Start broadcasting
async function startBroadcasting() {
    const roomId = document.getElementById('roomId').value.trim();
    const userId = document.getElementById('userId').value.trim();

    if (!roomId || !userId) {
        alert('Por favor, preencha o nome da sala e seu nome!');
        return;
    }

    if (audioSource === 'mp3' && mp3Files.length === 0) {
        alert('Por favor, selecione pelo menos um arquivo MP3!');
        return;
    }

    try {
        currentRole = 'broadcaster';
        currentRoomId = roomId;
        currentUserId = userId;

        if (audioSource === 'microphone') {
            addLog('Solicitando acesso ao microfone...', 'info');
            localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            addLog('Microfone acessado com sucesso!', 'success');
            document.getElementById('audioSourceType').textContent = 'Microfone';
        } else {
            addLog('Configurando streaming de MP3...', 'info');
            await setupMP3Streaming();
            document.getElementById('audioSourceType').textContent = 'Playlist MP3';
            document.getElementById('playlistControls').classList.remove('hidden');
        }

        addLog(`Transmissão iniciada na sala: ${roomId}`, 'success');

        setupAudioVisualizer();
        setupRealtimeChannel();

        document.getElementById('setup').classList.add('hidden');
        document.getElementById('broadcasting').classList.remove('hidden');
        document.getElementById('currentRoom').textContent = roomId;

    } catch (error) {
        addLog('Erro ao iniciar transmissão: ' + error.message, 'error');
        alert('Erro ao iniciar transmissão: ' + error.message);
    }
}

// Setup MP3 streaming
async function setupMP3Streaming() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    localAudioElement = document.getElementById('localAudio');
    localAudioElement.src = URL.createObjectURL(mp3Files[0]);

    mediaStreamDestination = audioContext.createMediaStreamDestination();
    const source = audioContext.createMediaElementSource(localAudioElement);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    source.connect(analyser);
    source.connect(mediaStreamDestination);
    source.connect(audioContext.destination);

    localStream = mediaStreamDestination.stream;

    setupPlaylistUI();
    setupAudioEventListeners();

    localAudioElement.play();
    isPlaying = true;
    updatePlayPauseButton();

    addLog('Playlist configurada com sucesso', 'success');
}

// Setup playlist UI
function setupPlaylistUI() {
    const playlistItems = document.getElementById('playlistItems');
    playlistItems.innerHTML = '';

    mp3Files.forEach((file, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="track-number">${index + 1}</span>
            <span class="track-name">${file.name}</span>
        `;
        li.addEventListener('click', () => playTrack(index));
        if (index === currentTrackIndex) {
            li.classList.add('active');
        }
        playlistItems.appendChild(li);
    });

    updateNowPlaying();
}

// Setup audio event listeners
function setupAudioEventListeners() {
    const audio = localAudioElement;

    audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        document.getElementById('progressFill').style.width = progress + '%';
        document.getElementById('currentTime').textContent = formatTime(audio.currentTime);
        document.getElementById('duration').textContent = formatTime(audio.duration);
    });

    audio.addEventListener('ended', () => {
        nextTrack();
    });

    const progressBar = document.querySelector('.progress-bar');
    progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    });
}

// Play specific track
function playTrack(index) {
    if (index < 0 || index >= mp3Files.length) return;

    currentTrackIndex = index;
    localAudioElement.src = URL.createObjectURL(mp3Files[index]);
    localAudioElement.play();
    isPlaying = true;

    updatePlaylistUI();
    updateNowPlaying();
    updatePlayPauseButton();

    addLog(`Tocando: ${mp3Files[index].name}`, 'info');
}

// Previous track
function prevTrack() {
    if (currentTrackIndex > 0) {
        playTrack(currentTrackIndex - 1);
    } else {
        playTrack(mp3Files.length - 1);
    }
}

// Next track
function nextTrack() {
    if (currentTrackIndex < mp3Files.length - 1) {
        playTrack(currentTrackIndex + 1);
    } else {
        playTrack(0);
    }
}

// Play/Pause toggle
function togglePlayPause() {
    if (!localAudioElement) return;

    if (isPlaying) {
        localAudioElement.pause();
        isPlaying = false;
    } else {
        localAudioElement.play();
        isPlaying = true;
    }

    updatePlayPauseButton();
}

// Update play/pause button
function updatePlayPauseButton() {
    const btn = document.getElementById('playPause');
    if (btn) {
        btn.textContent = isPlaying ? '⏸️' : '▶️';
    }
}

// Update playlist UI
function updatePlaylistUI() {
    const items = document.querySelectorAll('#playlistItems li');
    items.forEach((item, index) => {
        if (index === currentTrackIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Update now playing display
function updateNowPlaying() {
    if (mp3Files.length > 0) {
        document.getElementById('currentTrack').textContent = mp3Files[currentTrackIndex].name;
    }
}

// Format time
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Join as listener
async function joinAsListener() {
    const roomId = document.getElementById('roomId').value.trim();
    const userId = document.getElementById('userId').value.trim();

    if (!roomId || !userId) {
        alert('Por favor, preencha o nome da sala e seu nome!');
        return;
    }

    currentRole = 'listener';
    currentRoomId = roomId;
    currentUserId = userId;

    addLog(`Entrando na sala: ${roomId}`, 'info');

    setupRealtimeChannel();

    await sendSignal({
        type: 'join-request',
        userId: currentUserId
    });

    document.getElementById('setup').classList.add('hidden');
    document.getElementById('listening').classList.remove('hidden');
    document.getElementById('listeningRoom').textContent = roomId;

    addLog('Aguardando conexão com broadcaster...', 'info');
}

// Setup realtime channel
function setupRealtimeChannel() {
    realtimeChannel = supabase
        .channel(`room:${currentRoomId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'signaling',
                filter: `room_id=eq.${currentRoomId}`
            },
            handleSignalingMessage
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                addLog('Canal de sinalização conectado', 'success');
            }
        });
}

// Handle signaling messages
async function handleSignalingMessage(payload) {
    const message = payload.new;

    if (message.sender_id === currentUserId) return;
    if (message.receiver_id && message.receiver_id !== currentUserId) return;

    const data = message.payload;
    addLog(`Mensagem recebida: ${message.type}`, 'info');

    try {
        switch (message.type) {
            case 'join-request':
                if (currentRole === 'broadcaster') {
                    await handleJoinRequest(message.sender_id);
                }
                break;

            case 'offer':
                if (currentRole === 'listener') {
                    await handleOffer(message.sender_id, data);
                }
                break;

            case 'answer':
                if (currentRole === 'broadcaster') {
                    await handleAnswer(message.sender_id, data);
                }
                break;

            case 'ice-candidate':
                await handleIceCandidate(message.sender_id, data);
                break;
        }
    } catch (error) {
        addLog('Erro ao processar mensagem: ' + error.message, 'error');
    }
}

// Send signal through Supabase
async function sendSignal(data, receiverId = null) {
    try {
        const { error } = await supabase
            .from('signaling')
            .insert({
                room_id: currentRoomId,
                sender_id: currentUserId,
                receiver_id: receiverId,
                type: data.type,
                payload: data
            });

        if (error) throw error;
        addLog(`Sinal enviado: ${data.type}`, 'info');
    } catch (error) {
        addLog('Erro ao enviar sinal: ' + error.message, 'error');
    }
}

// Handle join request
async function handleJoinRequest(listenerId) {
    addLog(`Novo ouvinte conectando: ${listenerId}`, 'info');

    const pc = createPeerConnection(listenerId);

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await sendSignal({
        type: 'offer',
        sdp: offer.sdp
    }, listenerId);

    updateListenerCount();
}

// Handle offer
async function handleOffer(broadcasterId, data) {
    addLog('Oferta recebida do broadcaster', 'info');

    const pc = createPeerConnection(broadcasterId);

    await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: data.sdp
    }));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await sendSignal({
        type: 'answer',
        sdp: answer.sdp
    }, broadcasterId);

    addLog('Resposta enviada ao broadcaster', 'success');
}

// Handle answer
async function handleAnswer(listenerId, data) {
    const pc = peerConnections.get(listenerId);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: data.sdp
    }));

    addLog(`Resposta recebida de: ${listenerId}`, 'success');
}

// Handle ICE candidate
async function handleIceCandidate(peerId, data) {
    const pc = peerConnections.get(peerId);
    if (!pc || !data.candidate) return;

    try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        addLog('ICE candidate adicionado', 'info');
    } catch (error) {
        addLog('Erro ao adicionar ICE candidate: ' + error.message, 'error');
    }
}

// Create peer connection
function createPeerConnection(peerId) {
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    peerConnections.set(peerId, pc);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignal({
                type: 'ice-candidate',
                candidate: event.candidate
            }, peerId);
        }
    };

    pc.onconnectionstatechange = () => {
        addLog(`Conexão ${peerId}: ${pc.connectionState}`, 'info');

        if (pc.connectionState === 'connected') {
            addLog(`Conectado com ${peerId}!`, 'success');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            addLog(`Desconectado de ${peerId}`, 'error');
            peerConnections.delete(peerId);
            updateListenerCount();
        }
    };

    if (currentRole === 'listener') {
        pc.ontrack = (event) => {
            addLog('Stream de áudio recebido!', 'success');
            const remoteAudio = document.getElementById('remoteAudio');
            remoteAudio.srcObject = event.streams[0];

            document.getElementById('listenStatus').textContent = 'Conectado';
            document.getElementById('listenStatus').style.background = '#10b981';
        };
    }

    return pc;
}

// Setup audio visualizer
function setupAudioVisualizer() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!analyser) {
        analyser = audioContext.createAnalyser();

        if (audioSource === 'microphone') {
            const source = audioContext.createMediaStreamSource(localStream);
            source.connect(analyser);
        }
    }

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');

    function draw() {
        animationId = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = '#0f172a';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height;

            const gradient = canvasCtx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
            gradient.addColorStop(0, '#8b5cf6');
            gradient.addColorStop(1, '#6366f1');

            canvasCtx.fillStyle = gradient;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    }

    draw();
}

// Update listener count
function updateListenerCount() {
    if (currentRole === 'broadcaster') {
        const count = Array.from(peerConnections.values()).filter(
            pc => pc.connectionState === 'connected'
        ).length;
        document.getElementById('listenerCount').textContent = count;
    }
}

// Stop broadcasting
function stopBroadcasting() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (localAudioElement) {
        localAudioElement.pause();
        localAudioElement.src = '';
    }

    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();

    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    addLog('Transmissão encerrada', 'info');

    document.getElementById('broadcasting').classList.add('hidden');
    document.getElementById('playlistControls').classList.add('hidden');
    document.getElementById('setup').classList.remove('hidden');

    currentRole = null;
    currentRoomId = null;
    currentUserId = null;
    mp3Files = [];
    currentTrackIndex = 0;
}

// Stop listening
function stopListening() {
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();

    const remoteAudio = document.getElementById('remoteAudio');
    if (remoteAudio.srcObject) {
        remoteAudio.srcObject.getTracks().forEach(track => track.stop());
        remoteAudio.srcObject = null;
    }

    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    addLog('Desconectado da sala', 'info');

    document.getElementById('listening').classList.add('hidden');
    document.getElementById('setup').classList.remove('hidden');

    currentRole = null;
    currentRoomId = null;
    currentUserId = null;
}

// Setup volume control
function setupVolumeControl() {
    const volumeSlider = document.getElementById('volume');
    const volumeValue = document.getElementById('volumeValue');
    const remoteAudio = document.getElementById('remoteAudio');

    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        remoteAudio.volume = volume;
        volumeValue.textContent = e.target.value + '%';
    });
}

// Cleanup old signaling messages
async function cleanupOldMessages() {
    try {
        const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
        await supabase
            .from('signaling')
            .delete()
            .lt('created_at', oneMinuteAgo);
    } catch (error) {
        console.error('Erro ao limpar mensagens antigas:', error);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    if (!initSupabase()) {
        alert('Erro ao inicializar Supabase. Verifique as configurações em config.js');
        return;
    }

    setupAudioSourceListeners();

    document.getElementById('startBroadcast').addEventListener('click', startBroadcasting);
    document.getElementById('joinListener').addEventListener('click', joinAsListener);
    document.getElementById('stopBroadcast').addEventListener('click', stopBroadcasting);
    document.getElementById('stopListening').addEventListener('click', stopListening);

    document.getElementById('prevTrack')?.addEventListener('click', prevTrack);
    document.getElementById('playPause')?.addEventListener('click', togglePlayPause);
    document.getElementById('nextTrack')?.addEventListener('click', nextTrack);

    setupVolumeControl();

    setInterval(cleanupOldMessages, CONFIG.CLEANUP_INTERVAL);

    addLog('Aplicação inicializada', 'success');
});
