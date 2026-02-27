import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

// 환경변수 검증
const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CHANNEL_ID', 'N8N_WEBHOOK_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

client.on('ready', () => {
  console.log(`Bot ready: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== CHANNEL_ID) return;

  // 텍스트 메시지 또는 음성 첨부파일 처리
  const payload = {
    userId: message.author.id,
    username: message.author.username,
    channelId: message.channelId,
    messageId: message.id,
  };

  // 음성 첨부파일 확인
  const audioAttachment = message.attachments.find(
    (a) => a.contentType?.startsWith('audio/')
  );

  if (audioAttachment) {
    payload.type = 'voice';
    payload.audioUrl = audioAttachment.url;
  } else if (message.content.trim()) {
    payload.type = 'text';
    payload.text = message.content.trim();
  } else {
    return; // 빈 메시지 무시
  }

  let reaction;
  try {
    reaction = await message.react('\u23F3');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Webhook responded with status ${res.status}`);
    }

    const result = await res.json();

    await message.reply(result.message || '\uCC98\uB9AC \uC644\uB8CC');
    try { await reaction.users.remove(client.user.id); } catch {}
  } catch (err) {
    console.error('Webhook error:', err);
    await message.reply('\u274C \uC608\uC57D \uC2DC\uC2A4\uD15C\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
    try { if (reaction) await reaction.users.remove(client.user.id); } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
