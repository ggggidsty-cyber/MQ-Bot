require("dotenv").config();
const {Client,GatewayIntentBits,Partials}=require("discord.js");
const {joinVoiceChannel,createAudioPlayer,createAudioResource,NoSubscriberBehavior,VoiceConnectionStatus,entersState}=require("@discordjs/voice");
const play=require("play-dl");
const {DISCORD_TOKEN,TEXT_CHANNEL_ID,VOICE_CHANNEL_ID}=process.env;
if(!DISCORD_TOKEN||!TEXT_CHANNEL_ID||!VOICE_CHANNEL_ID){console.error("Missing required environment variables.");process.exit(1);}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildVoiceStates],partials:[Partials.Channel]});
const player=createAudioPlayer({behaviors:{noSubscriber:NoSubscriberBehavior.Play}});
let connection=null, guildId=null, retryTimer=null, retrying=false;
async function configuredGuild(){const ch=await client.channels.fetch(VOICE_CHANNEL_ID);if(!ch||!ch.isVoiceBased())throw Error("VOICE_CHANNEL_ID must be an accessible voice channel.");return ch.guild;}
async function joinRoom(guild){
 if(connection&&connection.state.status!==VoiceConnectionStatus.Destroyed&&connection.joinConfig.channelId===VOICE_CHANNEL_ID)return;
 if(connection){try{connection.destroy();}catch{} connection=null;}
 const ch=await guild.channels.fetch(VOICE_CHANNEL_ID);if(!ch||!ch.isVoiceBased())throw Error("Voice channel not found.");
 connection=joinVoiceChannel({channelId:ch.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:false});guildId=guild.id;connection.subscribe(player);
 connection.on(VoiceConnectionStatus.Disconnected,()=>scheduleRetry());connection.on("error",e=>{console.error(e);scheduleRetry();});
 await entersState(connection,VoiceConnectionStatus.Ready,20000);console.log("Connected to MQ voice room.");
}
function scheduleRetry(){if(retryTimer)clearTimeout(retryTimer);retryTimer=setTimeout(async()=>{if(retrying)return;retrying=true;try{const g=guildId?client.guilds.cache.get(guildId):await configuredGuild();if(g)await joinRoom(g);}catch(e){console.error("Reconnect:",e.message);scheduleRetry();}finally{retrying=false;}},4000);}
client.once("ready",async()=>{console.log("Ready as "+client.user.tag);try{await joinRoom(await configuredGuild());}catch(e){console.error(e);scheduleRetry();}});
client.on("messageCreate",async m=>{if(m.author.bot||m.channelId!==TEXT_CHANNEL_ID||!m.guild)return;const t=m.content.trim();try{await joinRoom(m.guild);if(/^وقف$/.test(t)){player.stop(true);await m.reply("⏹️ تم إيقاف الأغنية.");return;}const match=t.match(/^شغل\\s+(.+)$/);if(match){const r=await play.search(match[1],{limit:1});if(!r.length||!r[0].url){await m.reply("ما لقيت نتيجة متاحة للأغنية.");return;}const s=await play.stream(r[0].url);player.play(createAudioResource(s.stream,{inputType:s.type}));await m.reply("🎵 جاري تشغيل: **"+(r[0].title||match[1])+"**");}}catch(e){console.error(e);await m.reply("تعذر تنفيذ الأمر. تأكد من الصلاحيات وإعدادات الاستضافة.");}});
client.on("voiceStateUpdate",(oldS,newS)=>{if(client.user&&oldS.id===client.user.id&&newS.channelId!==VOICE_CHANNEL_ID)scheduleRetry();});
client.login(DISCORD_TOKEN);
