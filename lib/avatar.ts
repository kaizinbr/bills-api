export const DEFAULT_COLOR = "#009C7A";
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isVercelBlobUrl(value: string): boolean {
    try {
        const hostname = new URL(value).hostname;
        return hostname.endsWith(".blob.vercel-storage.com");
    } catch {
        return false;
    }
}

// garante que a URL é um blob de avatar DESSE usuário
export function isUserAvatarUrl(value: string, userId: string): boolean {
    if (!isVercelBlobUrl(value)) return false;
    return new URL(value).pathname.startsWith(`/avatars/${userId}/`);
}