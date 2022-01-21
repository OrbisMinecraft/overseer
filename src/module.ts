import {SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder} from "@discordjs/builders";
import {Client, CommandInteraction, MessageComponentInteraction} from "discord.js";
import {Pool} from "pg";

export interface Command {
    definition: Partial<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>,
    execute: (interaction: CommandInteraction) => Promise<void>;
}

export interface Component {
    customId: string,
    handle: (interaction: MessageComponentInteraction) => Promise<void>;
}

export abstract class Module {
    readonly commands: Command[] = [];
    readonly components: Component[] = []

    public abstract onInit(client: Client, db: Pool): Promise<void>;

    protected onCommand(definition: Partial<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>, execute: (interaction: CommandInteraction) => Promise<void>) {
        this.commands.push({
            definition: definition,
            execute: execute
        })
    }

    protected onComponent(customId: string, handle: (interaction: MessageComponentInteraction) => Promise<void>) {
        this.components.push({
            customId: customId,
            handle: handle
        })
    }
}