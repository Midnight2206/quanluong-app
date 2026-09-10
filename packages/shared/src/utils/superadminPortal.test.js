import test from "node:test";
import assert from "node:assert/strict";

import {
  __testables,
  getMainAppOrigin,
  getSuperadminAppOrigin,
} from "./superadminPortal.js";

const { defaultMainOriginFromWindow, defaultSuperadminOriginFromWindow } = __testables;

function withLocation({ protocol, hostname, port }, fn) {
  const prev = globalThis.window;
  globalThis.window = {
    location: { protocol, hostname, port },
  };
  try {
    return fn();
  } finally {
    if (prev === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = prev;
    }
  }
}

test("docker main :8080 maps to superadmin :8081 on same host", () => {
  withLocation({ protocol: "http:", hostname: "localhost", port: "8080" }, () => {
    assert.equal(defaultSuperadminOriginFromWindow(), "http://localhost:8081");
    assert.equal(getSuperadminAppOrigin(), "http://localhost:8081");
  });
});

test("next dev :3000 maps to superadmin :3001", () => {
  withLocation({ protocol: "http:", hostname: "127.0.0.1", port: "3000" }, () => {
    assert.equal(defaultSuperadminOriginFromWindow(), "http://127.0.0.1:3001");
  });
});

test("production quanluong host maps to admin-quanluong subdomain", () => {
  withLocation(
    { protocol: "https:", hostname: "quanluong.trankhanhan.site", port: "" },
    () => {
      assert.equal(
        defaultSuperadminOriginFromWindow(),
        "https://admin-quanluong.trankhanhan.site",
      );
      assert.equal(
        getSuperadminAppOrigin(),
        "https://admin-quanluong.trankhanhan.site",
      );
    },
  );
});

test("admin portal maps back to main quanluong host", () => {
  withLocation(
    { protocol: "https:", hostname: "admin-quanluong.trankhanhan.site", port: "" },
    () => {
      assert.equal(defaultMainOriginFromWindow(), "https://quanluong.trankhanhan.site");
      assert.equal(getMainAppOrigin(), "https://quanluong.trankhanhan.site");
    },
  );
});

test("localhost env bake-in is ignored on public hostname", () => {
  const prev = process.env.NEXT_PUBLIC_SUPERADMIN_ORIGIN;
  process.env.NEXT_PUBLIC_SUPERADMIN_ORIGIN = "http://localhost:8081";
  try {
    withLocation(
      { protocol: "https:", hostname: "quanluong.trankhanhan.site", port: "" },
      () => {
        assert.equal(
          getSuperadminAppOrigin(),
          "https://admin-quanluong.trankhanhan.site",
        );
      },
    );
  } finally {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_SUPERADMIN_ORIGIN;
    } else {
      process.env.NEXT_PUBLIC_SUPERADMIN_ORIGIN = prev;
    }
  }
});
