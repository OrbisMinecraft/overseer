import {Module} from "../module";
import {
    Client,
    CommandInteraction,
    GuildMemberRoleManager,
    MessageComponentInteraction,
    TextChannel,
    ThreadChannel
} from "discord.js";
import {Pool} from "pg";
import {SlashCommandBuilder} from "@discordjs/builders";
import {MessageButtonStyles, MessageComponentTypes} from "discord.js/typings/enums";
import {ERROR_COLOR, SUCCESS_COLOR, YELLOW_COLOR} from "../common/replies";


const nukeCommand = new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('A tool for mass-deleting messages.')
    .addIntegerOption(opt => opt
        .setName('count')
        .setDescription('The number of messages to delete')
        .setRequired(true)
        .setMinValue(1)
    )
    .addUserOption(opt => opt
        .setName('user')
        .setDescription('Only delete messages sent by this user.')
        .setRequired(false)
    )

export class NukeModule extends Module {
    constructor(private nukerRoleId: string) {
        super();
        this.onCommand(nukeCommand, this.nuke)
        this.onComponent('nuke::delete', this.yesNukeConfirmed);
        this.onComponent('nuke::cancel', this.noNukeCancelled);
    }

    async onInit(client: Client, db: Pool) {
    }

    async nuke(interaction: CommandInteraction) {
        const count = interaction.options.getInteger('count')!!;
        const user = interaction.options.getUser('user');

        // Check whether the user has the proper permission
        const userRoles = interaction.member?.roles as GuildMemberRoleManager;
        if (!userRoles.cache.has(this.nukerRoleId)) {
            await interaction.editReply({
                embeds: [{
                    title: ':no_entry_sign: Forbidden',
                    description: `You may not use this command.`,
                    color: ERROR_COLOR,
                    timestamp: Date.now()
                }]
            })
            return;
        }

        await interaction.reply({
            embeds: [{
                title: ':warning: Confirmation',
                description: `**Yes, I am 100% sure I want to nuke the last ${count} messages of ${user ? 'user ' + user.username : 'all users'}!**`,
                timestamp: Date.now(),
                color: ERROR_COLOR,
            }],
            components: [{
                type: MessageComponentTypes.ACTION_ROW,
                components: [{
                    type: MessageComponentTypes.BUTTON,
                    style: MessageButtonStyles.DANGER,
                    label: `YES, DELETE THE MESSAGES`,
                    customId: `nuke::delete/${count}:${user ? user.id : ''}`
                }, {
                    type: MessageComponentTypes.BUTTON,
                    style: MessageButtonStyles.PRIMARY,
                    label: 'NO, I\'ve changed my mind',
                    customId: 'nuke::cancel'
                }]
            }],
            ephemeral: true
        });
    }

    async yesNukeConfirmed(interaction: MessageComponentInteraction) {
        const [_, config] = interaction.customId.split('/');
        const countAndUser = config.split(':');
        const count = parseInt(countAndUser[0]);

        let user: string | undefined = undefined;
        if (countAndUser.length == 2) {
            user = countAndUser[1];
        }

        await interaction.update({
            embeds: [{
                title: ':hourglass_flowing_sand: Nuking ...',
                description: `Discovering messages ...`,
                timestamp: Date.now(),
                color: YELLOW_COLOR,
            }],
            components: []
        })

        // find the last `count` messages
        const chan = await interaction.guild?.channels.fetch(interaction.channelId) as TextChannel | ThreadChannel;
        const messages = await chan.messages.fetch({limit: count % 100});

        let lastMsg: string | undefined = messages.at(-1)?.id;
        for (let j = 0; j < Math.floor(count / 100); j++) {
            if (lastMsg != undefined) {
                break;
            }

            messages.concat(await chan.messages.fetch({
                before: lastMsg,
                limit: 100
            }));

            lastMsg = messages.at(-1)?.id;
        }

        let matching = messages;
        if (user) {
            matching = messages.filter(value => value.author.id == user);
        }

        await interaction.editReply({
            embeds: [{
                title: ':hourglass_flowing_sand: Nuking ...',
                description: `Discovered ${matching.size} messages. Deleting ...`,
                timestamp: Date.now(),
                color: YELLOW_COLOR,
            }],
        })

        for (let i = 0; i < matching.size; i++) {
            if (i % 10 == 0) {
                await interaction.editReply({
                    embeds: [{
                        title: ':hourglass_flowing_sand: Nuking ...',
                        description: `Deleted ${i + 1}/${matching.size} ...`,
                        timestamp: Date.now(),
                        color: YELLOW_COLOR,
                    }]
                })
            }

            interaction.channel?.messages.delete(matching.at(i)!!.id);
        }

        await interaction.editReply({
            embeds: [{
                title: ':white_check_mark: Nuking Done',
                description: `${matching.size} messages deleted.`,
                timestamp: Date.now(),
                color: SUCCESS_COLOR,
            }],
        })
    }

    async noNukeCancelled(interaction: MessageComponentInteraction) {
        await interaction.update({
            embeds: [{
                title: ':x: Nuking Cancelled',
                description: 'No messages have been deleted.',
                timestamp: Date.now(),
                color: SUCCESS_COLOR,
            }],
            components: []
        })
    }
}