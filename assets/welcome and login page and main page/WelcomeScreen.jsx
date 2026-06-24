import React from "react";
import bg from "./welcome-bg.png";

/* ── shared bits ───────────────────────────────────────────── */
const F = "Fredoka, sans-serif";
const N = "Nunito, system-ui, sans-serif";

const chipBase = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: 150,
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.95)",
  padding: "12px 18px 12px 11px",
  borderRadius: 22,
  boxShadow:
    "0 8px 18px -5px rgba(40,70,40,0.34),inset 0 1px 0 rgba(255,255,255,0.9)",
};
const chipValue = { fontFamily: F, fontWeight: 600, fontSize: 22, color: "#27331F" };

const secondaryBtn = {
  appearance: "none",
  cursor: "pointer",
  flex: 1,
  height: 54,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.9)",
  background:
    "linear-gradient(150deg,rgba(255,255,255,0.95),rgba(255,255,255,0.84))",
  backdropFilter: "blur(14px) saturate(150%)",
  WebkitBackdropFilter: "blur(14px) saturate(150%)",
  boxShadow:
    "0 6px 16px -4px rgba(40,60,40,0.28),inset 0 1px 1px rgba(255,255,255,0.9)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
};
const secondaryLabel = { fontFamily: F, fontWeight: 600, fontSize: 17, color: "#2C4A2A" };

