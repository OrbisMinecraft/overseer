import {Module} from "../module";
import {SlashCommandBuilder} from "@discordjs/builders";
import {Client, CommandInteraction, GuildMemberRoleManager, MessageComponentInteraction, TextChannel} from "discord.js";
import {BLURPLE_COLOR, ERROR_COLOR, SUCCESS_COLOR, YELLOW_COLOR} from "../common/replies";
import assert from "assert";
import {MessageButtonStyles, MessageComponentTypes} from "discord.js/typings/enums";
import {Pool} from "pg";

enum SuggestionStatus {
    OPEN,
    CONSIDERED,
    APPROVED,
    IMPLEMENTED,
    DENIED,
    INVALID,
}

const suggestionStatuses = {
    [SuggestionStatus.OPEN]: {
        name: 'Open',
        color: 0xffffff,
        emoji: ':hourglass_flowing_sand:'
    },
    [SuggestionStatus.CONSIDERED]: {
        name: 'Considered',
        color: BLURPLE_COLOR,
        emoji: ':speech_balloon:'
    },
    [SuggestionStatus.APPROVED]: {
        name: 'Approved',
        color: YELLOW_COLOR,
        emoji: ':white_check_mark:'
    },
    [SuggestionStatus.IMPLEMENTED]: {
        name: 'Implemented',
        color: SUCCESS_COLOR,
        emoji: ':tada:'
    },
    [SuggestionStatus.DENIED]: {
        name: 'Denied',
        color: ERROR_COLOR,
        emoji: ':no_entry_sign:'
    },
    [SuggestionStatus.INVALID]: {
        name: 'Invalid',
        color: 0xaaaaaa,
        emoji: ':grey_question:'
    },
};

