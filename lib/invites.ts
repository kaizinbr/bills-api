import { prisma } from "@/lib/prisma";

const INVITE_CODE_LENGTH = 6;
// sem 0/O, 1/I/L — evita confusão na hora de digitar o código à mão
const INVITE_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_ATTEMPTS = 5;

function randomInviteCode(): string {
    let code = "";
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
        const index = Math.floor(Math.random() * INVITE_CODE_CHARS.length);
        code += INVITE_CODE_CHARS[index];
    }
    return code;
}

/**
 * Gera um código de convite de 6 caracteres (letras + números), garantindo
 * que não colide com nenhum já existente em Group.inviteCode.
 */
export async function generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const code = randomInviteCode();

        const existing = await prisma.group.findUnique({
            where: { inviteCode: code },
            select: { id: true },
        });

        if (!existing) return code;
    }

    throw new Error(
        `Não foi possível gerar um código de convite único após ${MAX_ATTEMPTS} tentativas.`,
    );
}
