import {REST} from "@discordjs/rest";
import {config, modules} from "./config";
import {Routes} from "discord-api-types/v9";
import {Command} from "./module";

const rest = new REST({version: '9'}).setToken(config.token);

rest.put(
    Routes.applicationGuildCommands(config.applicationId, config.guildId), {
        body: modules
            .reduce((a, v) => a.concat(v.commands), [] as Command[])
            .map(v => v.definition.toJSON?.())
    }
).then(v => {
    console.log('=> Updated application commands')
}).catch(console.error)
