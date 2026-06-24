import React, { useState } from "react";
import bg from "./welcome-bg.png";

const F = "Fredoka, sans-serif";
const N = "Nunito, system-ui, sans-serif";

const label = { fontFamily: F, fontWeight: 500, fontSize: 13, color: "#5A6650", paddingLeft: 2 };
const inputStyle = {
  height: 52,
  borderRadius: 15,
  border: "2px solid #E4E1D3",
  background: "#fff",
  padding: "0 16px",
  fontFamily: N,
  fontWeight: 600,
  fontSize: 15,
  color: "#27331F",
  outline: "none",
  boxSizing: "border-box",
};
const socialBtn = {
  appearance: "none",
  cursor: "pointer",
  flex: 1,
  height: 52,
  borderRadius: 15,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
};

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" style={{ display: "block" }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function LoginScreen({ onSubmit, onGoogle, onApple }) {
  const [tab, setTab] = useState("login"); // 'login' | 'register'
  const isLogin = tab === "login";
  const activeShadow = "0 2px 6px rgba(60,90,40,0.18),inset 0 1px 0 rgba(255,255,255,0.7)";

  const tabBtn = (active) => ({
    appearance: "none",
    cursor: "pointer",
    flex: 1,
    height: 42,
    border: "none",
    borderRadius: 11,
    fontFamily: F,
    fontWeight: 600,
    fontSize: 15,
    background: active ? "#fff" : "transparent",
    color: active ? "#2C4A2A" : "#9A9684",
    boxShadow: active ? activeShadow : "none",
    transition: "all .18s ease",
  });

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", fontFamily: N }}>
      <img
        src={bg}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 100%" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg,rgba(20,50,80,0.12),rgba(20,40,60,0.02) 40%,rgba(20,40,30,0.16))",
        }}
      />

      {/* centered card */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 22px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            background: "#FBFAF5",
            borderRadius: 30,
            boxShadow:
              "0 24px 60px -16px rgba(30,50,30,0.4),0 4px 14px rgba(30,50,30,0.16),inset 0 1px 0 rgba(255,255,255,0.9)",
            padding: "30px 24px 26px",
            boxSizing: "border-box",
          }}
        >
          <h1 style={{ margin: "0 0 6px", fontFamily: F, fontWeight: 600, fontSize: 27, color: "#27331F", textAlign: "center" }}>
            {isLogin ? "З поверненням!" : "Створіть акаунт"}
          </h1>
          <p
            style={{
              margin: "0 0 22px",
              fontFamily: N,
              fontWeight: 600,
              fontSize: 14,
              color: "#7C8A6E",
              lineHeight: 1.35,
              textAlign: "center",
            }}
          >
            {isLogin ? "Увійдіть, щоб продовжити будувати свою вежу" : "Збережіть прогрес і грайте на всіх пристроях"}
          </p>

          {/* tabs */}
          <div style={{ display: "flex", gap: 5, background: "#ECEADF", borderRadius: 15, padding: 5, marginBottom: 22 }}>
            <button onClick={() => setTab("login")} style={tabBtn(isLogin)}>Вхід</button>
            <button onClick={() => setTab("register")} style={tabBtn(!isLogin)}>Реєстрація</button>
          </div>

          {!isLogin && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 15 }}>
              <label style={label}>Ім'я гравця</label>
              <input type="text" placeholder="Як до вас звертатися?" style={inputStyle} />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 15 }}>
            <label style={label}>Ел. пошта</label>
            <input type="email" placeholder="you@example.com" style={inputStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
            <label style={label}>Пароль</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input type="password" placeholder="Мінімум 6 символів" style={{ ...inputStyle, width: "100%", padding: "0 48px 0 16px" }} />
              <span
                style={{
                  position: "absolute",
                  right: 16,
                  width: 22,
                  height: 15,
                  borderRadius: "11px/8px",
                  border: "2.5px solid #B7B3A2",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#B7B3A2" }} />
              </span>
            </div>
          </div>

          {isLogin ? (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20, marginTop: 4 }}>
              <a href="#" style={{ fontFamily: F, fontWeight: 500, fontSize: 13, color: "#3C9A34", textDecoration: "none" }}>
                Забули пароль?
              </a>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 20, marginTop: 10 }}>
              <span
                style={{
                  flex: "none",
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: "#4FB246",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "inset 0 -2px 0 rgba(30,90,25,0.3)",
                }}
              >
                <span style={{ display: "block", width: 5, height: 9, border: "solid #fff", borderWidth: "0 2.5px 2.5px 0", transform: "rotate(42deg)", marginTop: -2 }} />
              </span>
              <span style={{ fontFamily: N, fontWeight: 600, fontSize: 12.5, color: "#7C8A6E", lineHeight: 1.4 }}>
                Я приймаю <span style={{ color: "#3C9A34" }}>Умови використання</span> та{" "}
                <span style={{ color: "#3C9A34" }}>Політику конфіденційності</span>
              </span>
            </div>
          )}

          <button
            onClick={onSubmit}
            style={{
              appearance: "none",
              border: "2px solid rgba(255,255,255,0.5)",
              cursor: "pointer",
              width: "100%",
              height: 58,
              borderRadius: 18,
              background: "linear-gradient(180deg,#62C84F,#3FA535)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow:
                "0 10px 22px -5px rgba(46,130,40,0.5),inset 0 2px 0 rgba(255,255,255,0.5),inset 0 -3px 0 rgba(40,110,30,0.35)",
            }}
          >
            <span style={{ fontFamily: F, fontWeight: 600, fontSize: 19, color: "#fff", textShadow: "0 1px 2px rgba(20,70,15,0.45)" }}>
              {isLogin ? "Увійти" : "Створити акаунт"}
            </span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
            <span style={{ flex: 1, height: 1.5, background: "#E4E1D3" }} />
            <span style={{ fontFamily: N, fontWeight: 700, fontSize: 12, color: "#A8A493" }}>або</span>
            <span style={{ flex: 1, height: 1.5, background: "#E4E1D3" }} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={onGoogle} style={{ ...socialBtn, border: "2px solid #E4E1D3", background: "#fff" }}>
              <GoogleG />
              <span style={{ fontFamily: F, fontWeight: 500, fontSize: 14, color: "#5A6650" }}>Google</span>
            </button>
            <button onClick={onApple} style={{ ...socialBtn, border: "2px solid #1C1C1E", background: "#1C1C1E" }}>
              <span style={{ fontSize: 17, lineHeight: 1, marginTop: -2 }}></span>
              <span style={{ fontFamily: F, fontWeight: 500, fontSize: 14, color: "#fff" }}>Apple</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
