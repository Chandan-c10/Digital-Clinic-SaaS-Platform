import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route as not requiring authentication (login, register, public clinic website). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
