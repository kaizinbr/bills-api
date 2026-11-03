export default async function ConvitePage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    const { code } = await params;

    return (
        <main
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                padding: 24,
                backgroundColor: "#161718",
                color: "#eeeeee",
                fontFamily: "system-ui, sans-serif",
                textAlign: "center",
            }}
        >
            <h1 style={{ fontSize: 24, margin: 0 }}>Convite para o Bills</h1>
            <p style={{ margin: 0, fontSize: 14 }}>Código de convite</p>
            <p
                style={{
                    margin: 0,
                    fontSize: 36,
                    fontWeight: 700,
                    letterSpacing: 4,
                }}
            >
                {code}
            </p>
            <a
                href={`billsapp://convite/${encodeURIComponent(code)}`}
                style={{
                    backgroundColor: "#009C7A",
                    color: "#ffffff",
                    fontWeight: 700,
                    padding: "12px 32px",
                    borderRadius: 9999,
                    textDecoration: "none",
                }}
            >
                Abrir no app
            </a>
            <p style={{ margin: 0, fontSize: 13, maxWidth: 320 }}>
                Se o app não abrir, instale o Bills e use o código acima em
                &quot;Entrar com código de convite&quot;.
            </p>
        </main>
    );
}