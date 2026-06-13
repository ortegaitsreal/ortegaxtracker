// index.js - Bot FiveM Player Tracker (Konsisten Format)
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ============ DATABASE SERVER ============
const serverDatabase = [
    {
        id: "cerita",
        name: "CR ROLEPLAY 2.0",
        ip: "103.42.116.42",
        port: 30120,
        maxPlayers: 1000,
        logo: "https://cdn.discordapp.com/attachments/1373778515098468382/1485635560537325670/CR.png",
        description: "Your Roleplay Home with a New Experience 2.0",
        connect: "connect play.ceritaroleplayku.id"
    },
    {
        id: "kotakita",
        name: "KOTAKITA ROLEPLAY INDONESIA",
        ip: "31.58.143.101",
        port: 30120,
        maxPlayers: 2048,
        logo: "https://media.discordapp.net/attachments/832162287380725770/1423173258215297034/KOTAKITA.1.png",
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

// ============ CACHE SYSTEM ============
const cache = new Map();
const CACHE_DURATION = 15000;

// ============ CUSTOM EMOJI SIGNAL ============
const SIGNAL_HIJAU = '<:EG:1515433046084550728>';
const SIGNAL_KUNING = '<:EY:1515433024043483206>';
const SIGNAL_ORANGE = '<:EO:1515432999506935981>';
const SIGNAL_RED = '<:ER:1515432975922102324>';

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

// ============ AMBIL DATA SERVER ============
async function getServerInfo(server) {
    const baseUrl = `http://${server.ip}:${server.port}`;
    
    try {
        const promises = [
            fetchWithTimeout(`${baseUrl}/info.json`, 8000).catch(() => null),
            fetchWithTimeout(`${baseUrl}/players.json`, 8000).catch(() => null)
        ];
        
        const results = await Promise.all(promises);
        let infoRes = results[0];
        let playersRes = results[1];

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
            
            serverData.playersList = players.map((p, idx) => ({ 
                no: idx + 1,
                id: p.id || idx + 1,
                name: (p.name || 'Unknown').replace(/`/g, '').replace(/\|/g, ''),
                ping: p.ping || 0
            }));
            
            serverData.playersList.sort((a, b) => a.id - b.id);
            serverData.playersList.forEach((p, idx) => p.no = idx + 1);
        }

        return serverData;
    } catch (error) {
        return { ...server, online: false, players: 0, maxPlayers: server.maxPlayers, playersList: [] };
    }
}

// ============ GET SERVER INFO DENGAN CACHE ============
async function getServerInfoWithCache(server) {
    const cacheKey = server.id;
    const now = Date.now();
    
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (now - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
    }
    
    const data = await getServerInfo(server);
    cache.set(cacheKey, { data, timestamp: now });
    return data;
}

// ============ PARSING MULTIPLE ID ============
function parseIdInput(input) {
    const ids = new Set();
    const parts = input.split(',');
    
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
            const range = trimmed.split('-');
            const start = parseInt(range[0]);
            const end = parseInt(range[1]);
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                    ids.add(i);
                }
            }
        } else {
            const num = parseInt(trimmed);
            if (!isNaN(num)) {
                ids.add(num);
            }
        }
    }
    
    return Array.from(ids).sort((a, b) => a - b);
}

// ============ MEMBUAT TABEL PLAYER DENGAN MULTIPLE FIELDS ============
function createPlayerTableFields(players, page = 1, itemsPerPage = 30) {
    if (!players || players.length === 0) return { fields: [], totalPages: 1 };
    
    const totalPages = Math.ceil(players.length / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, players.length);
    const pagePlayers = players.slice(startIndex, endIndex);
    
    let currentField = "";
    let fields = [];
    let fieldIndex = 1;
    
    for (const player of pagePlayers) {
        const no = player.no.toString().padStart(2, ' ').padEnd(3, ' ');
        const signal = getSignalSymbol(player.ping);
        const id = player.id.toString().padStart(3, ' ').padEnd(4, ' ');
        const name = player.name.length > 35 ? player.name.substring(0, 32) + "..." : player.name;
        
        const line = `\`${no}\` ${signal} \`${id}\` **${name}**\n`;
        
        if ((currentField + line).length > 980 && currentField.length > 0) {
            fields.push({ name: `📋 Player List (${fieldIndex})`, value: currentField, inline: false });
            currentField = line;
            fieldIndex++;
        } else {
            currentField += line;
        }
    }
    
    if (currentField.length > 0) {
        fields.push({ name: `📋 Player List (${fieldIndex})`, value: currentField, inline: false });
    }
    
    return { fields, totalPages };
}

// ============ MEMBUAT TABEL UNTUK MULTIPLE PLAYER ============
function createMultiplePlayerTable(players) {
    if (!players || players.length === 0) return "`Tidak ada pemain ditemukan`";
    
    let table = "";
    for (const player of players) {
        const no = player.no.toString().padStart(2, ' ').padEnd(3, ' ');
        const signal = getSignalSymbol(player.ping);
        const id = player.id.toString().padStart(3, ' ').padEnd(4, ' ');
        const name = player.name;
        
        table += `\`${no}\` ${signal} \`${id}\` **${name}**\n`;
    }
    
    return table;
}

// ============ MEMBUAT EMBED UNTUK KONDISI TIDAK DITEMUKAN ============
function createNotFoundEmbed(title, description, serverLogo = null) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .addFields({ name: '📋 Hasil Pencarian', value: '`Tidak ada data yang ditemukan`' })
        .setColor(0xE74C3C)
        .setFooter({ text: `⚡ Track by FiveM Tracker` })
        .setTimestamp();
    
    if (serverLogo) embed.setThumbnail(serverLogo);
    return embed;
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
    if (page > 1) row.addComponents(new ButtonBuilder().setCustomId(`${type}_prev_${serverId}_${page}`).setLabel('◀ Sebelumnya').setStyle(ButtonStyle.Primary));
    row.addComponents(new ButtonBuilder().setCustomId(`${type}_page_${serverId}_${page}`).setLabel(`${page}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true));
    if (page < totalPages) row.addComponents(new ButtonBuilder().setCustomId(`${type}_next_${serverId}_${page}`).setLabel('Selanjutnya ▶').setStyle(ButtonStyle.Primary));
    return row;
}

// ============ REGISTER COMMANDS ============
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} siap beraksi!`);
    console.log(`📡 ${serverDatabase.length} server terdaftar`);
    console.log(`⚡ Cache duration: ${CACHE_DURATION / 1000} detik`);
    console.log(`📋 Menampilkan 30 player per halaman`);
    console.log(`🔍 Multiple ID support: 1,2,3 atau 1-10 atau 1,3-5,10`);
    
    client.user.setActivity('Track Your Player', { type: 3 });
    
    const commands = [
        new SlashCommandBuilder().setName('playerall').setDescription('Tampilkan semua pemain online di server')
            .addStringOption(option => option.setName('server').setDescription('Pilih server').setRequired(true)
                .addChoices(...serverDatabase.map(s => ({ name: s.name, value: s.id })))),
        new SlashCommandBuilder().setName('player').setDescription('Cari pemain berdasarkan nama')
            .addStringOption(option => option.setName('server').setDescription('Pilih server').setRequired(true)
                .addChoices(...serverDatabase.map(s => ({ name: s.name, value: s.id }))))
            .addStringOption(option => option.setName('nama').setDescription('Nama pemain').setRequired(true)),
        new SlashCommandBuilder().setName('playerid').setDescription('Cari pemain berdasarkan ID (support multiple: 1,2,3 atau 1-10)')
            .addStringOption(option => option.setName('server').setDescription('Pilih server').setRequired(true)
                .addChoices(...serverDatabase.map(s => ({ name: s.name, value: s.id }))))
            .addStringOption(option => option.setName('id').setDescription('ID pemain (contoh: 972 atau 1,2,3 atau 1-10)').setRequired(true)),
        new SlashCommandBuilder().setName('server').setDescription('Lihat daftar server yang tersedia')
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(cmd => cmd.toJSON()) });
        console.log('✅ Command siap digunakan!');
    } catch (error) {
        console.error(error);
    }
});

// ============ HANDLE COMMANDS ============
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // ============ /server ============
    if (interaction.commandName === 'server') {
        let serverList = "";
        serverDatabase.forEach((s, idx) => {
            serverList += `**${idx+1}. ${s.name}** — ${s.description}\n`;
        });
        const embed = new EmbedBuilder().setTitle('📋 Server Directory').setDescription(serverList).setColor(0x2B2D31).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
    }

    // ============ /playerall ============
    if (interaction.commandName === 'playerall') {
        await interaction.deferReply();
        const server = serverDatabase.find(s => s.id === interaction.options.getString('server'));
        if (!server) return await interaction.editReply('❌ Server tidak ditemukan');
        
        const startTime = Date.now();
        const data = await getServerInfoWithCache(server);
        const fetchTime = Date.now() - startTime;
        
        if (!data.online) {
            const embed = createNotFoundEmbed(`🔴 ${data.name} - Tracker`, `❌ **Server offline**\n\nTidak dapat terhubung ke server.`, server.logo);
            return await interaction.editReply({ embeds: [embed] });
        }
        
        if (data.playersList.length === 0) {
            const embed = createNotFoundEmbed(`🌙 ${data.name} - Tracker`, `📭 **Server sepi**\n\nTidak ada pemain yang sedang online.`, server.logo);
            return await interaction.editReply({ embeds: [embed] });
        }
        
        const avgPing = Math.round(data.playersList.reduce((sum, p) => sum + p.ping, 0) / data.playersList.length);
        const occupancy = Math.round((data.players / data.maxPlayers) * 100);
        const bar = createProgressBar(data.players, data.maxPlayers);
        const { fields, totalPages } = createPlayerTableFields(data.playersList, 1, 30);
        
        const connectText = server.connect ? `\n🔌 **Connect:**\n\`\`\`\n${server.connect}\n\`\`\`` : '';
        
        const embed = new EmbedBuilder()
            .setTitle(`${data.name} - Tracker`)
            .setDescription(`👥 **Online:** ${data.players}/${data.maxPlayers}\n📊 **Occupancy:** ${bar} ${occupancy}%\n${SIGNAL_HIJAU} **Avg Ping:** ${avgPing}ms\n⚡ **Response:** ${fetchTime}ms${connectText}`)
            .setColor(0x2ECC71)
            .setFooter({ text: `⚡ Track by ${interaction.user.username}` })
            .setTimestamp();
        
        if (server.logo) embed.setThumbnail(server.logo);
        
        for (const field of fields) {
            embed.addFields(field);
        }
        
        if (totalPages > 1) {
            const row = createPaginationButtons(1, totalPages, server.id, "all");
            await interaction.editReply({ embeds: [embed], components: [row] });
            
            let currentPage = 1;
            const collector = interaction.channel.createMessageComponentCollector({ 
                filter: i => i.user.id === interaction.user.id, 
                time: 60000 
            });
            
            collector.on('collect', async i => {
                if (i.customId.startsWith('all_prev_')) currentPage--;
                else if (i.customId.startsWith('all_next_')) currentPage++;
                else return;
                
                const { fields: newFields } = createPlayerTableFields(data.playersList, currentPage, 30);
                const newEmbed = EmbedBuilder.from(embed);
                
                newEmbed.spliceFields(0, embed.data.fields?.length || 0);
                for (const field of newFields) {
                    newEmbed.addFields(field);
                }
                
                await i.update({ embeds: [newEmbed], components: [createPaginationButtons(currentPage, totalPages, server.id, "all")] });
            });
        } else {
            await interaction.editReply({ embeds: [embed] });
        }
        return;
    }
    
    // ============ /player ============
    if (interaction.commandName === 'player') {
        await interaction.deferReply();
        const server = serverDatabase.find(s => s.id === interaction.options.getString('server'));
        const searchName = interaction.options.getString('nama').toLowerCase();
        if (!server) return await interaction.editReply('❌ Server tidak ditemukan');
        
        const data = await getServerInfoWithCache(server);
        if (!data.online) {
            const embed = createNotFoundEmbed(`${data.name} - Tracker`, `❌ **Server offline**\n\nTidak dapat mencari "${searchName}" karena server offline.`, server.logo);
            return await interaction.editReply({ embeds: [embed] });
        }
        
        const matchedPlayers = data.playersList.filter(p => p.name.toLowerCase().includes(searchName));
        
        if (matchedPlayers.length === 0) {
            const queryUpperCase = searchName.toUpperCase();
            const embed = createNotFoundEmbed(`${data.name} - Tracker`, `🔍 **Query:** ${searchName}\n👥 **Online:** ${data.players} Pemain\n📊 **Hasil:** ditemukan **0** **${queryUpperCase}**\n${SIGNAL_HIJAU} **Avg Ping:** - ms`, server.logo);
            return await interaction.editReply({ embeds: [embed] });
        }
        
        const avgPing = Math.round(matchedPlayers.reduce((sum, p) => sum + p.ping, 0) / matchedPlayers.length);
        const { fields } = createPlayerTableFields(matchedPlayers, 1, 30);
        
        const connectText = server.connect ? `\n🔌 **Connect:**\n\`\`\`\n${server.connect}\n\`\`\`` : '';
        
        const queryUpperCase = searchName.toUpperCase();
        
        const embed = new EmbedBuilder()
            .setTitle(`${data.name} - Tracker`)
            .setDescription(`🔍 **Query:** ${searchName}\n👥 **Online:** ${data.players} Pemain\n📊 **Hasil:** ditemukan **${matchedPlayers.length}** **${queryUpperCase}**\n${SIGNAL_HIJAU} **Avg Ping:** ${avgPing}ms${connectText}`)
            .setColor(0x9B59B6)
            .setFooter({ text: `✨ Requested by ${interaction.user.username}` })
            .setTimestamp();
        
        if (server.logo) embed.setThumbnail(server.logo);
        
        for (const field of fields) {
            embed.addFields(field);
        }
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }
    
    // ============ /playerid ============
    if (interaction.commandName === 'playerid') {
        await interaction.deferReply();
        const server = serverDatabase.find(s => s.id === interaction.options.getString('server'));
        const idInput = interaction.options.getString('id');
        if (!server) return await interaction.editReply('❌ Server tidak ditemukan');
        
        const data = await getServerInfoWithCache(server);
        if (!data.online) {
            const embed = createNotFoundEmbed(`🎮 ${data.name} - Player ID Tracker`, `❌ **Server offline**\n\nTidak dapat mencari ID "${idInput}" karena server offline.`, server.logo);
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Parse multiple ID input
        const searchIds = parseIdInput(idInput);
        
        if (searchIds.length === 0) {
            const embed = createNotFoundEmbed(`🎮 ${data.name} - Player ID Tracker`, `❌ **Format ID tidak valid**\n\nGunakan format: 972 atau 1,2,3 atau 1-10`, server.logo);
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Cari player berdasarkan ID
        const foundPlayers = [];
        const notFoundIds = [];
        
        for (const id of searchIds) {
            const player = data.playersList.find(p => p.id === id);
            if (player) {
                foundPlayers.push(player);
            } else {
                notFoundIds.push(id);
            }
        }
        
        const avgPing = Math.round(data.playersList.reduce((sum, p) => sum + p.ping, 0) / data.playersList.length);
        const connectText = server.connect ? `\n🔌 **Connect:**\n\`\`\`\n${server.connect}\n\`\`\`` : '';
        
        let description = `👥 **Online:** ${data.players}/${data.maxPlayers}\n`;
        description += `🔍 **Cari ID:** ${idInput}\n`;
        description += `📊 **Ditemukan:** ${foundPlayers.length} dari ${searchIds.length} ID\n`;
        description += `${SIGNAL_HIJAU} **Avg Ping:** ${avgPing}ms${connectText}`;
        
        if (notFoundIds.length > 0) {
            description += `\n\n⚠️ **ID Tidak Ditemukan:** ${notFoundIds.join(', ')}`;
        }
        
        const table = createMultiplePlayerTable(foundPlayers);
        
        const embed = new EmbedBuilder()
            .setTitle(`${data.name} - Player ID Tracker`)
            .setDescription(description)
            .addFields({ name: '🎯 Player Ditemukan', value: table })
            .setColor(foundPlayers.length > 0 ? 0x2ECC71 : 0xE74C3C)
            .setFooter({ text: `⚡ Track by ${interaction.user.username}` })
            .setTimestamp();
        
        if (server.logo) embed.setThumbnail(server.logo);
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }
});

client.login(process.env.TOKEN);
