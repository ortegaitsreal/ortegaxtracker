
// index.js - Bot FiveM Player Tracker (Dengan Playtime Tracking)
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ============ SETUP DATABASE PLAYTIME ============
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Buat folder data jika belum ada
if (!fs.existsSync('./data')) fs.mkdirSync('./data');

const db = new sqlite3.Database('./data/playtime.db');

// Buat tabel player sessions
db.run(`
    CREATE TABLE IF NOT EXISTS player_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT,
        player_id INTEGER,
        player_name TEXT,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_seconds INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1
    )
`);

// ============ DATABASE SERVER ============
const serverDatabase = [
    {
        id: "cerita",
        name: "CR ROLEPLAY 2.0",
        ip: "103.42.116.42",
        port: 30120,
        maxPlayers: 1000,
        logo: "https://cdn.discordapp.com/attachments/1373778515098468382/1485635560537325670/CR.png?ex=6a2e07af&is=6a2cb62f&hm=f481b70230b386421d0c1b6d004ce923df60aaebf0573fa978b69bb2f4b8721a&",
        description: "Server RP Indonesia terpopuler",
        connect: "connect play.ceritaroleplayku.id"
    },
    {
        id: "kotakita",
        name: "KOTAKITA ROLEPLAY INDONESIA",
        ip: "31.58.143.101",
        port: 30120,
        maxPlayers: 2048,
        logo: "https://media.discordapp.net/attachments/832162287380725770/1423173258215297034/KOTAKITA.1.png?ex=6a2d8d22&is=6a2c3ba2&hm=b9affba15e54a7370f3ac52e247d7b033ef45ffd92ceda7244bde659411b0797&=&format=webp&quality=lossless&width=766&height=552",
        description: "#5TILLKOTAKITA",
        connect: "connect fivem.kotakitarp.id"
    },
    {
        id: "ime",
        name: "IME RP",
        ip: "imeroleplay-cdn.cbtp.co.id",
        port: 30120,
        maxPlayers: 2048,
        logo: "https://imeroleplay.com/favicon.webp",
        description: "iMe Roleplay",
        connect: "connect main.imeroleplay.com"
    },
    {
        id: "ckrp",
        name: "CERITA KITA ROLEPLAY",
        ip: "49.128.187.42",
        port: 30120,
        maxPlayers: 666,
        logo: "https://www.ceritakitarp.com/logo.png",
        description: "SETIAP CERITA ADALAH BAGIAN DARI KITA",
        connect: "connect satu.ceritakitarp.com"
    },
    {
        id: "knrp",
        name: "KISAH NUSANTARA ROLEPLAY",
        ip: "49.128.187.82",
        port: 30120,
        maxPlayers: 1000,
        logo: "https://frontend.cfx-services.net/api/servers/icon/gad5d7z/1411448061.png",
        description: "MENGHARGAI DAN MENGHORMATI",
        connect: "connect 49.128.187.82:30120"
    }
];

// ============ FUNGSI GET SIGNAL DENGAN CUSTOM EMOJI ============
const SIGNAL_HIJAU = '<:HIJAU:1515182620017692672>';
const SIGNAL_KUNING = '<:KUNING:1515182635666636840>';
const SIGNAL_ORANGE = '<:ORANGE:1515182649436540979>';
const SIGNAL_RED = '<:RED:1515182666956279941>';

function getSignalSymbol(ping) {
    if (ping <= 50) return SIGNAL_HIJAU;
    if (ping <= 100) return SIGNAL_KUNING;
    if (ping <= 200) return SIGNAL_ORANGE;
    return SIGNAL_RED;
}

