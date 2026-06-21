import { ImageResponse } from "next/og";

export const alt = "Barri AI Keeper for browser tabletop horror investigations";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "radial-gradient(circle at 76% 20%, rgba(181,50,31,0.30), transparent 34%), linear-gradient(135deg, #07060a 0%, #151119 55%, #07060a 100%)",
          color: "#d8c8a6",
          fontFamily: "Georgia, serif",
          padding: 72,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 34,
            border: "1px solid rgba(168,147,106,0.42)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div
              style={{
                width: 58,
                height: 58,
                border: "2px solid #a8936a",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              B
            </div>
            <div
              style={{
                fontSize: 32,
                letterSpacing: 10,
                textTransform: "uppercase",
              }}
            >
              Barri
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 840 }}>
            <div
              style={{
                color: "#d4a153",
                fontSize: 24,
                letterSpacing: 7,
                marginBottom: 22,
                textTransform: "uppercase",
              }}
            >
              AI Keeper for browser tabletop RPGs
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 96,
                lineHeight: 0.92,
                fontWeight: 900,
                letterSpacing: -3,
                textTransform: "uppercase",
              }}
            >
              <span>Play the case.</span>
              <span>The Keeper remembers.</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 18,
              color: "#f0c77a",
              fontSize: 24,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            <span>No install</span>
            <span>·</span>
            <span>Free demo</span>
            <span>·</span>
            <span>d100 horror rules</span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
