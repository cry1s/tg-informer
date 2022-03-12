const { Client, Intents } = require('discord.js');
const dotenv = require('dotenv');
const googleTTS = require('google-tts-api');
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  AudioPlayerStatus,
  VoiceConnectionStatus,
} = require('@discordjs/voice');
const { NewMessage } = require('telegram/events');

const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] })
const player = createAudioPlayer();

let chads = [
  188100410316161024n, // me
  252155456720470016n,
  320899131533164544n,
  506546769853677572n,
]

let news_chats = [
  -1001101170442,
]

let all_chats = [
  -1001143742161,
  -1001645717443,
]

let chats = news_chats.concat(all_chats);

dotenv.config();

async function getChannelsWhereChads(chads) {
  let ret = [];
  for (let i = 0; i < bot.guilds.cache.size; i++) {
    const guild = bot.guilds.cache.at(i);
    for (let k = 0; k < chads.length; k++) {
      try {
        const chad = await guild.members.fetch(chads[k].toString())
        if (!chad) continue;
        if (!chad.voice.channel) continue;
        console.log(chad.displayName, 'in', chad.voice.channel.name);
        ret.push(chad.voice.channel)
        break;
      } catch {
        continue
      }
    }
  }
  return ret;
}

function deleteUselessConnections(connections) {
  ret = []
  for (let i = 0; i < connections.length; i++) {
    const con = connections[i];
    if (con.state == VoiceConnectionStatus.Destroyed || con.state == VoiceConnectionStatus.Disconnected) continue;
    ret.push(con);
  }
  return ret
}


async function connectToChannels(channels) {
  let cons = []
  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });
    cons.push(connection);
  }
  // wait for ready
  for (let i = 0; i < cons.length; i++) {
    const con = cons[i];
    await entersState(con, VoiceConnectionStatus.Ready, 1e4).catch(() => con.destroy())
  }
  // dels destroyed
  return deleteUselessConnections(cons);
}

function subscribePlayer(connections) {
  connections.forEach(con => {
    con.subscribe(player);
  });
}

async function playText(text) {
  console.log("Читаю:", text);
  const urls = googleTTS
    .getAllAudioUrls(text, {
      lang: 'ru',
      host: 'https://translate.google.ru',
      timeout: 1e4,
      splitPunct: ',.?',
    }).map(url => url.url);
  setTimeout(() => {
    entersState(player, AudioPlayerStatus.Idle, 60000).then(async () => {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        player.play(createAudioResource(url))
        await entersState(player, AudioPlayerStatus.Idle, 60000)
      }
    });
  }, 100)
  await entersState(player, AudioPlayerStatus.Idle, 60000);
}

bot.once('ready', async () => {
  console.log(`Logged in as ${bot.user.tag}!`);
  await tginit();
  await setupConnections();
  playText("РАБОТАЕМ РАБОТАЕМ");
});

async function setupConnections() {
  const new_channels = await getChannelsWhereChads(chads);
  const cons = await connectToChannels(new_channels);
  subscribePlayer(cons);
  return cons;
}

async function tginit() {
  const apiId = +process.env.APIID;
  const apiHash = process.env.APIHASH;
  const stringSession = new StringSession(process.env.STRING_SESSION);
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.connect();
  console.log("You should now be connected.");
  client.addEventHandler(async event => {
    if (event['message'].text) {
      let msg = event['message'].text;
      const chatid = event['message'].chatId;
      if (!(msg.includes("❗️") || msg.includes("⚡️")) && news_chats.includes(chatid)) return;
      msg = msg.replace("❗️", "").replace("⚡️", "").replace("**", "");
      await setupConnections();
      await playText(msg);
    }
  }, new NewMessage({ chats }))
}

bot.login(process.env.TOKEN);
