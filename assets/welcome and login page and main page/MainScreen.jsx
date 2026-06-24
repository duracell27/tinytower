import React from "react";
import TowerScene from "./TowerScene";

const F = "Fredoka, sans-serif";

const glassPanel = {
  position: "relative",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.85)",
  background: "linear-gradient(150deg,rgba(255,255,255,0.9),rgba(255,255,255,0.72))",
  backdropFilter: "blur(22px) saturate(150%)",
  WebkitBackdropFilter: "blur(22px) saturate(150%)",
};
const glassSheen = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: "50%",
  background: "linear-gradient(180deg,rgba(255,255,255,0.45),transparent)",
  pointerEvents: "none",
};

function NavItem({ active, label, children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: active ? 5 : 6,
        padding: active ? "8px 18px" : "8px 14px",
        borderRadius: 20,
        background: active ? "linear-gradient(180deg,#E4F4D8,#D3EBBF)" : "transparent",
        boxShadow: active ? "inset 0 1px 1px rgba(255,255,255,0.8),0 1px 4px rgba(90,160,60,0.18)" : "none",
      }}
    >
      {children}
      <span style={{ fontFamily: F, fontWeight: active ? 600 : 500, fontSize: 11, color: active ? "#3C9A34" : "#3A4232" }}>{label}</span>
    </div>
  );
}

export default function MainScreen({ user = { name: "Duracell", level: 7, xp: "640/1000", initial: "D" }, coins = "2 480", gems = "143" }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", fontFamily: "Nunito, system-ui, sans-serif" }}>
      {/* background = tower scene */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <TowerScene />
      </div>

      {/* TOP BAR */}
      <div style={{ position: "absolute", top: 54, left: 14, right: 14, zIndex: 40 }}>
        <div style={{ ...glassPanel, borderRadius: 24, boxShadow: "0 8px 22px rgba(70,90,55,0.16),inset 0 1px 1px rgba(255,255,255,0.95)" }}>
          <div style={glassSheen} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}>
            {/* avatar + level */}
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div
                style={{
                  position: "relative",
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "conic-gradient(#5FC24E 0%,#3FA535 64%,rgba(60,120,40,0.14) 64%,rgba(60,120,40,0.14) 100%)",
                  padding: 3.5,
                  boxShadow: "0 2px 6px rgba(70,140,50,0.25)",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "linear-gradient(160deg,#74D3C4,#3FA9A0)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: F,
                    fontWeight: 600,
                    fontSize: 21,
                    color: "#fff",
                    textShadow: "0 1px 2px rgba(20,90,80,0.4)",
                    border: "2px solid #fff",
                    boxSizing: "border-box",
                  }}
                >
                  {user.initial}
                </div>
                <span
                  style={{
                    position: "absolute",
                    bottom: -3,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontFamily: F,
                    fontWeight: 600,
                    fontSize: 9,
                    color: "#fff",
                    background: "#3FA535",
                    padding: "1px 7px",
                    borderRadius: 7,
                    boxShadow: "0 1px 3px rgba(40,110,30,0.4)",
                  }}
                >
                  {user.level}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontFamily: F, fontWeight: 600, fontSize: 17, color: "#27331F", lineHeight: 1 }}>{user.name}</span>
                <span style={{ fontFamily: F, fontWeight: 500, fontSize: 11, color: "#7C8A6E" }}>
                  Level {user.level} · {user.xp} XP
                </span>
              </div>
            </div>
            {/* currencies */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", padding: "4px 9px 4px 5px", borderRadius: 13, boxShadow: "0 1px 3px rgba(120,110,60,0.16),inset 0 1px 1px rgba(255,255,255,0.9)" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#FFE69B,#F2B330)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.55),0 1px 2px rgba(180,130,30,0.3)" }} />
                <span style={{ fontFamily: F, fontWeight: 600, fontSize: 14, color: "#C28A22" }}>{coins}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", padding: "4px 9px 4px 6px", borderRadius: 13, boxShadow: "0 1px 3px rgba(60,120,140,0.16),inset 0 1px 1px rgba(255,255,255,0.9)" }}>
                <span style={{ width: 14, height: 14, background: "linear-gradient(150deg,#8FE6F2,#3FB8D6)", transform: "rotate(45deg)", borderRadius: 3, boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.6)" }} />
                <span style={{ fontFamily: F, fontWeight: 600, fontSize: 14, color: "#2592AB" }}>{gems}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: "absolute", bottom: 30, left: 16, right: 16, zIndex: 40 }}>
        <div style={{ ...glassPanel, borderRadius: 30, border: "1px solid rgba(255,255,255,0.9)", background: "linear-gradient(150deg,rgba(255,255,255,0.9),rgba(255,255,255,0.75))", boxShadow: "0 12px 30px rgba(60,90,50,0.2),inset 0 1px 1px rgba(255,255,255,0.95)" }}>
          <div style={glassSheen} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 10px" }}>
            <NavItem active label="Вежа">
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                <span style={{ width: 10, height: 4, borderRadius: 1.5, background: "#3C9A34" }} />
                <span style={{ width: 15, height: 4, borderRadius: 1.5, background: "#3C9A34" }} />
                <span style={{ width: 20, height: 4, borderRadius: 1.5, background: "#3C9A34" }} />
              </div>
            </NavItem>
            <NavItem label="Місто">
              <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 20 }}>
                <span style={{ width: 6, height: 13, borderRadius: "2px 2px 0 0", background: "#3A4232" }} />
                <span style={{ width: 6, height: 20, borderRadius: "2px 2px 0 0", background: "#3A4232" }} />
                <span style={{ width: 6, height: 10, borderRadius: "2px 2px 0 0", background: "#3A4232" }} />
              </div>
            </NavItem>
            <NavItem label="Магазин">
              <div style={{ position: "relative", width: 20, height: 20 }}>
                <div style={{ position: "absolute", bottom: 0, width: 20, height: 14, borderRadius: "3px 3px 4px 4px", background: "#3A4232" }} />
                <div style={{ position: "absolute", top: 1, left: 5, width: 10, height: 8, border: "2px solid #3A4232", borderBottom: "none", borderRadius: "6px 6px 0 0", boxSizing: "border-box" }} />
              </div>
            </NavItem>
            <NavItem label="Профіль">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, height: 20, justifyContent: "center" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#3A4232" }} />
                <span style={{ width: 16, height: 9, borderRadius: "8px 8px 0 0", background: "#3A4232" }} />
              </div>
            </NavItem>
          </div>
        </div>
      </div>
    </div>
  );
}
