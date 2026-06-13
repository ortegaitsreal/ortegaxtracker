// index.js - Bot FiveM Player Tracker (Dengan Code Block untuk Copy)
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
        description: "Server RP Indonesia terpopuler",
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

// ============ HAPUS DATABASE LAMA ============
const fs = require('fs');
if (fs.existsSync('./data')) {
    fs.rmSync('./data', { recursive: true, force: true });
    console.log('🗑️ Database playtime dihapus!');
}

// ============ CUSTOM EMOJI SIGNAL ============
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

// ============ MEMBUAT TABEL PLAYER ============
function createPlayerTable(players, page = 1, itemsPerPage = 20) {
    if (!players || players.length === 0) return { table: "Tidak ada pemain online", totalPages: 1 };
    
    const totalPages = Math.ceil(players.length / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, players.length);
    const pagePlayers = players.slice(startIndex, endIndex);
    
    let table = "";
    for (const player of pagePlayers) {
        const no = player.no.toString().padStart(2, ' ').padEnd(3, ' ');
        const signal = getSignalSymbol(player.ping);
        const id = player.id.toString().padStart(3, ' ').padEnd(4, ' ');
        const name = player.name.length > 32 ? player.name.substring(0, 29) + "..." : player.name;
        
        table += `\`${no}\` ${signal} \`${id}\` **${name}**\n`;
        if (table.length > 900) break;
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
    if (page > 1) row.addComponents(new ButtonBuilder().setCustomId(`${type}_prev_${serverId}_${page}`).setLabel('◀ Sebelumnya').setStyle(ButtonStyle.Primary));
    row.addComponents(new ButtonBuilder().setCustomId(`${type}_page_${serverId}_${page}`).setLabel(`${page}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true));
    if (page < totalPages) row.addComponents(new ButtonBuilder().setCustomId(`${type}_next_${serverId}_${page}`).setLabel('Selanjutnya ▶').setStyle(ButtonStyle.Primary));
    return row;
}

// ============ REGISTER COMMANDS ============
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} siap beraksi!`);
    console.log(`📡 ${serverDatabase.length} server terdaftar`);
    
    client.user.setActivity('Track Your Player', { type: 3 });
    
    const commands = [
        new SlashCommandBuilder().setName('playerall').setDescription('Tampilkan semua pemain online di server')
            .addStringOption(option => option.setName('server').setDescription('Pilih server').setRequired(true)
                .addChoices(...serverDatabase.map(s => ({ name: s.name, value: s.id })))),
        new SlashCommandBuilder().setName('player').setDescription('Cari pemain berdasarkan nama')
            .addStringOption(option => option.setName('server').setDescription('Pilih server').setRequired(true)
                .addChoices(...serverDatabase.map(s => ({ name: s.name, value: s.id }))))
            .addStringOption(option => option.setName('nama').setDescription('Nama pemain').setRequired(true)),
        new SlashCommandBuilder().setName('playerid').setDescription('Cari pemain berdasarkan ID')
            .addStringOption(option => option.setName('server').setDescription('Pilih server').setRequired(true)
                .addChoices(...serverDatabase.map(s => ({ name: s.name, value: s.id }))))
            .addIntegerOption(option => option.setName('id').setDescription('ID pemain').setRequired(true)),
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

    // /server
    if (interaction.commandName === 'server') {
        let serverList = "";
        serverDatabase.forEach((s, idx) => {
            serverList += `**${idx+1}. ${s.name}** — ${s.description}\n`;
        });
        const embed = new EmbedBuilder().setTitle('📋 Server Directory').setDescription(serverList).setColor(0x2B2D31).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
    }

    // /playerall
    if (interaction.commandName === 'playerall') {
        await interaction.deferReply();
        const server = serverDatabase.find(s => s.id === interaction.options.getString('server'));
        if (!server) return await interaction.editReply('❌ Server tidak ditemukan');
        
        const data = await getServerInfo(server);
        if (!data.online) return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🔴 ${server.name}`).setDescription('❌ Server offline').setColor(0xE74C3C)] });
        if (data.playersList.length === 0) return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🌙 ${data.name}`).setDescription('📭 Server sepi').setColor(0x3498DB)] });
        
        const avgPing = Math.round(data.playersList.reduce((sum, p) => sum + p.ping, 0) / data.playersList.length);
        const occupancy = Math.round((data.players / data.maxPlayers) * 100);
        const bar = createProgressBar(data.players, data.maxPlayers);
        const { table, totalPages } = createPlayerTable(data.playersList, 1, 20);
        
        // ============ CONNECT CODE DENGAN CODE BLOCK (MUDAH COPY) ============
        const connectText = server.connect ? `\n🔌 **Connect:**\n\`\`\`\n${server.connect}\n\`\`\`` : '';
        
        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${data.name} - Tracker`)
            .setDescription(`📡 **Server:** ${data.name}\n👥 **Online:** ${data.players}/${data.maxPlayers}\n📶 **Avg Ping:** ${avgPing}ms\n📊 **Occupancy:** ${bar} ${occupancy}%\n🏷️ **Mode:** ${data.gametype}${connectText}`)
            .addFields({ name: 'Player Online', value: table })
            .setColor(0x2ECC71).setFooter({ text: `⚡ Track by ${interaction.user.username}` }).setTimestamp();
        if (server.logo) embed.setThumbnail(server.logo);
        
        if (totalPages > 1) {
            const row = createPaginationButtons(1, totalPages, server.id, "all");
            await interaction.editReply({ embeds: [embed], components: [row] });
            let currentPage = 1;
            const collector = interaction.channel.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });
            collector.on('collect', async i => {
                if (i.customId.startsWith('all_prev_')) currentPage--;
                else if (i.customId.startsWith('all_next_')) currentPage++;
                else return;
                const { table: newTable } = createPlayerTable(data.playersList, currentPage, 20);
                const newEmbed = EmbedBuilder.from(embed).spliceFields(0, 1, { name: 'Player Online', value: newTable });
                await i.update({ embeds: [newEmbed], components: [createPaginationButtons(currentPage, totalPages, server.id, "all")] });
            });
        } else {
            await interaction.editReply({ embeds: [embed] });
        }
        return;
    }
    
    // /player
    if (interaction.commandName === 'player') {
        await interaction.deferReply();
        const server = serverDatabase.find(s => s.id === interaction.options.getString('server'));
        const searchName = interaction.options.getString('nama').toLowerCase();
        if (!server) return await interaction.editReply('❌ Server tidak ditemukan');
        
        const data = await getServerInfo(server);
        if (!data.online) return await interaction.editReply(`❌ Server **${server.name}** offline`);
        
        const matchedPlayers = data.playersList.filter(p => p.name.toLowerCase().includes(searchName));
        if (matchedPlayers.length === 0) return await interaction.editReply(`❌ Tidak ditemukan "${searchName}" di **${server.name}**`);
        
        const avgPing = Math.round(matchedPlayers.reduce((sum, p) => sum + p.ping, 0) / matchedPlayers.length);
        const { table } = createPlayerTable(matchedPlayers, 1, 10);
        
        // ============ CONNECT CODE DENGAN CODE BLOCK ============
        const connectText = server.connect ? `\n🔌 **Connect:**\n\`\`\`\n${server.connect}\n\`\`\`` : '';
        
        const embed = new EmbedBuilder()
            .setTitle(`🔍 ${data.name} - Tracker`)
            .setDescription(`🔍 **Query:** **${searchName}**\n📡 **Server:** ${data.name}\n👥 **Online:** ${data.players} Pemain\n📊 **Hasil:** **${matchedPlayers.length}** ditemukan\n📶 **Avg Ping:** ${avgPing}ms${connectText}`)
            .addFields({ name: '📋 Hasil Pencarian', value: table })
            .setColor(0x9B59B6).setFooter({ text: `✨ Requested by ${interaction.user.username}` }).setTimestamp();
        if (server.logo) embed.setThumbnail(server.logo);
        await interaction.editReply({ embeds: [embed] });
        return;
    }
    
    // /playerid
    if (interaction.commandName === 'playerid') {
        await interaction.deferReply();
        const server = serverDatabase.find(s => s.id === interaction.options.getString('server'));
        const searchId = interaction.options.getInteger('id');
        if (!server) return await interaction.editReply('❌ Server tidak ditemukan');
        
        const data = await getServerInfo(server);
        if (!data.online) return await interaction.editReply(`❌ Server **${server.name}** offline`);
        
        const player = data.playersList.find(p => p.id === searchId);
        if (!player) return await interaction.editReply(`❌ Tidak ditemukan ID **${searchId}** di **${server.name}**`);
        
        // ============ CONNECT CODE DENGAN CODE BLOCK ============
        const connectText = server.connect ? `\n🔌 **Connect:**\n\`\`\`\n${server.connect}\n\`\`\`` : '';
        
        const embed = new EmbedBuilder()
            .setTitle(`👤 Player Detail`)
            .setDescription(`${getSignalSymbol(player.ping)} **${player.name}**\n🆔 **ID:** ${player.id}\n📶 **Ping:** ${player.ping}ms${connectText}`)
            .setColor(0x2ECC71).setFooter({ text: `⚡ Data real-time • ${data.name}` }).setTimestamp();
        if (server.logo) embed.setThumbnail(server.logo);
        await interaction.editReply({ embeds: [embed] });
        return;
    }
});

client.login(process.env.TOKEN);
