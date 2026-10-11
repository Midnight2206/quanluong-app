import { useState } from "react";
import { getAccessToken, getPhoneNumber } from "zmp-sdk";
import { API_BASE } from "./config.js";

const SUCCESS_TEXT = "Quay lại trình duyệt";

function readTicket() {
  return new URLSearchParams(window.location.search).get("ticket")?.trim() || "";
}

function failureText(body) {
  const data = body?.data;
  const message = typeof body?.message === "string" ? body.message : "";
  if (data?.status === "failed") return data.errorCode || message;
  return message;
}

function thrownText(error) {
  if (typeof error?.message === "string" && error.message) return error.message;
  return "Không lấy được số điện thoại Zalo.";
}

export default function App() {
  const [pending, setPending] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);

  async function sharePhone() {
    const ticket = readTicket();
    if (!ticket) {
      setDone(false);
      setText("Thiếu phiếu đăng nhập.");
      return;
    }

    setPending(true);
    setText("");
    try {
      const { token: phoneToken } = await getPhoneNumber();
      const accessToken = await getAccessToken();
      if (!accessToken || !phoneToken) {
        setDone(false);
        setText("Không lấy được số điện thoại Zalo.");
        return;
      }

      const response = await fetch(
        `${API_BASE}/auth/zalo/attempts/${encodeURIComponent(ticket)}/phone`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken, phoneToken }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body || body.success !== true || body.data?.status === "failed") {
        setDone(false);
        setText(failureText(body) || "Không lấy được số điện thoại Zalo.");
        return;
      }

      setDone(true);
      setText(SUCCESS_TEXT);
    } catch (error) {
      setDone(false);
      setText(thrownText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      {done ? null : (
        <button type="button" onClick={sharePhone} disabled={pending}>
          Chia sẻ số điện thoại
        </button>
      )}
      {text ? <p>{text}</p> : null}
    </main>
  );
}
