// WebRTC Audio Streaming App
// Main Application Logic

let supabase;
let localStream = null;
let peerConnections = new Map();
let currentRole = null; // 'broadcaster' or 'listener'
let currentRoomId = null;
let currentUserId = null;
let realtimeChannel = null;
let audioContext = null;
let analyser = null;
let animationId = null;

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

    // Keep only last 50 logs
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }

    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Start broadcasting
async function startBroadcasting() {
    const roomId = document.getElementById('roomId').value.trim();
    const userId = document.getElementById('userId').value.trim();

    if (!roomId || !userId) {
        alert('Por favor, preencha o nome da sala e seu nome!');
        return;
    }

    try {
        addLog('Solicitando acesso ao microfone...', 'info');
        localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);

        currentRole = 'broadcaster';
        currentRoomId = roomId;
        currentUserId = userId;

        addLog('Microfone acessado com sucesso!', 'success');
        addLog(`Transmissão iniciada na sala: ${roomId}`, 'success');

        // Setup visualizer
        setupAudioVisualizer();

        // Setup realtime channel
        setupRealtimeChannel();

        // Update UI
        document.getElementById('setup').classList.add('hidden');
        document.getElementById('broadcasting').classList.remove('hidden');
        document.getElementById('currentRoom').textContent = roomId;

    } catch (error) {
        addLog('Erro ao acessar microfone: ' + error.message, 'error');
        alert('Não foi possível acessar o microfone. Verifique as permissões.');
    }
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

    // Setup realtime channel
    setupRealtimeChannel();

    // Request to join
    await sendSignal({
        type: 'join-request',
        userId: currentUserId
    });

    // Update UI
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

    // Ignore own messages
    if (message.sender_id === currentUserId) return;

    // Ignore messages for other receivers
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

// Handle join request (broadcaster side)
async function handleJoinRequest(listenerId) {
    addLog(`Novo ouvinte conectando: ${listenerId}`, 'info');

    // Create peer connection
    const pc = createPeerConnection(listenerId);

    // Add local stream
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await sendSignal({
        type: 'offer',
        sdp: offer.sdp
    }, listenerId);

    updateListenerCount();
}
// Handle offer (listener side)
async function handleOffer(broadcasterId, data) {
    addLog('Oferta recebida do broadcaster', 'info');

    // Create peer connection
    const pc = createPeerConnection(broadcasterId);

    // Set remote description
    await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: data.sdp
    }));

    // Create and send answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await sendSignal({
        type: 'answer',
        sdp: answer.sdp
    }, broadcasterId);

    addLog('Resposta enviada ao broadcaster', 'success');
}

// Handle answer (broadcaster side)
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

    // ICE candidate event
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignal({
                type: 'ice-candidate',
                candidate: event.candidate
            }, peerId);
        }
    };

    // Connection state change
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

    // Track event (listener side)
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
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(localStream);
    source.connect(analyser);

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
    // Stop all tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Close all peer connections
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();

    // Unsubscribe from channel
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    // Stop visualizer
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // Close audio context
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    addLog('Transmissão encerrada', 'info');

    // Reset UI
    document.getElementById('broadcasting').classList.add('hidden');
    document.getElementById('setup').classList.remove('hidden');

    currentRole = null;
    currentRoomId = null;
    currentUserId = null;
}

// Stop listening
function stopListening() {
    // Close all peer connections
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();

    // Stop remote audio
    const remoteAudio = document.getElementById('remoteAudio');
    if (remoteAudio.srcObject) {
        remoteAudio.srcObject.getTracks().forEach(track => track.stop());
        remoteAudio.srcObject = null;
    }

    // Unsubscribe from channel
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    addLog('Desconectado da sala', 'info');

    // Reset UI
    document.getElementById('listening').classList.add('hidden');
    document.getElementById('setup').classList.remove('hidden');

    currentRole = null;
    currentRoomId = null;
    currentUserId = null;
}

// Volume control
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
    // Initialize Supabase
    if (!initSupabase()) {
        alert('Erro ao inicializar Supabase. Verifique as configurações em config.js');
        return;
    }

    // Setup event listeners
    document.getElementById('startBroadcast').addEventListener('click', startBroadcasting);
    document.getElementById('joinListener').addEventListener('click', joinAsListener);
    document.getElementById('stopBroadcast').addEventListener('click', stopBroadcasting);
    document.getElementById('stopListening').addEventListener('click', stopListening);

    // Setup volume control
    setupVolumeControl();

    // Periodic cleanup
    setInterval(cleanupOldMessages, CONFIG.CLEANUP_INTERVAL);

    addLog('Aplicação inicializada', 'success');
});
