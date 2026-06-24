import React from "react";

const F = "Fredoka, sans-serif";

/* button visual config per state */
const BTN = {
  buy:      { grad: "linear-gradient(180deg,#72C24F,#5BA63C)", shadow: "0 2px 0 #4A8A2E" },
  collect:  { grad: "linear-gradient(180deg,#72C24F,#5BA63C)", shadow: "0 2px 0 #4A8A2E" },
  hire:     { grad: "linear-gradient(180deg,#72C24F,#5BA63C)", shadow: "0 2px 0 #4A8A2E" },
  delivery: { grad: "linear-gradient(180deg,#52A6E2,#3B8BCB)", shadow: "0 2px 0 #2C73AC" },
  layout:   { grad: "linear-gradient(180deg,#F2AC40,#E89320)", shadow: "0 2px 0 #C9760F" },
  sell:     { grad: "linear-gradient(180deg,#9A72D6,#8455C2)", shadow: "0 2px 0 #6B41A8" },
};

function Icon({ state }) {
  switch (state) {
    case "buy":
    case "hire":
      return state === "buy" ? (
        <svg viewBox="0 0 24 24" width="13" height="13" style={{ flex: "none" }}>
          <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="14" style={{ flex: "none" }} fill="#fff">
          <circle cx="9" cy="8" r="3.4" />
          <path d="M3 20c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4z" />
          <path d="M19 7.5v6M16 10.5h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "delivery":
      return (
        <svg viewBox="0 0 24 24" width="16" height="14" style={{ flex: "none" }} fill="#fff">
          <path d="M2 6.5h11.5v8.5H2z" />
          <path d="M13.5 9h3.6L21 12.4V15h-7.5z" />
          <circle cx="6" cy="16.6" r="2" stroke="#3B8BCB" strokeWidth="1.4" />
          <circle cx="17.2" cy="16.6" r="2" stroke="#3B8BCB" strokeWidth="1.4" />
        </svg>
      );
    case "layout":
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" style={{ flex: "none" }}>
          <rect x="4" y="6" width="16" height="13" rx="1.6" fill="#fff" />
          <rect x="4" y="6" width="16" height="4" rx="1.6" fill="rgba(0,0,0,0.16)" />
          <rect x="11" y="6" width="2" height="13" fill="rgba(0,0,0,0.13)" />
        </svg>
      );
    case "sell":
      return (
        <svg viewBox="0 0 24 24" width="15" height="15" style={{ flex: "none" }} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h2.2l2.4 10.5h9.1l1.9-7H6.3" />
          <circle cx="9" cy="19" r="1.5" fill="#fff" stroke="none" />
          <circle cx="17" cy="19" r="1.5" fill="#fff" stroke="none" />
        </svg>
      );
    case "collect":
      return (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            flex: "none",
            background: "radial-gradient(circle at 35% 30%,#FFE69B,#F2B330)",
            boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.6),0 1px 1px rgba(120,80,0,0.25)",
          }}
        />
      );
    default:
      return null;
  }
}

export default function Production({
  title,
  state = "buy",
  label,
  sub,
  imgSrc,
  cardBg = "#F6F1E2",
  nameColor = "#3A4232",
  onAction,
}) {
  const isHire = state === "hire";
  const isTimer = state === "delivery" || state === "sell";
  const btn = BTN[state] || BTN.buy;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: cardBg,
        borderRadius: 13,
        padding: "8px 7px 7px",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04),0 1px 2px rgba(60,70,45,0.07)",
        boxSizing: "border-box",
        height: "100%",
        fontFamily: F,
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontWeight: 600,
          fontSize: 11.5,
          lineHeight: 1.1,
          color: nameColor,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </div>

      {/* image / hire slot */}
      <div style={{ position: "relative", width: "100%", height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isHire ? (
          <div
            style={{
              position: "relative",
              width: 54,
              height: 54,
              borderRadius: 13,
              border: "2px dashed rgba(60,70,45,0.22)",
              background: "rgba(0,0,0,0.02)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 24 24" width="30" height="30" fill="#C2BEB2">
              <circle cx="12" cy="8" r="4.2" />
              <path d="M4.5 21c0-4.2 3.4-6.8 7.5-6.8s7.5 2.6 7.5 6.8z" />
            </svg>
            <span
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                width: 17,
                height: 17,
                borderRadius: "50%",
                background: "#5BA63C",
                boxShadow: "0 1px 2px rgba(40,90,25,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg viewBox="0 0 24 24" width="9" height="9">
                <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
              </svg>
            </span>
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={title}
            style={{ width: 56, height: 56, borderRadius: 11, objectFit: "contain" }}
          />
        )}
      </div>

      {/* action button */}
      <div
        onClick={onAction}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          padding: "6px 7px",
          borderRadius: 9,
          background: btn.grad,
          color: "#fff",
          fontWeight: 600,
          fontSize: 11.5,
          textShadow: "0 1px 1px rgba(0,0,0,0.2)",
          boxShadow: btn.shadow + ",inset 0 1px 0 rgba(255,255,255,0.4)",
          cursor: "pointer",
        }}
      >
        <Icon state={state} />
        <span>{label}</span>
      </div>

      {/* sub-block: price or status */}
      <div style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isTimer ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 11px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.85)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)",
              fontWeight: 600,
              fontSize: 10.5,
              color: "#8A8475",
            }}
          >
            {sub}
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 9px 2px 4px",
              borderRadius: 10,
              background: "#FFFFFF",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04),0 1px 1px rgba(120,90,30,0.12)",
            }}
          >
            <span
              style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                flex: "none",
                background: "radial-gradient(circle at 35% 30%,#FFE69B,#F2B330)",
                boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.55),0 1px 1px rgba(180,130,30,0.3)",
              }}
            />
            <span style={{ fontWeight: 600, fontSize: 11.5, color: "#7C7256" }}>{sub}</span>
          </span>
        )}
      </div>
    </div>
  );
}
