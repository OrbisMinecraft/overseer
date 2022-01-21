import {Module} from "./module";
import {SuggestionsModule} from "./modules/suggestions";
import {TimestampModule} from "./modules/timestamp";
import {NukeModule} from "./modules/nuke";

export const config = {
    token: 'YOUR_BOT_TOKEN',
    applicationId: 'YOUR_APP_ID',

    guildId: 'YOUR_GUILD_ID',
    suggestionChannelId: 'YOUR_SUGGESTION_CHANNEL_ID',
    suggestionsManageRoleId: 'YOUR_SUGGESTION_MANAGER_ROLE',
    nukeRoleId: 'YOUR_NUKE_ROLE',

    dbHost: 'localhost',
    dbPort: 5432,
    dbName: 'overseer',
    dbUser: 'overseer',
    dbPassword: '',
}

export const modules: Module[] = [
    new SuggestionsModule(config.suggestionChannelId, config.suggestionsManageRoleId),
    new TimestampModule(),
    new NukeModule(config.nukeRoleId),
]