// ============ FUNGSI FETCH ============
async function fetchWithTimeout(url, timeout = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// ============ FUNGSI PLAYTIME ============
function updatePlayerSession(serverId, playerId, playerName) {
    return new Promise((resolve) => {
        db.get(`
            SELECT id, first_seen FROM player_sessions 
            WHERE server_id = ? AND player_id = ? AND is_active = 1
        `, [serverId, playerId], (err, session) => {
            if (err) {
                resolve(null);
                return;
            }
            
            if (!session) {
                db.run(`
                    INSERT INTO player_sessions (server_id, player_id, player_name, first_seen, last_seen, is_active)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
                `, [serverId, playerId, playerName], function(err) {
                    if (err) {
                        resolve(null);
                    } else {
                        resolve({ id: this.lastID, first_seen: new Date(), isNew: true });
                    }
                });
            } else {
                db.run(`UPDATE player_sessions SET last_seen = CURRENT_TIMESTAMP WHERE id = ?`, [session.id], (err) => {
                    if (err) {
                        resolve(null);
                    } else {
                        resolve({ id: session.id, first_seen: new Date(session.first_seen), isNew: false });
                    }
                });
            }
        });
    });
}

function getPlayerPlaytime(serverId, playerId) {
    return new Promise((resolve) => {
        db.get(`
            SELECT first_seen FROM player_sessions 
            WHERE server_id = ? AND player_id = ? AND is_active = 1
        `, [serverId, playerId], (err, row) => {
            if (err || !row) {
                resolve("Baru");
                return;
            }
            
            const firstSeen = new Date(row.first_seen);
            const now = new Date();
            const diffMs = now - firstSeen;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDays > 0) {
                const remainingHours = diffHours % 24;
                if (remainingHours > 0) {
                    resolve(`${diffDays}h ${remainingHours}j`);
                } else {
                    resolve(`${diffDays}h`);
                }
            } else if (diffHours > 0) {
                resolve(`${diffHours}j ${diffMinutes}m`);
            } else if (diffMinutes > 0) {
                resolve(`${diffMinutes}m`);
            } else {
                resolve("Baru");
            }
        });
    });
}

async function cleanupInactiveSessions(serverId, activePlayerIds) {
    if (activePlayerIds.length === 0) return;
    
    const placeholders = activePlayerIds.map(() => '?').join(',');
    db.run(`
        UPDATE player_sessions 
        SET is_active = 0,
            total_seconds = CAST((julianday('now') - julianday(first_seen)) * 86400 AS INTEGER)
        WHERE server_id = ? AND is_active = 1 
          AND player_id NOT IN (${placeholders})
    `, [serverId, ...activePlayerIds]);
}