/* ── component ─────────────────────────────────────────────── */
export default function WelcomeScreen({ onPlay, onLogin, onRegister }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        fontFamily: N,
      }}
    >
      {/* background art */}
      <img
        src={bg}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "50% 100%",
        }}
      />

      {/* legibility scrim */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 30,
          background:
            "linear-gradient(180deg,rgba(30,60,90,0.14) 0%,rgba(30,60,90,0) 20%,rgba(15,35,25,0) 56%,rgba(15,35,25,0.32) 80%,rgba(12,30,20,0.58) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* logo */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          lineHeight: 0.82,
        }}
      >
        <span
          style={{
            fontFamily: F,
            fontWeight: 700,
            fontSize: 52,
            letterSpacing: 1,
            color: "#fff",
            WebkitTextStroke: "4px #3E8FD8",
            paintOrder: "stroke fill",
            textShadow: "0 5px 0 #2E6FB0,0 8px 12px rgba(20,60,110,0.4)",
          }}
        >
          TINY
        </span>
        <span
          style={{
            fontFamily: F,
            fontWeight: 700,
            fontSize: 52,
            letterSpacing: 1,
            color: "#FFC83D",
            WebkitTextStroke: "4px #C77A12",
            paintOrder: "stroke fill",
            textShadow: "0 5px 0 #B5670E,0 8px 12px rgba(120,70,10,0.4)",
            marginTop: -4,
          }}
        >
          TOWER
        </span>
      </div>

      {/* speech bubble */}
      <div
        style={{
          position: "absolute",
          top: 198,
          left: 0,
          right: 0,
          zIndex: 40,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            background: "rgba(255,255,255,0.94)",
            padding: "13px 26px",
            borderRadius: 22,
            boxShadow: "0 6px 16px -4px rgba(40,70,40,0.28)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            maxWidth: 272,
          }}
        >
          <span
            style={{
              fontFamily: F,
              fontWeight: 600,
              fontSize: 17,
              color: "#2C4A2A",
              textAlign: "center",
              display: "block",
              lineHeight: 1.35,
            }}
          >
            Будуй вище,
            <br />
            заробляй більше{" "}
            <span
              style={{
                display: "inline-block",
                verticalAlign: -4,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 30%,#FFE69B,#F2B330)",
                boxShadow:
                  "inset 0 0 0 2.5px rgba(255,255,255,0.55),0 1px 2px rgba(180,130,30,0.35)",
              }}
            />
          </span>
          <span
            style={{
              position: "absolute",
              bottom: -7,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 15,
              height: 15,
              background: "rgba(255,255,255,0.94)",
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* stat chips */}
      <div
        style={{
          position: "absolute",
          right: 16,
          top: 352,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* coins */}
        <div style={chipBase}>
          <span
            style={{
              flex: "none",
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 30%,#FFE69B,#F2B330)",
              boxShadow:
                "inset 0 0 0 4px rgba(255,255,255,0.55),0 2px 4px rgba(180,130,30,0.35)",
            }}
          />
          <span style={chipValue}>2 480</span>
        </div>
        {/* gems */}
        <div style={chipBase}>
          <span
            style={{
              flex: "none",
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                background: "linear-gradient(150deg,#8FE6F2,#3FB8D6)",
                transform: "rotate(45deg)",
                borderRadius: 5,
                boxShadow:
                  "inset 0 0 0 2px rgba(255,255,255,0.6),0 2px 4px rgba(20,110,140,0.3)",
              }}
            />
          </span>
          <span style={chipValue}>143</span>
        </div>
        {/* floors */}
        <div style={chipBase}>
          <span
            style={{
              flex: "none",
              width: 40,
              height: 40,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
            }}
          >
            {["#6FBF46", "#8FD86A", "#6FBF46"].map((c, i) => (
              <span
                key={i}
                style={{
                  width: 24,
                  height: 6,
                  borderRadius: 3,
                  background: c,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={chipValue}>3</span>
            <span
              style={{
                fontFamily: N,
                fontWeight: 700,
                fontSize: 12,
                color: "#9A9684",
                marginTop: 3,
              }}
            >
              поверхи
            </span>
          </div>
        </div>
      </div>

      {/* action buttons */}
      <div
        style={{
          position: "absolute",
          left: 22,
          right: 22,
          bottom: 38,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <button
          onClick={onPlay}
          style={{
            appearance: "none",
            border: "2px solid rgba(255,255,255,0.55)",
            cursor: "pointer",
            width: "100%",
            height: 62,
            borderRadius: 22,
            background: "linear-gradient(180deg,#62C84F,#3FA535)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 11,
            boxShadow:
              "0 10px 22px -4px rgba(46,130,40,0.5),inset 0 2px 0 rgba(255,255,255,0.55),inset 0 -3px 0 rgba(40,110,30,0.35)",
          }}
        >
          <span
            style={{
              width: 0,
              height: 0,
              borderLeft: "15px solid #fff",
              borderTop: "10px solid transparent",
              borderBottom: "10px solid transparent",
              filter: "drop-shadow(0 1px 1px rgba(20,70,15,0.4))",
            }}
          />
          <span
            style={{
              fontFamily: F,
              fontWeight: 600,
              fontSize: 21,
              color: "#fff",
              letterSpacing: 0.3,
              textShadow: "0 1px 2px rgba(20,70,15,0.45)",
            }}
          >
            Почати будувати
          </span>
        </button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "1px 0 2px" }}>
          <span
            style={{
              fontFamily: F,
              fontWeight: 600,
              fontSize: 14,
              color: "rgba(255,255,255,0.95)",
              textShadow: "0 1px 3px rgba(15,35,25,0.6)",
            }}
          >
            або
          </span>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onLogin} style={secondaryBtn}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>👤</span>
            <span style={secondaryLabel}>Увійти</span>
          </button>
          <button onClick={onRegister} style={secondaryBtn}>
            <span
              style={{
                position: "relative",
                width: 17,
                height: 17,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ position: "absolute", width: 15, height: 3, borderRadius: 2, background: "#3C7A35" }} />
              <span style={{ position: "absolute", width: 3, height: 15, borderRadius: 2, background: "#3C7A35" }} />
            </span>
            <span style={secondaryLabel}>Реєстрація</span>
          </button>
        </div>

        <span
          style={{
            textAlign: "center",
            fontFamily: N,
            fontWeight: 600,
            fontSize: 12,
            color: "rgba(255,255,255,0.92)",
            textShadow: "0 1px 3px rgba(15,35,25,0.6)",
            marginTop: 2,
          }}
        >
          Продовжуючи, ви приймаєте наші{" "}
          <span style={{ textDecoration: "underline" }}>Умови</span> та{" "}
          <span style={{ textDecoration: "underline" }}>Політику</span>
        </span>
      </div>
    </div>
  );
}
