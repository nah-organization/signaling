import { string, array, object, literal, enums, union, Infer } from "superstruct";

const tuple = <T extends unknown[]>(...args: T) => args;

export const apiValidators = {
    down: tuple(
        object({
            type: literal('signal'),
            data: object({
                sender: string(),
                receivers: array(string()),
                data: string(),
            })
        }),
        object({
            type: literal('users'),
            data: object({
                me: string(),
                users: array(string()),
                event: object({
                    type: enums(['join', 'leave']),
                    user: string(),
                }),
            })
        }),
        object({
            type: literal('room'),
            data: object({
                id: string(),
            })
        }),
    ),
    up: tuple(
        object({
            type: literal('signal'),
            data: object({
                receivers: array(string()),
                data: string(),
            })
        }),
        object({
            type: literal('join'),
            data: object({

            })
        }),
    ),
};

export const apiupValidator = union(apiValidators.up);
export type apiup = Infer<typeof apiupValidator>;

export const apidownValidator = union(apiValidators.down);
export type apidown = Infer<typeof apidownValidator>;