// ============ AMBIL DATA SERVER ============
async function getServerInfo(server) {
    const baseUrl = `http://${server.ip}:${server.port}`;
    
    try {
        let infoRes = null;
        let playersRes = null;
        
        try {
            infoRes = await fetchWithTimeout(`${baseUrl}/info.json`, 8000);
        } catch (e) {}
        
        try {
            playersRes = await fetchWithTimeout(`${baseUrl}/players.json`, 8000);
        } catch (e) {}

        let serverData = {
            name: server.name,
            players: 0,
            maxPlayers: server.maxPlayers,
            online: false,
            playersList: [],
            gametype: 'Roleplay'
        };

        if (infoRes && infoRes.ok) {
            const info = await infoRes.json();
            serverData.name = info.projectName || info.hostname || server.name;
            serverData.gametype = info.vars?.gametype || 'Roleplay';
            serverData.online = true;
        }

        if (playersRes && playersRes.ok) {
            const players = await playersRes.json();
            serverData.players = players.length;
            
            const activePlayerIds = players.map(p => p.id || 0);
            await cleanupInactiveSessions(server.id, activePlayerIds);
            
            const playersWithPlaytime = [];
            
            for (const p of players) {
                const playerId = p.id || 0;
                const playerName = (p.name || 'Unknown').replace(/`/g, '').replace(/\|/g, '');
                const playerPing = p.ping || 0;
                
                await updatePlayerSession(server.id, playerId, playerName);
                const playtime = await getPlayerPlaytime(server.id, playerId);
                
                playersWithPlaytime.push({
                    no: 0,
                    id: playerId,
                    name: playerName,
                    ping: playerPing,
                    playtime: playtime
                });
            }
            
            serverData.playersList = playersWithPlaytime;
            serverData.playersList.sort((a, b) => a.id - b.id);
            serverData.playersList.forEach((p, idx) => p.no = idx + 1);
        }

        return serverData;
    } catch (error) {
        return { ...server, online: false, players: 0, maxPlayers: server.maxPlayers, playersList: [] };
    }
}

// ============ MEMBUAT TABEL PLAYER (Dengan Playtime) ============
function createPlayerTable(players, page = 1, itemsPerPage = 20) {
    if (!players || players.length === 0) return { table: "Tidak ada pemain online", totalPages: 1 };
    
    const totalPages = Math.ceil(players.length / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, players.length);
    const pagePlayers = players.slice(startIndex, endIndex);
    
    let table = "";
    for (const player of pagePlayers) {
        const no = player.no.toString();
        const noCenter = no.padStart(2, ' ').padEnd(3, ' ');
        const signal = getSignalSymbol(player.ping);
        const id = player.id.toString();
        const idCenter = id.padStart(3, ' ').padEnd(4, ' ');
        const name = player.name.length > 32 ? player.name.substring(0, 29) + "..." : player.name;
        const playtime = player.playtime || "Baru";
        
        table += `\`${noCenter}\` ${signal} \`${idCenter}\` **${name}** ⏱️ ${playtime}\n`;
        
        if (table.length > 900) break;
    }
    
    return { table, totalPages };
}

// ============ MEMBUAT TABEL HASIL PENCARIAN (Dengan Playtime) ============
function createSearchTable(players, page = 1, itemsPerPage = 20) {
    if (!players || players.length === 0) return { table: "Tidak ada hasil", totalPages: 1 };
    
    const totalPages = Math.ceil(players.length / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, players.length);
    const pagePlayers = players.slice(startIndex, endIndex);
    
    let table = "";
    for (const player of pagePlayers) {
        const no = player.no.toString();
        const noCenter = no.padStart(2, ' ').padEnd(3, ' ');
        const signal = getSignalSymbol(player.ping);
        const id = player.id.toString();
        const idCenter = id.padStart(3, ' ').padEnd(4, ' ');
        const name = player.name.length > 32 ? player.name.substring(0, 29) + "..." : player.name;
        const playtime = player.playtime || "Baru";
        
        table += `\`${noCenter}\` ${signal} \`${idCenter}\` **${name}** ⏱️ ${playtime}\n`;
        
        if (table.length > 900) break;
    }
    
    if (table.length > 900) {
        table += `\n*... dan seterusnya*`;
    }
    
    return { table, totalPages };
}

// ============ PROGRESS BAR ============
function createProgressBar(current, max, length = 15) {
    const percentage = current / max;
    const filled = Math.round(length * percentage);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// ============ BUTTON PAGINATION ============
function createPaginationButtons(page, totalPages, serverId, type = "all") {
    if (totalPages <= 1) return null;
    
    const row = new ActionRowBuilder();
    
    if (page > 1) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${type}_prev_${serverId}_${page}`)
                .setLabel('◀ Sebelumnya')
                .setStyle(ButtonStyle.Primary)
        );
    }
    
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`${type}_page_${serverId}_${page}`)
            .setLabel(`${page}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );
    
    if (page < totalPages) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${type}_next_${serverId}_${page}`)
                .setLabel('Selanjutnya ▶')
                .setStyle(ButtonStyle.Primary)
        );
    }
    
    return row;
}

// ============ REGISTER COMMANDS ============
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} siap beraksi!`);
    console.log(`📡 ${serverDatabase.length} server terdaftar`);
    
    client.user.setPresence({
        status: 'online',
        activities: [{
            name: 'Track Your Player',
            type: 3
        }]
    });
    
    const commands = [
        new SlashCommandBuilder()
            .setName('playerall')
            .setDescription('Tampilkan semua pemain online di server')
            .addStringOption(option =>
                option.setName('server')
                    .setDescription('Pilih server')
                    .setRequired(true)
                    .addChoices(...serverDatabase.map(s => ({ name: s.name, value: s.id })))
            ),
        new SlashCommandBuilder()
            .setName('player')
            .setDescription('Cari pemain berdasarkan nama')
            .addStringOption(option =>
                option.setName('server')
                    .setDescription('Pilih server')
                    .setRequired(true)
                    .addChoices(...serverDatabase.map(s => ({ name: s.name, value: s.id })))
            )
            .addStringOption(option =>
                option.setName('nama')
                    .setDescription('Nama pemain')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('playerid')
            .setDescription('Cari pemain berdasarkan ID')
            .addStringOption(option =>
                option.setName('server')
                    .setDescription('Pilih server')
                    .setRequired(true)
                    .addChoices(...serverDatabase.map(s => ({ name: s.name, value: s.id })))
            )
            .addIntegerOption(option =>
                option.setName('id')
                    .setDescription('ID pemain')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('server')
            .setDescription('Lihat daftar server yang tersedia')
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('📡 Mendaftarkan command...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(cmd => cmd.toJSON()) });
        console.log('✅ Command siap digunakan!');
    } catch (error) {
        console.error(error);
    }
});

// ============ HANDLE COMMANDS ============
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // ========== /server ==========
    if (interaction.commandName === 'server') {
        let serverList = "";
        serverDatabase.forEach((server, idx) => {
            serverList += `**${idx+1}. ${server.name}** — ${server.description}\n`;
        });
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Server Directory')
            .setDescription(serverList)
            .setColor(0x2B2D31)
            .setFooter({ text: `✨ Gunakan /playerall <server> untuk melihat pemain` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        return;
    }

    // ========== /playerall ==========
    if (interaction.commandName === 'playerall') {
        await interaction.deferReply();
        
        const serverId = interaction.options.getString('server');
        const server = serverDatabase.find(s => s.id === serverId);
        
        if (!server) {
            await interaction.editReply('❌ Server tidak ditemukan');
            return;
        }
        
        const data = await getServerInfo(server);
        
        if (!data.online) {
            const offlineEmbed = new EmbedBuilder()
                .setTitle(`🔴 ${server.name}`)
                .setDescription('❌ Server sedang offline atau tidak dapat dijangkau')
                .setColor(0xE74C3C)
                .setTimestamp();
            await interaction.editReply({ embeds: [offlineEmbed] });
            return;
        }
        
        if (data.playersList.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setTitle(`🌙 ${data.name}`)
                .setDescription('📭 Server sedang sepi, tidak ada pemain online')
                .setColor(0x3498DB)
                .setTimestamp();
            await interaction.editReply({ embeds: [emptyEmbed] });
            return;
        }
        
        const avgPing = Math.round(data.playersList.reduce((sum, p) => sum + p.ping, 0) / data.playersList.length);
        const occupancy = Math.round((data.players / data.maxPlayers) * 100);
        const bar = createProgressBar(data.players, data.maxPlayers);
        
        const itemsPerPage = 20;
        const { table, totalPages } = createPlayerTable(data.playersList, 1, itemsPerPage);
        
        const connectText = server.connect ? `\n🔌 **Connect:** \`${server.connect}\`` : '';
        const infoText = `📡 **Server:** ${data.name}\n👥 **Online:** ${data.players} / ${data.maxPlayers} Pemain\n📶 **Avg Ping:** ${avgPing}ms\n📊 **Occupancy:** ${bar} ${occupancy}%\n🏷️ **Mode:** ${data.gametype}${connectText}`;
        
        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${data.name} - Tracker`)
            .setDescription(infoText)
            .addFields({ name: '📋 Player Online', value: table })
            .setColor(0x2ECC71)
            .setFooter({ text: `⚡ Data real-time • Track by ${interaction.user.username}` })
            .setTimestamp();
        
        if (server.logo && !server.logo.includes("xxx")) {
            embed.setThumbnail(server.logo);
        }
        
        if (totalPages > 1) {
            const row = createPaginationButtons(1, totalPages, server.id, "all");
            await interaction.editReply({ embeds: [embed], components: [row] });
            
            let currentPage = 1;
            const filter = i => i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
            
            collector.on('collect', async i => {
                if (i.customId.startsWith('all_prev_')) currentPage--;
                else if (i.customId.startsWith('all_next_')) currentPage++;
                else return;
                
                const { table: newTable } = createPlayerTable(data.playersList, currentPage, itemsPerPage);
                const newEmbed = EmbedBuilder.from(embed)
                    .spliceFields(0, 1, { name: '📋 Player Online', value: newTable });
                const newRow = createPaginationButtons(currentPage, totalPages, server.id, "all");
                
                if (newRow) {
                    await i.update({ embeds: [newEmbed], components: [newRow] });
                } else {
                    await i.update({ embeds: [newEmbed], components: [] });
                }
            });
        } else {
            await interaction.editReply({ embeds: [embed] });
        }
        return;
    }
    
    // ========== /player ==========
    if (interaction.commandName === 'player') {
        await interaction.deferReply();
        
        const serverId = interaction.options.getString('server');
        const searchName = interaction.options.getString('nama').toLowerCase();
        const server = serverDatabase.find(s => s.id === serverId);
        
        if (!server) {
            await interaction.editReply('❌ Server tidak ditemukan');
            return;
        }
        
        const data = await getServerInfo(server);
        
        if (!data.online) {
            await interaction.editReply(`❌ Server **${server.name}** sedang offline`);
            return;
        }
        
        const matchedPlayers = data.playersList.filter(p => 
            p.name.toLowerCase().includes(searchName)
        );
        
        if (matchedPlayers.length === 0) {
            await interaction.editReply(`❌ Tidak ditemukan pemain dengan nama **"${searchName}"** di **${server.name}**`);
            return;
        }
        
        const avgPing = Math.round(matchedPlayers.reduce((sum, p) => sum + p.ping, 0) / matchedPlayers.length);
        const itemsPerPage = 10;
        const { table, totalPages } = createSearchTable(matchedPlayers, 1, itemsPerPage);
        
        const boldCount = `**${matchedPlayers.length}**`;
        const boldQuery = `**${searchName}**`;
        const connectText = server.connect ? `\n🔌 **Connect:** \`${server.connect}\`` : '';
        const infoText = `🔍 **Query:** ${boldQuery}\n📡 **Server:** ${data.name}\n👥 **Online:** ${data.players} Pemain\n📊 **Hasil:** Ditemukan ${boldCount} ${boldQuery}\n📶 **Avg Ping:** ${avgPing}ms${connectText}`;
        
        const embed = new EmbedBuilder()
            .setTitle(`🔍 ${data.name} - Tracker`)
            .setDescription(infoText)
            .addFields({ name: '📋 Hasil Pencarian', value: table })
            .setColor(0x9B59B6)
            .setFooter({ text: `✨ Requested by ${interaction.user.username}` })
            .setTimestamp();
        
        if (server.logo && !server.logo.includes("xxx")) {
            embed.setThumbnail(server.logo);
        }
        
        if (totalPages > 1) {
            const row = createPaginationButtons(1, totalPages, server.id, "search");
            await interaction.editReply({ embeds: [embed], components: [row] });
            
            let currentPage = 1;
            const filter = i => i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
            
            collector.on('collect', async i => {
                if (i.customId.startsWith('search_prev_')) currentPage--;
                else if (i.customId.startsWith('search_next_')) currentPage++;
                else return;
                
                const { table: newTable } = createSearchTable(matchedPlayers, currentPage, itemsPerPage);
                const newEmbed = EmbedBuilder.from(embed)
                    .spliceFields(0, 1, { name: '📋 Hasil Pencarian', value: newTable });
                const newRow = createPaginationButtons(currentPage, totalPages, server.id, "search");
                
                if (newRow) {
                    await i.update({ embeds: [newEmbed], components: [newRow] });
                } else {
                    await i.update({ embeds: [newEmbed], components: [] });
                }
            });
        } else {
            await interaction.editReply({ embeds: [embed] });
        }
        return;
    }
    
    // ========== /playerid ==========
    if (interaction.commandName === 'playerid') {
        await interaction.deferReply();
        
        const serverId = interaction.options.getString('server');
        const searchId = interaction.options.getInteger('id');
        const server = serverDatabase.find(s => s.id === serverId);
        
        if (!server) {
            await interaction.editReply('❌ Server tidak ditemukan');
            return;
        }
        
        await interaction.editReply(`🔍 Mencari ID **${searchId}** di **${server.name}**...`);
        
        const data = await getServerInfo(server);
        
        if (!data.online) {
            await interaction.editReply(`❌ Server **${server.name}** sedang offline`);
            return;
        }
        
        const player = data.playersList.find(p => p.id === searchId);
        
        if (!player) {
            await interaction.editReply(`❌ Tidak ditemukan pemain dengan ID **${searchId}** di **${server.name}**`);
            return;
        }
        
        const signal = getSignalSymbol(player.ping);
        const connectText = server.connect ? `\n🔌 **Connect:** \`${server.connect}\`` : '';
        
        const embed = new EmbedBuilder()
            .setTitle(`👤 Player Detail`)
            .setDescription(`${signal} **${player.name}**\n🆔 **ID:** ${player.id}\n📶 **Ping:** ${player.ping}ms\n⏱️ **Playtime:** ${player.playtime || "Baru"}${connectText}`)
            .setColor(0x2ECC71)
            .setFooter({ text: `⚡ Data real-time • ${data.name}` })
            .setTimestamp();
        
        if (server.logo && !server.logo.includes("xxx")) {
            embed.setThumbnail(server.logo);
        }
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }
});

client.login(process.env.TOKEN);
