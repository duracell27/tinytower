import React from "react";
import Production from "./Production";
import bg from "./welcome-bg.png";

import bulky from "./img/bulky.png";
import cupcake from "./img/cupcake.png";
import cake from "./img/cake.png";
import wash from "./img/wash.png";
import dry from "./img/dry.png";
import bleach from "./img/bleach.png";
import coffee from "./img/coffee.png";
import pancake from "./img/pancake.png";
import dessert from "./img/dessert.png";

const F = "Fredoka, system-ui, sans-serif";

/* floor data ─ edit freely */
const FLOORS = [
  {
    n: 1,
    name: "КОНДИТЕРСЬКА",
    stars: 4,
    header: "linear-gradient(180deg,#74C44F,#5DA83C)",
    headerShadow: "rgba(40,70,25,0.4)",
    body: "#D2EAB4",
    cardBg: "#F2F8E9",
    nameColor: "#5B963A",
    items: [
      { title: "Булки", state: "buy", label: "Закупити", sub: "1 250", img: bulky },
      { title: "Пирожені", state: "delivery", label: "02:45", sub: "Доставка", img: cupcake },
      { title: "Торти", state: "layout", label: "Викласти", sub: "2 300", img: cake },
    ],
  },
  {
    n: 2,
    name: "ПРАЛЬНЯ",
    stars: 4,
    header: "linear-gradient(180deg,#43BCAA,#2E9E8E)",
    headerShadow: "rgba(20,70,60,0.4)",
    body: "#BEE6DD",
    cardBg: "#EBF7F3",
    nameColor: "#2E9384",
    items: [
      { title: "Прання", state: "buy", label: "Закупити", sub: "1 100", img: wash },
      { title: "Сушка", state: "delivery", label: "05:10", sub: "Доставка", img: dry },
      { title: "Відбілювання", state: "hire", label: "Найняти", sub: "500", img: bleach },
    ],
  },
  {
    n: 3,
    name: "КАВ’ЯРНЯ",
    stars: 4,
    header: "linear-gradient(180deg,#F2B838,#E09E10)",
    headerShadow: "rgba(120,80,0,0.4)",
    body: "#F7E4AC",
    cardBg: "#FDF8E9",
    nameColor: "#B5871E",
    items: [
      { title: "Кава", state: "buy", label: "Закупити", sub: "900", img: coffee },
      { title: "Млинці", state: "sell", label: "03:30", sub: "Продаж", img: pancake },
      { title: "Десерти", state: "collect", label: "Зібрати", sub: "1 400", img: dessert },
    ],
  },
];

function Stars({ count, color = "#FFD23E" }) {
  return (
    <span style={{ marginLeft: "auto", display: "flex", gap: 1, fontSize: 13, lineHeight: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ color: i < count ? color : "rgba(0,0,0,0.18)", textShadow: i < count ? "0 1px 1px rgba(120,80,0,0.4)" : "none" }}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function TowerScene() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflowY: "auto",
        background: `#DCEFF6 url(${bg}) center/cover no-repeat`,
        fontFamily: F,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 13, padding: "170px 14px 124px" }}>
        {FLOORS.map((f) => (
          <div key={f.n} style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 12px -2px rgba(60,80,45,0.18)", background: "#fff" }}>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", height: 31, padding: "0 12px", background: f.header, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }}>
              <span
                style={{
                  flex: "none",
                  width: 21,
                  height: 21,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.26)",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 12,
                  color: "#fff",
                  marginRight: 9,
                }}
              >
                {f.n}
              </span>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#fff", letterSpacing: 0.6, textShadow: `0 1px 1px ${f.headerShadow}` }}>{f.name}</span>
              <Stars count={f.stars} />
            </div>
            {/* cards */}
            <div style={{ display: "flex", gap: 7, padding: 9, background: f.body }}>
              {f.items.map((it) => (
                <div key={it.title} style={{ flex: 1, minWidth: 0 }}>
                  <Production
                    title={it.title}
                    state={it.state}
                    label={it.label}
                    sub={it.sub}
                    imgSrc={it.img}
                    cardBg={f.cardBg}
                    nameColor={f.nameColor}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