const suggestionCommand = new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('Manage suggestions')
    .addSubcommand(sub => sub
        .setName('set-status')
        .setDescription('Set the status of a suggestion')
        .addIntegerOption(opt => opt
            .setName('id')
            .setDescription('The ID of the suggestion')
            .setRequired(true)
        )
        .addIntegerOption(opt => opt
            .setName('status')
            .setDescription('The status to set')
            .setRequired(true)
            .addChoice(suggestionStatuses[SuggestionStatus.OPEN].name, SuggestionStatus.OPEN)
            .addChoice(suggestionStatuses[SuggestionStatus.CONSIDERED].name, SuggestionStatus.CONSIDERED)
            .addChoice(suggestionStatuses[SuggestionStatus.APPROVED].name, SuggestionStatus.APPROVED)
            .addChoice(suggestionStatuses[SuggestionStatus.IMPLEMENTED].name, SuggestionStatus.IMPLEMENTED)
            .addChoice(suggestionStatuses[SuggestionStatus.DENIED].name, SuggestionStatus.DENIED)
            .addChoice(suggestionStatuses[SuggestionStatus.INVALID].name, SuggestionStatus.INVALID)
        )
        .addStringOption(opt => opt
            .setName('message')
            .setDescription('An optional reason for the status change')
            .setRequired(false)
        )
    )
    .addSubcommand(sub => sub
        .setName('create')
        .setDescription('Make a suggestion.')
        .addStringOption(builder => builder
            .setName('title')
            .setDescription('The title of your suggestion')
            .setRequired(true)
        ).addStringOption(builder => builder
            .setName('description')
            .setDescription('A detailed description of the suggestion')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('delete')
        .setDescription('Delete a suggestion.')
        .addIntegerOption(opt => opt
            .setName('id')
            .setDescription('The ID of the suggestion')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('list')
        .setDescription('List open suggestions.')
    )


interface Suggestion {
    id?: number;
    message: string;
    title: string;
    description: string;
    author: string;
    status: number;
    votes_for: number;
    votes_against: number;
    votes: { [key: string]: boolean | undefined };
}

export class SuggestionsModule extends Module {
    private suggestionChannel: TextChannel;
    private db: Pool;

    constructor(private suggestionChannelId: string, private managerRoleId: string) {
        super();
        this.onCommand(suggestionCommand, this.onManage)
        this.onComponent('suggestions::upvote', this.onUpvote)
        this.onComponent('suggestions::downvote', this.onDownvote)
        this.onComponent('suggestions::unvote', this.onRemoveVote)
    }

    public async onInit(client: Client, db: Pool) {
        const chan = await client.channels.fetch(this.suggestionChannelId);
        assert(chan != null);
        assert(chan.isText())

        this.suggestionChannel = chan as TextChannel;
        this.db = db;
    }

    private async byId(id: number): Promise<Suggestion | null> {
        const result = await this.db.query('SELECT * FROM suggestions WHERE id=$1;', [id]);
        if (result.rowCount == 0) return null;
        return result.rows[0];
    }

    private async byMessage(id: string): Promise<Suggestion | null> {
        const result = await this.db.query('SELECT * FROM suggestions WHERE message=$1;', [id]);
        if (result.rowCount == 0) return null;
        return result.rows[0];
    }

    private async onSuggest(interaction: CommandInteraction) {
        const title = interaction.options.getString('title')!!;
        const description = interaction.options.getString('description')!!;

        // Save the suggestion
        const suggestion_id: number = (await this.db.query(
            `INSERT INTO suggestions(title, description, author, status, votes_for, votes_against, votes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`, [
                title,
                description,
                interaction.user.id,
                SuggestionStatus.OPEN,
                1,
                0,
                {[interaction.user.id]: true}
            ])).rows[0].id

        // Post the suggestion
        const status = suggestionStatuses[SuggestionStatus.OPEN];
        const message = await this.suggestionChannel.send({
            embeds: [{
                title: title,
                description: description,
                timestamp: Date.now(),
                fields: [
                    {name: 'Status:', value: `${status.emoji} ${status.name}`, inline: true},
                    {name: 'Upvotes:', value: '1', inline: true},
                    {name: 'Downvotes:', value: '0', inline: true},
                    {name: 'ID:', value: suggestion_id.toString(), inline: false},
                ],
                footer: {
                    text: `by ${interaction.user.username}`,
                    iconURL: interaction.user.avatarURL() || undefined
                },
                color: status.color
            }],
            components: [{
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                    {
                        type: MessageComponentTypes.BUTTON,
                        style: MessageButtonStyles.SUCCESS,
                        label: '👍 Upvote',
                        customId: 'suggestions::upvote'
                    },
                    {
                        type: MessageComponentTypes.BUTTON,
                        style: MessageButtonStyles.DANGER,
                        label: '👎 Downvote',
                        customId: 'suggestions::downvote'
                    },
                    {
                        type: MessageComponentTypes.BUTTON,
                        style: MessageButtonStyles.SECONDARY,
                        label: '🗑 Retract vote',
                        customId: 'suggestions::unvote'
                    },
                ]
            }],
            allowedMentions: {parse: []}  // disallow all mentions
        });

        await this.db.query('UPDATE suggestions SET message=$1 WHERE id=$2', [message.id, suggestion_id]);

        // Create a thread for the suggestion
        const thread = await message.startThread({
            name: `Discussion about ${title}`,
            reason: 'Automatic suggestion thread creation',
            autoArchiveDuration: "MAX"
        });

        // Ping the creator
        const pingMsg = await thread.send({
            content: `[Automated Thread Invite] <@${interaction.user.id}>`,
            allowedMentions: {users: [interaction.user.id]}
        })
        await pingMsg.delete();

        // Finally, reply to the user
        await interaction.editReply({
            components: [{
                type: MessageComponentTypes.ACTION_ROW,
                components: [{
                    type: MessageComponentTypes.BUTTON,
                    style: MessageButtonStyles.LINK,
                    label: 'See suggestion',
                    url: message.url
                }]
            }],
            embeds: [{
                title: ':white_check_mark: Suggestion created',
                description: `Your suggestion has been recorded. You can discuss it with other members in <#${thread.id}>.`,
                footer: {text: `${suggestion_id.toString()}`},
                timestamp: Date.now(),
                color: SUCCESS_COLOR
            }],
        })
    }

    private async onSetStatus(interaction: CommandInteraction, status: SuggestionStatus) {
        const id = interaction.options.getInteger('id')!!;
        const expl = interaction.options.getString('message');

        // Check whether the user has the proper permission
        const userRoles = interaction.member?.roles as GuildMemberRoleManager;
        if (!userRoles.cache.has(this.managerRoleId)) {
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

        // Grab the suggestion from the database.
        const suggestion = await this.byId(id);
        if (suggestion == null) {
            await interaction.editReply({
                embeds: [{
                    title: ':no_entry_sign: Not found',
                    description: `There is no suggestion #${id}.`,
                    color: ERROR_COLOR,
                    timestamp: Date.now()
                }]
            });
            return;
        }

        // Modify the suggestion
        await this.db.query('UPDATE suggestions SET status=$1 WHERE id=$2', [status, id])

        // Modify the message
        const message = await this.suggestionChannel.messages.fetch(suggestion.message);
        const embed = message.embeds[0];
        const statusCfg = suggestionStatuses[status];

        embed.fields[0].value = `${statusCfg.emoji} ${statusCfg.name}`;
        embed.setTimestamp(Date.now());
        embed.setColor(statusCfg.color)

        if (expl != null) {
            if (embed.fields.length < 5) embed.fields[4] = embed.fields[3];

            embed.fields[3] = {
                name: `Reply from ${interaction.user.username}:`,
                value: expl,
                inline: false,
            }
        } else {
            if (embed.fields.length == 5) embed.fields[3] = embed.fields.pop()!!;
        }

        await message.edit({embeds: [embed]})

        // Archive the associated thread if necessary
        if (interaction.guild?.me?.permissions.has('MANAGE_THREADS') &&
            (status == SuggestionStatus.DENIED || status == SuggestionStatus.IMPLEMENTED)) {
            message.thread?.setAutoArchiveDuration(60, 'The suggestion was closed.');
            message.thread?.setRateLimitPerUser(21600, 'The suggestion was closed.');
            message.thread?.setArchived(true, 'The suggestion was closed.');
        }

        // Notify all participants
        await message.thread?.send({
            embeds: [{
                title: 'Status changed',
                description: `The status of this suggestion changed to **${statusCfg.name}.**`,
                timestamp: Date.now(),
                color: statusCfg.color
            }]
        })

        // Finally, reply to the user
        await interaction.editReply({
            components: [{
                type: MessageComponentTypes.ACTION_ROW,
                components: [{
                    type: MessageComponentTypes.BUTTON,
                    style: MessageButtonStyles.LINK,
                    label: 'See suggestion',
                    url: message.url
                }]
            }],
            embeds: [{
                title: ':white_check_mark: Status changed',
                description: `The status of the suggestion _${suggestion.title}_ (#${suggestion.id}) was changed to **${statusCfg.name}**. You can discuss it here: <#${message.thread?.id}>`,
                timestamp: Date.now(),
                color: SUCCESS_COLOR
            }]
        });
    }

    private async onDelete(interaction: CommandInteraction) {
        const id = interaction.options.getInteger('id')!!;

        // Grab the suggestion from the database.
        const suggestion = await this.byId(id);
        if (suggestion == null) {
            await interaction.editReply({
                embeds: [{
                    title: ':no_entry_sign: Not found',
                    description: `There is no suggestion #${id}.`,
                    color: ERROR_COLOR,
                    timestamp: Date.now()
                }]
            })
            return;
        }

        // Check whether the user has the proper permission
        const userRoles = interaction.member?.roles as GuildMemberRoleManager;
        if (!userRoles.cache.has(this.managerRoleId) && interaction.user.id != suggestion.author) {
            await interaction.editReply({
                embeds: [{
                    title: ':no_entry_sign: Forbidden',
                    description: `You may not delete this suggestion.`,
                    color: ERROR_COLOR,
                    timestamp: Date.now()
                }]
            })
            return;
        }

        // Delete the message and database entry
        if (interaction.guild?.me?.permissions.has('MANAGE_THREADS')) {
            // Delete the thread too, if possible.
            const msg = await this.suggestionChannel.messages.fetch(suggestion.message);
            await msg.thread?.delete();
        }

        await this.suggestionChannel.messages.delete(suggestion.message);
        const author = await interaction.guild?.members.fetch(suggestion.author);
        await this.db.query('DELETE FROM suggestions WHERE id=$1', [id]);

        // Finally, reply to the user
        await interaction.editReply({
            embeds: [{
                title: ':white_check_mark: Suggestion deleted',
                description: `The suggestion _${suggestion.title}_ (#${suggestion.id}) by ${author?.user.username || 'unknown'} was deleted.`,
                timestamp: Date.now(),
                color: SUCCESS_COLOR
            }]
        });
    }

    private async onList(interaction: CommandInteraction) {
        const link = (id: string) => {
            return `https://discordapp.com/channels/${interaction.guild?.id}/${this.suggestionChannelId}/${id}`;
        }

        // Grab the suggestion from the database.
        const open = (await this.db
            .query('SELECT * FROM suggestions WHERE status=$1', [SuggestionStatus.OPEN]))
            .rows.map(v => `» ${v.title} ([#${v.id}](${link(v.message)}))`);

        const considered = (await this.db
            .query('SELECT * FROM suggestions WHERE status=$1', [SuggestionStatus.CONSIDERED]))
            .rows.map(v => `» ${v.title} ([#${v.id}](${link(v.message)}))`);

        const approved = (await this.db
            .query('SELECT * FROM suggestions WHERE status=$1', [SuggestionStatus.APPROVED]))
            .rows.map(v => `» ${v.title} ([#${v.id}](${link(v.message)}))`);

        // Finally, reply to the user
        await interaction.editReply({
            embeds: [{
                title: ':white_check_mark: Here is a list of all open suggestions.',
                fields: [
                    {name: 'Open:', value: open.join('\n') || 'None'},
                    {name: 'Considered:', value: considered.join('\n') || 'None'},
                    {name: 'Approved:', value: approved.join('\n') || 'None'},
                ],
                timestamp: Date.now(),
                color: SUCCESS_COLOR
            }]
        });
    }


    private async onUpvote(interaction: MessageComponentInteraction) {
        const suggestion = await this.byMessage(interaction.message.id)
        const embed = interaction.message.embeds[0];

        if (suggestion != null) {
            const prevVote = suggestion.votes[interaction.user.id];
            suggestion.votes[interaction.user.id] = true;

            if (prevVote === undefined) {
                await this.db.query('UPDATE suggestions SET votes=$1, votes_for=$2 WHERE id=$3',
                    [suggestion.votes, suggestion.votes_for + 1, suggestion.id])

                embed.fields!![1].value = (suggestion.votes_for + 1).toString();
            } else if (!prevVote) {
                await this.db.query('UPDATE suggestions SET votes=$1, votes_for=$2, votes_against=$3 WHERE id=$4',
                    [suggestion.votes, suggestion.votes_for + 1, suggestion.votes_against - 1, suggestion.id])

                embed.fields!![1].value = (suggestion.votes_for + 1).toString();
                embed.fields!![2].value = (suggestion.votes_against - 1).toString();
            }
        }

        await interaction.update({embeds: [embed]})
    }

    private async onDownvote(interaction: MessageComponentInteraction) {
        const suggestion = await this.byMessage(interaction.message.id);
        const embed = interaction.message.embeds[0];

        if (suggestion != null) {
            const prevVote = suggestion.votes[interaction.user.id];
            suggestion.votes[interaction.user.id] = false;

            if (prevVote === undefined) {
                await this.db.query('UPDATE suggestions SET votes=$1, votes_against=$2 WHERE id=$3',
                    [suggestion.votes, suggestion.votes_against + 1, suggestion.id])

                embed.fields!![2].value = (suggestion.votes_against + 1).toString();
            } else if (prevVote) {
                await this.db.query('UPDATE suggestions SET votes=$1, votes_for=$2, votes_against=$3 WHERE id=$4',
                    [suggestion.votes, suggestion.votes_for - 1, suggestion.votes_against + 1, suggestion.id])

                embed.fields!![1].value = (suggestion.votes_for - 1).toString();
                embed.fields!![2].value = (suggestion.votes_against + 1).toString();
            }
        }

        await interaction.update({embeds: [embed]})
    }

    private async onRemoveVote(interaction: MessageComponentInteraction) {
        const suggestion = await this.byMessage(interaction.message.id);
        const embed = interaction.message.embeds[0];

        if (suggestion != null) {
            const prevVote = suggestion.votes[interaction.user.id];
            suggestion.votes[interaction.user.id] = undefined;

            if (prevVote !== undefined) {
                if (prevVote) {
                    await this.db.query('UPDATE suggestions SET votes=$1, votes_for=$2 WHERE id=$3',
                        [suggestion.votes, suggestion.votes_for - 1, suggestion.id])

                    embed.fields!![1].value = (suggestion.votes_for - 1).toString();
                } else {
                    await this.db.query('UPDATE suggestions SET votes=$1, votes_against=$2 WHERE id=$3',
                        [suggestion.votes, suggestion.votes_against - 1, suggestion.id])

                    embed.fields!![2].value = (suggestion.votes_against - 1).toString();
                }
            }
        }

        await interaction.update({embeds: [embed]})
    }

    private async onManage(interaction: CommandInteraction) {
        const command = interaction.options.getSubcommand();
        await interaction.deferReply({ephemeral: true});

        switch (command) {
            case 'create':
                await this.onSuggest(interaction);
                break;
            case 'set-status':
                await this.onSetStatus(interaction, interaction.options.getInteger('status')!!);
                break;
            case 'delete':
                await this.onDelete(interaction);
                break;
            case 'list':
                await this.onList(interaction);
                break;
        }
    }
}
