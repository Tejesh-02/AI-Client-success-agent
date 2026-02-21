import bcrypt from "bcryptjs";

const saltRounds = Number(process.env.PASSWORD_SALT_ROUNDS ?? "10");

export const hashPassword = async (password: string): Promise<string> => bcrypt.hash(password, saltRounds);

export const verifyPassword = async (password: string, passwordHash: string): Promise<boolean> =>
  bcrypt.compare(password, passwordHash);
