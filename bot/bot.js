require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes } = require('discord.js');
const crypto = require('crypto');
const db = require('../src/db');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
const commands = [
 new SlashCommandBuilder().setName('createpanel').setDescription('Create a VIREX GUARD access panel').addStringOption(o=>o.setName('title').setDescription('Panel title').setRequired(true)).addStringOption(o=>o.setName('subtitle').setDescription('Panel subtitle').setRequired(true)).addStringOption(o=>o.setName('script').setDescription('Script ID or slug').setRequired(true)),
 new SlashCommandBuilder().setName('whitelist').setDescription('Whitelist a user for a script').addUserOption(o=>o.setName('user').setDescription('Discord user').setRequired(true)).addIntegerOption(o=>o.setName('days').setDescription('Access days').setMinValue(1).setMaxValue(3650).setRequired(true)).addStringOption(o=>o.setName('script').setDescription('Script ID or slug').setRequired(true)),
 new SlashCommandBuilder().setName('blacklist').setDescription('Revoke a user from a script').addUserOption(o=>o.setName('user').setDescription('Discord user').setRequired(true)).addStringOption(o=>o.setName('script').setDescription('Script ID or slug').setRequired(true)),
 new SlashCommandBuilder().setName('extendscript').setDescription('Extend a user entitlement').addUserOption(o=>o.setName('user').setDescription('Discord user').setRequired(true)).addIntegerOption(o=>o.setName('days').setDescription('Additional days').setMinValue(1).setMaxValue(3650).setRequired(true)).addStringOption(o=>o.setName('script').setDescription('Script ID or slug').setRequired(true)),
 new SlashCommandBuilder().setName('setbuyerrole').setDescription('Configure buyer role for this server').addRoleOption(o=>o.setName('role').setDescription('Buyer role').setRequired(true)).addStringOption(o=>o.setName('script').setDescription('Script ID or slug').setRequired(true)),
 new SlashCommandBuilder().setName('generatekey').setDescription('Generate access keys').addIntegerOption(o=>o.setName('days').setDescription('Access days').setMinValue(1).setMaxValue(3650).setRequired(true)).addIntegerOption(o=>o.setName('count').setDescription('Number of keys').setMinValue(1).setMaxValue(100).setRequired(true)).addStringOption(o=>o.setName('script').setDescription('Script ID or slug').setRequired(true)),
 new SlashCommandBuilder().setName('freemode').setDescription('Grant Discord user Premium dashboard access').addUserOption(o=>o.setName('user').setDescription('Discord user').setRequired(true)).addIntegerOption(o=>o.setName('days').setDescription('Premium days').setMinValue(1).setMaxValue(3650).setRequired(true)),
 new SlashCommandBuilder().setName('keydrop').setDescription('Generate and post a key drop').addIntegerOption(o=>o.setName('days').setDescription('Access days').setMinValue(1).setMaxValue(3650).setRequired(true)).addIntegerOption(o=>o.setName('count').setDescription('Number of keys').setMinValue(1).setMaxValue(100).setRequired(true)).addStringOption(o=>o.setName('script').setDescription('Script ID or slug').setRequired(true)),
 new SlashCommandBuilder().setName('catalog').setDescription('Browse available VIREX GUARD scripts'),
 new SlashCommandBuilder().setName('myaccess').setDescription('View your active VIREX GUARD access'),
 new SlashCommandBuilder().setName('accesscheck').setDescription('Check a member access status (admin)').addUserOption(o=>o.setName('user').setDescription('Discord member').setRequired(true)).addStringOption(o=>o.setName('script').setDescription('Script ID or slug').setRequired(true)),
 new SlashCommandBuilder().setName('info').setDescription('Show VIREX GUARD service status')
].map(x=>x.toJSON());
const script = id => db.prepare('SELECT * FROM scripts WHERE id=? OR slug=?').get(String(id),String(id));
function createKey(s,days,issuer,redeemedBy=null){const key=crypto.randomBytes(24).toString('hex');db.prepare('INSERT INTO keys(key,script_id,days,uses_left,created_by,redeemed_by,created_at) VALUES(?,?,?,?,?,?,?)').run(key,s.id,days,redeemedBy?0:1,issuer||null,redeemedBy,Date.now());return key;}
function audit(actor,action,detail=''){db.prepare('INSERT INTO audit(actor,action,detail,created_at) VALUES(?,?,?,?)').run(String(actor||'system'),action,String(detail).slice(0,1000),Date.now());}
function isAdmin(i){return adminIds.includes(i.user.id);}
function panel(s,title,subtitle){const safeTitle=String(title||'VIREX GUARD').slice(0,256),safeSubtitle=String(subtitle||'Redeem a key to access this script.').slice(0,4000);const embed=new EmbedBuilder().setColor(0x8b5cf6).setTitle(safeTitle).setDescription(safeSubtitle).addFields({name:'Protected script',value:s.name,inline:true},{name:'Access',value:'Key • Expiry • Download',inline:true}).setFooter({text:'VIREX GUARD • Secure Script Access'});const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`vg_redeem:${s.id}`).setLabel('REDEEM KEY').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId(`vg_getscript:${s.id}`).setLabel('GET SCRIPT').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`vg_role:${s.id}`).setLabel('GET ROLE').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId(`vg_stats:${s.id}`).setLabel('GET STATS').setStyle(ButtonStyle.Secondary));return {embeds:[embed],components:[row]};}
let commandRegistrationTimer;
let commandRegistrationAttempts = 0;
async function registerCommands() {
 if (!process.env.DISCORD_CLIENT_ID) {
  commandRegistrationAttempts += 1;
  const message = 'DISCORD_CLIENT_ID is missing. Set it to the Discord Application ID from the Developer Portal.';
  console.error('Slash-command registration blocked:', message);
  if (process.send) process.send({ type: 'command-registration-failed', message, attempt: commandRegistrationAttempts });
  return false;
 }
 try {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  const route = process.env.DISCORD_GUILD_ID
   ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
   : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
  await rest.put(route, { body: commands });
  commandRegistrationAttempts = 0;
  if (commandRegistrationTimer) clearInterval(commandRegistrationTimer);
  commandRegistrationTimer = null;
  console.log(`Registered ${commands.length} VIREX GUARD slash commands${process.env.DISCORD_GUILD_ID ? ' for test guild' : ' globally'}.`);
  if (process.send) process.send({ type: 'commands-registered', count: commands.length });
  return true;
 } catch (e) {
  commandRegistrationAttempts += 1;
  console.error(`Slash-command registration attempt ${commandRegistrationAttempts} failed:`, e.message);
  if (process.send) process.send({ type: 'command-registration-failed', message: e.message, attempt: commandRegistrationAttempts });
  return false;
 }
}
client.once('ready', async () => {
 console.log(`VIREX GUARD bot online as ${client.user.tag}`);
 if (process.send) process.send({ type: 'bot-ready', tag: client.user.tag, guilds: client.guilds.cache.size });
 const registered = await registerCommands();
 if (!registered && !commandRegistrationTimer) {
  commandRegistrationTimer = setInterval(() => {
   if (commandRegistrationAttempts < 12) registerCommands();
   else { clearInterval(commandRegistrationTimer); commandRegistrationTimer = null; console.error('Slash-command registration stopped after 12 failed attempts. Check application ID, token, and Discord API status.'); }
  }, 60_000);
  commandRegistrationTimer.unref();
 }
 await syncGuilds();
 setInterval(syncGuilds, 5 * 60 * 1000).unref();
});
async function syncGuilds(){try{for(const g of client.guilds.cache.values())db.prepare('INSERT INTO guilds(id,name,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at').run(g.id,g.name,Date.now());}catch(e){console.error('Guild sync:',e.message)}}
client.on('guildCreate',syncGuilds);client.on('guildDelete',g=>{try{db.prepare('DELETE FROM guilds WHERE id=?').run(g.id);}catch(e){console.error('Guild removal sync:',e.message);}});
client.on('interactionCreate',async i=>{
 try{
  if(i.isButton()){
   const [action,sid]=i.customId.split(':');const s=script(sid);if(!s)return i.reply({content:'This script panel is no longer available.',ephemeral:true});
   if(action==='vg_redeem')return i.reply({content:`Redeem your access key on the VIREX GUARD dashboard: ${(process.env.BASE_URL||'').replace(/\/$/,'')}/dashboard.html`,ephemeral:true});
   if(action==='vg_stats')return i.reply({content:`**${s.name}**\nDownloads: ${s.downloads||0}\nStatus: ${s.enabled?'Enabled':'Disabled'}`,ephemeral:true});
   if(action==='vg_getscript')return i.reply({content:`**${s.name}**\n1. Sign in to the VIREX GUARD dashboard: ${(process.env.BASE_URL||'').replace(/\/$/,'')}/dashboard.html\n2. Redeem your access key.\n3. Download the file from your active access list.`,ephemeral:true});
   if(action==='vg_role'){
    if (!i.guild) return i.reply({content:'Buyer roles can only be assigned inside a server.',ephemeral:true});
    await i.deferReply({ephemeral:true});
    const mapping=db.prepare('SELECT role_id FROM buyer_roles WHERE guild_id=? AND script_id=?').get(i.guildId,s.id);if(!mapping)return i.editReply({content:'A buyer role has not been configured for this script in this server.'});
    if(!s.enabled)return i.editReply({content:'This script is currently disabled.'});
    const entitlement=db.prepare('SELECT expires_at FROM entitlements WHERE user_id=? AND script_id=?').get(i.user.id,s.id);if(!entitlement||entitlement.expires_at<=Date.now())return i.editReply({content:'You need active access to this script before receiving the buyer role.'});
    const me=await i.guild.members.fetchMe();if(!me.permissions.has('ManageRoles'))return i.editReply({content:'The bot needs the Manage Roles permission.'});const role=i.guild.roles.cache.get(mapping.role_id)||await i.guild.roles.fetch(mapping.role_id);if(!role)return i.editReply({content:'The configured buyer role no longer exists. Ask an administrator to configure it again.'});if(role.managed||role.position>=me.roles.highest.position)return i.editReply({content:'The buyer role must be a normal role positioned below the bot role.'});const member=await i.guild.members.fetch(i.user.id);await member.roles.add(role,'VIREX GUARD active script entitlement');return i.editReply({content:'Your buyer role has been assigned.'});
   }
  }
  if(!i.isChatInputCommand())return;const name=i.commandName;
  if(name==='info'){
   const embed=new EmbedBuilder().setColor(0x8b5cf6).setTitle('VIREX GUARD • System status').setDescription('Secure script access management is online.').addFields({name:'Discord servers',value:String(client.guilds.cache.size),inline:true},{name:'Registered users',value:String(db.prepare('SELECT count(*) n FROM users').get().n),inline:true},{name:'Protected scripts',value:String(db.prepare('SELECT count(*) n FROM scripts').get().n),inline:true}).setFooter({text:'VIREX GUARD • Operations'});
   return i.reply({embeds:[embed],ephemeral:true});
  }
  if(name==='catalog'){
   const rows=db.prepare('SELECT name,slug FROM scripts WHERE enabled=1 ORDER BY name COLLATE NOCASE LIMIT 20').all();
   const embed=new EmbedBuilder().setColor(0x8b5cf6).setTitle('VIREX GUARD • Script catalog').setDescription(rows.length?rows.map((x,n)=>`**${n+1}. ${x.name}** \`${x.slug}\``).join('\n'):'No scripts are currently available.').setFooter({text:'Redeem an access key on the web dashboard to unlock downloads.'});
   return i.reply({embeds:[embed],ephemeral:true});
  }
  if(name==='myaccess'){
   const rows=db.prepare('SELECT s.name,e.expires_at FROM entitlements e JOIN scripts s ON s.id=e.script_id WHERE e.user_id=? AND e.expires_at>? AND s.enabled=1 ORDER BY e.expires_at').all(i.user.id,Date.now());
   const embed=new EmbedBuilder().setColor(0x8b5cf6).setTitle('Your VIREX GUARD access').setDescription(rows.length?rows.map(x=>`**${x.name}** — expires <t:${Math.floor(x.expires_at/1000)}:R>`).join('\n'):'You do not have active script access yet.').setFooter({text:'Manage keys and downloads in your dashboard.'});
   return i.reply({embeds:[embed],ephemeral:true});
  }
  if(!isAdmin(i))return i.reply({content:'You need administrator access to use this command.',ephemeral:true});
  if(name==='accesscheck'){
   const target=i.options.getUser('user'),s=script(i.options.getString('script'));
   if(!s)return i.reply({content:'Script not found. Use its script ID or slug from the dashboard.',ephemeral:true});
   const ent=db.prepare('SELECT expires_at FROM entitlements WHERE user_id=? AND script_id=?').get(target.id,s.id);
   const active=!!ent&&ent.expires_at>Date.now();
   const embed=new EmbedBuilder().setColor(active?0x22c55e:0xef4444).setTitle('Access verification').setDescription(`Member: <@${target.id}>\nScript: **${s.name}**\nStatus: **${active?'ACTIVE':'NO ACTIVE ACCESS'}**`).addFields({name:'Expires',value:active?`<t:${Math.floor(ent.expires_at/1000)}:F>`:'—',inline:true});
   return i.reply({embeds:[embed],ephemeral:true,allowedMentions:{users:[]}});
  }
  if(name==='createpanel'){const s=script(i.options.getString('script'));if(!s)return i.reply({content:'Script not found. Use its script ID or slug from the dashboard.',ephemeral:true});audit(i.user.id,'bot.panel.create',s.id);return i.reply(panel(s,i.options.getString('title'),i.options.getString('subtitle')));}
  if(name==='freemode'){const u=i.options.getUser('user'),days=i.options.getInteger('days');db.transaction(()=>{db.prepare('INSERT INTO users(id,username,created_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').run(u.id,u.username,Date.now());db.prepare('UPDATE users SET premium_until=max(premium_until,?) WHERE id=?').run(Date.now()+days*86400000,u.id);audit(i.user.id,'bot.premium.grant',`${u.id}:${days}`);})();return i.reply({content:`Premium dashboard access enabled for <@${u.id}> for ${days} days.`,allowedMentions:{users:[u.id]}});}
  const s=script(i.options.getString('script'));if(!s)return i.reply({content:'Script not found.',ephemeral:true});
  if(name==='generatekey'||name==='keydrop'){
   const days=i.options.getInteger('days'),count=i.options.getInteger('count'),keys=[];db.transaction(()=>{for(let n=0;n<count;n++)keys.push(createKey(s,days,i.user.id));audit(i.user.id,'bot.keys.create',`${s.id}:${count}:${days}`);})();
   const chunks=[];for(let n=0;n<keys.length;n+=25)chunks.push(keys.slice(n,n+25));
   const first=`Generated ${keys.length} key(s) for **${s.name}** (${days} days):\n\`${chunks[0].join('\n')}\``;
   await i.reply({content:first,ephemeral:name==='generatekey'});
   for(const part of chunks.slice(1))await i.followUp({content:part.join('\n'),ephemeral:name==='generatekey'});
   return;
  }
  if(name==='setbuyerrole'){if(!i.inGuild())return i.reply({content:'This command can only be used inside a Discord server.',ephemeral:true});const role=i.options.getRole('role');if(role.managed)return i.reply({content:'That is a managed integration role and cannot be assigned by this bot.',ephemeral:true});const me=await i.guild.members.fetchMe();if(!me.permissions.has('ManageRoles')||role.position>=me.roles.highest.position)return i.reply({content:'Give the bot Manage Roles permission and move its highest role above the selected buyer role.',ephemeral:true});db.transaction(()=>{db.prepare('INSERT INTO buyer_roles(guild_id,script_id,role_id) VALUES(?,?,?) ON CONFLICT(guild_id,script_id) DO UPDATE SET role_id=excluded.role_id').run(i.guildId,s.id,role.id);audit(i.user.id,'bot.buyer_role.set',`${i.guildId}:${s.id}:${role.id}`);})();return i.reply({content:`Buyer role for **${s.name}** set to ${role}. Make sure the bot's role is above this role and has Manage Roles permission.`,ephemeral:true});}
  if(name==='whitelist'||name==='extendscript'){
   const u=i.options.getUser('user'),days=i.options.getInteger('days'),stamp=Date.now();
   const old=db.prepare('SELECT expires_at FROM entitlements WHERE user_id=? AND script_id=?').get(u.id,s.id),start=name==='extendscript'&&old&&old.expires_at>stamp?old.expires_at:stamp,expiry=start+days*86400000;
   db.transaction(()=>{db.prepare('INSERT INTO users(id,username,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username').run(u.id,u.username,stamp);db.prepare('INSERT INTO entitlements(user_id,script_id,expires_at) VALUES(?,?,?) ON CONFLICT(user_id,script_id) DO UPDATE SET expires_at=excluded.expires_at').run(u.id,s.id,expiry);audit(i.user.id,name==='whitelist'?'bot.whitelist':'bot.entitlement.extend',`${u.id}:${s.id}:${days}`);})();
   const channelName=String(i.channel?.name||'this channel').slice(0,90);
   return i.reply({content:`<@${u.id}>\nYou have been granted access to **${s.name}** for ${days} day(s).\nOpen the VIREX GUARD dashboard to download the file.\nGrant location: #${channelName}`,allowedMentions:{users:[u.id]}});
  }
  if(name==='blacklist'){const u=i.options.getUser('user');db.transaction(()=>{db.prepare('DELETE FROM entitlements WHERE user_id=? AND script_id=?').run(u.id,s.id);db.prepare('DELETE FROM hwids WHERE user_id=? AND script_id=?').run(u.id,s.id);db.prepare('DELETE FROM keys WHERE script_id=? AND redeemed_by=?').run(s.id,u.id);audit(i.user.id,'bot.blacklist',`${u.id}:${s.id}`);})();const mappings=db.prepare('SELECT guild_id,role_id FROM buyer_roles WHERE script_id=?').all(s.id);for(const m of mappings){const guild=client.guilds.cache.get(m.guild_id);if(!guild)continue;try{const member=await guild.members.fetch(u.id);await member.roles.remove(m.role_id,'VIREX GUARD entitlement revoked');}catch(e){console.warn(`Could not remove buyer role in ${m.guild_id}:`,e.message)}}return i.reply({content:`Removed <@${u.id}> from **${s.name}** and attempted to remove mapped buyer roles.`,allowedMentions:{users:[u.id]}});}
 }catch(e){console.error('Bot interaction:',e);const msg={content:'Command failed. Check bot logs, database access, and Discord role permissions.',ephemeral:true};if(i.replied||i.deferred)await i.followUp(msg).catch(()=>{});else await i.reply(msg).catch(()=>{});}
});
if (!process.env.DISCORD_BOT_TOKEN) {
 console.warn('DISCORD_BOT_TOKEN missing; bot not started');
} else {
 client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Discord bot login failed:', err.message);
  process.exitCode = 1;
 });
}
