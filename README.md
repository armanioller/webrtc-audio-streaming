# 🎙️ WebRTC Audio Streaming App

Aplicativo de streaming de áudio em tempo real usando WebRTC e Supabase.

## 🚀 Características

- **Streaming de áudio P2P** via WebRTC
- **Sinalização em tempo real** usando Supabase Realtime
- **Interface moderna** e responsiva
- **Suporte a múltiplos usuários** (broadcaster e listeners)
- **Baixa latência** com conexão peer-to-peer

## 📋 Pré-requisitos

- Navegador moderno com suporte a WebRTC
- Conta Supabase (gratuita)
- Servidor HTTP para desenvolvimento local

## 🔧 Configuração

### 1. Configure o Supabase

1. Crie uma conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Vá em `Project Settings` > `API`
4. Copie suas credenciais:
   - `Project URL`
   - `anon/public key`

### 2. Configure o banco de dados

Execute o seguinte SQL no Supabase SQL Editor:

```sql
-- Criar tabela para sinalização WebRTC
CREATE TABLE signaling (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE signaling ENABLE ROW LEVEL SECURITY;

-- Política para permitir INSERT
CREATE POLICY "Enable insert for all users" ON signaling
  FOR INSERT
  WITH CHECK (true);

-- Política para permitir SELECT
CREATE POLICY "Enable select for all users" ON signaling
  FOR SELECT
  USING (true);

-- Política para permitir DELETE (cleanup)
CREATE POLICY "Enable delete for all users" ON signaling
  FOR DELETE
  USING (true);

-- Criar índice para melhor performance
CREATE INDEX idx_signaling_room_id ON signaling(room_id, created_at DESC);
```

### 3. Configure as credenciais

Edite o arquivo `config.js` e adicione suas credenciais do Supabase:

```javascript
const SUPABASE_URL = 'sua-url-do-supabase';
const SUPABASE_KEY = 'sua-chave-publica';
```

## 🎮 Como usar

### Iniciar servidor local

```bash
# Opção 1: Python
python -m http.server 8000

# Opção 2: Node.js (http-server)
npx http-server -p 8000

# Opção 3: PHP
php -S localhost:8000
```

### Como Broadcaster (Transmissor)

1. Abra `http://localhost:8000`
2. Digite um nome de sala (ex: "sala-teste")
3. Clique em "Start Broadcasting"
4. Permita acesso ao microfone quando solicitado
5. Compartilhe o nome da sala com os ouvintes

### Como Listener (Ouvinte)

1. Abra `http://localhost:8000` em outra aba/navegador
2. Digite o mesmo nome da sala
3. Clique em "Join as Listener"
4. Aguarde a conexão ser estabelecida
5. Você ouvirá o áudio do broadcaster!

## 🏗️ Arquitetura

### Fluxo de Conexão

```
Broadcaster                 Supabase                 Listener
    |                          |                         |
    |------ OFFER ------------>|                         |
    |                          |------ OFFER ----------->|
    |                          |<----- ANSWER ----------|
    |<----- ANSWER ------------|                         |
    |                          |                         |
    |<========== WebRTC P2P Connection ================>|
    |                    (Audio Stream)                  |
```

### Componentes

- **WebRTC**: Protocolo P2P para streaming de mídia
- **Supabase Realtime**: Sinalização e descoberta de peers
- **MediaStream API**: Captura de áudio do microfone

## 🛠️ Tecnologias

- **WebRTC** - Comunicação peer-to-peer
- **Supabase** - Backend as a Service + Realtime
- **Vanilla JavaScript** - Sem frameworks, puro e rápido
- **HTML5 + CSS3** - Interface moderna

## 📱 Compatibilidade

- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari
- ✅ Opera
- ⚠️ Requer HTTPS em produção

## 🔐 Segurança

- Use HTTPS em produção (obrigatório para WebRTC)
- Configure CORS adequadamente
- Implemente autenticação para produção
- Use TURN servers para NAT traversal em produção

## 🐛 Troubleshooting

### Áudio não funciona
- Verifique se o microfone está permitido no navegador
- Teste em HTTPS (necessário em produção)
- Verifique o console do navegador para erros

### Conexão falha
- Confirme as credenciais do Supabase
- Verifique se a tabela `signaling` foi criada
- Verifique as políticas RLS do Supabase

### NAT/Firewall
- Em produção, use um TURN server
- Configure ICE servers adequados

## 📄 Licença

MIT License - Sinta-se livre para usar e modificar!

## 🤝 Contribuições

Pull requests são bem-vindos! Para mudanças maiores, abra uma issue primeiro.

## 🎯 Roadmap

- [ ] Suporte a múltiplos broadcasters
- [ ] Chat de texto
- [ ] Gravação de áudio
- [ ] Controle de qualidade de áudio
- [ ] Dashboard de estatísticas
- [ ] Salas privadas com senha

## 📞 Suporte

Para problemas ou dúvidas, abra uma issue no GitHub!

---

Desenvolvido com ❤️ usando WebRTC + Supabase
