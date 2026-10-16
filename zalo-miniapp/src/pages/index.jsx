import { useState } from "react";
import { getAccessToken, getPhoneNumber } from "zmp-sdk";
import { Box, Button, Page, Text } from "zmp-ui";
import { API_BASE } from "../config";

const SUCCESS_TEXT = "Quay lại trình duyệt";

function readTicket() {
  return new URLSearchParams(window.location.search).get("ticket")?.trim() || "";
}

function failureText(body) {
  return typeof body?.message === "string" ? body.message : "";
}

function thrownText(error) {
  if (typeof error?.message === "string" && error.message) return error.message;
  return "Không lấy được số điện thoại Zalo.";
}

export default function HomePage() {
  const [pending, setPending] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [manualTicket, setManualTicket] = useState("");
  const fromLink = readTicket();

  async function sharePhone() {
    const ticket = fromLink || manualTicket.trim();
    if (!ticket) {
      setDone(false);
      setText("Thiếu phiếu đăng nhập.");
      return;
    }

    setPending(true);
    setText("");
    let phoneToken = "";
    let accessToken = "";
    try {
      const phone = await getPhoneNumber();
      phoneToken = phone?.token || "";
      accessToken = (await getAccessToken()) || "";
    } catch (error) {
      setDone(false);
      setText(`Zalo không trả số. ${thrownText(error)}`);
      setPending(false);
      return;
    }
    if (!accessToken || !phoneToken) {
      setDone(false);
      setText("Không lấy được số điện thoại Zalo.");
      setPending(false);
      return;
    }

    let response;
    try {
      response = await fetch(`${API_BASE}/auth/zalo/attempts/${encodeURIComponent(ticket)}/phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, phoneToken }),
      });
    } catch (error) {
      setDone(false);
      setText(`Không gọi được máy chủ. ${thrownText(error)}`);
      setPending(false);
      return;
    }

    try {
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
    <Page className="flex flex-col items-center justify-center bg-white px-6 dark:bg-black">
      <Box className="w-full max-w-sm space-y-4 text-center">
        <Text.Title size="large">Xác minh số điện thoại</Text.Title>
        {done || fromLink ? null : (
          <input
            value={manualTicket}
            onChange={(event) => setManualTicket(event.target.value)}
            placeholder="Dán phiếu từ trang đăng nhập"
            className="w-full rounded-lg border px-3 py-3 text-left"
          />
        )}
        {done ? null : (
          <Button variant="primary" fullWidth loading={pending} onClick={sharePhone}>
            Chia sẻ số điện thoại
          </Button>
        )}
        {text ? <Text>{text}</Text> : null}
      </Box>
    </Page>
  );
}
