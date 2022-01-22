import {MessageOptions} from "discord.js";

export const ERROR_COLOR = 0xed4245;
export const SUCCESS_COLOR = 0x3ba55d

export const YELLOW_COLOR = 0xfabd2f;
export const BLURPLE_COLOR = 0x5865f2;

export function configurationErrorReply(code: string): MessageOptions {
    return {
        embeds: [{
            title: ':no_entry_sign: Interaction Failed',
            description: `I'm sorry, this interaction failed due to a configuration error. Please contact your administrator, providing the error code <**${code}**>.`,
            timestamp: Date.now(),
            color: ERROR_COLOR
        }]
    }
}

export function internalErrorReply(): MessageOptions {
    return {
        embeds: [{
            title: ':no_entry_sign: Interaction Failed',
            description: `I'm sorry, this interaction failed due to an internal error. Please contact your administrator with the command you used and the parameters you provided.`,
            timestamp: Date.now(),
            color: ERROR_COLOR
        }]
    }
}