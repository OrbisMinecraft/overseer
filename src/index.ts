import {Client, CommandInteraction, Intents, MessageComponentInteraction} from "discord.js";
import {config, modules} from "./config";
import {internalErrorReply} from "./common/replies";
import {postgres} from "./database";

const client = new Client({intents: [Intents.FLAGS.GUILDS]});

const commands = new Map<string, (i: CommandInteraction) => Promise<void>>();
const components = new Map<string, (i: MessageComponentInteraction) => Promise<void>>();

client.once('ready', async () => {
    console.log('Ready!');

    for (const mod of modules) {
        for (const cmd of mod.commands) {
            commands.set(cmd.definition.name!!, cmd.execute.bind(mod));
        }

        for (const cmd of mod.components) {
            components.set(cmd.customId!!, cmd.handle.bind(mod));
        }

        await mod.onInit(client, postgres);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const handler = commands.get(interaction.commandName);

        if (handler !== undefined) {
            try {
                await handler(interaction);
            } catch (e) {
                console.error(e);
                await interaction.editReply(internalErrorReply());
            }
        }
    } else if (interaction.isMessageComponent()) {
        let idx : number | undefined = interaction.customId.indexOf('/');

        if (idx == -1) {
            idx = undefined;
        }

        const handler = components.get(interaction.customId.substring(0, idx));

        if (handler !== undefined) {
            await handler(interaction);
        }
    }
})

client.login(config.token);
