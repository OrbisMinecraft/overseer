import {Module} from "../module";
import {Client} from "discord.js";
import {Pool} from "pg";
import {SlashCommandBuilder} from "@discordjs/builders";

export class TimestampModule extends Module {
    constructor() {
        super();
        this.onCommand(new SlashCommandBuilder()
                .setName('timestamp')
                .setDescription('Get the current UTC timestamp'),
            async interaction => {
                const now = Date.now();
                await interaction.reply({
                    embeds: [{
                        title: 'Timestamp',
                        description: `The current UNIX timestamp is \`${now}ms\`, or in your local time <t:${Math.floor(now/ 1000)}:F>`,
                        timestamp: now
                    }],
                    ephemeral: true
                })
            })
    }

    async onInit(client: Client, db: Pool) {

    }
}