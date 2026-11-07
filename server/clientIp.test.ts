import { describe, expect, it } from "vitest";
import { clientIp, normalizeIp, parseTrustedProxyHops, UNKNOWN_IP } from "./clientIp";

describe("normalizeIp", () => {
  it("keeps plain IPv4 and IPv6 addresses", () => {
    expect(normalizeIp("198.51.100.7")).toBe("198.51.100.7");
    expect(normalizeIp("2001:DB8::1")).toBe("2001:db8::1");
  });

  it("strips ports from IPv4 and bracketed IPv6", () => {
    expect(normalizeIp("198.51.100.7:51234")).toBe("198.51.100.7");
    expect(normalizeIp("[2001:db8::1]:443")).toBe("2001:db8::1");
  });

  it("drops the IPv6 zone id and unifies IPv4-mapped addresses", () => {
    expect(normalizeIp("fe80::1%eth0")).toBe("fe80::1");
    expect(normalizeIp("::ffff:198.51.100.4")).toBe("198.51.100.4");
  });

  it("rejects garbage and empty values", () => {
    expect(normalizeIp("not-an-ip")).toBeNull();
    expect(normalizeIp("")).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
    expect(normalizeIp("[2001:db8::1]junk")).toBeNull();
  });
});

describe("parseTrustedProxyHops", () => {
  it("defaults to zero and clamps unsafe input", () => {
    expect(parseTrustedProxyHops(undefined)).toBe(0);
    expect(parseTrustedProxyHops("")).toBe(0);
    expect(parseTrustedProxyHops("abc")).toBe(0);
    expect(parseTrustedProxyHops(-1)).toBe(0);
    expect(parseTrustedProxyHops("2")).toBe(2);
    expect(parseTrustedProxyHops("999")).toBe(16);
  });
});

describe("clientIp", () => {
  const base = { remoteAddress: "198.51.100.7" };

  it("ignores a spoofed X-Forwarded-For when no proxy is trusted", () => {
    expect(clientIp({ ...base, forwardedFor: "203.0.113.99", trustedProxyHops: 0 })).toBe("198.51.100.7");
    expect(clientIp({ ...base, forwardedFor: "203.0.113.99" })).toBe("198.51.100.7");
  });

  it("trusts the value appended by one trusted proxy", () => {
    expect(
      clientIp({ forwardedFor: "203.0.113.99", remoteAddress: "10.0.0.5", trustedProxyHops: 1 }),
    ).toBe("203.0.113.99");
  });

  it("ignores forged entries to the left of the trusted chain", () => {
    /* Клиент өөрөө "1.2.3.4" бичсэн; proxy нь жинхэнэ IP + өөрийн hop-ыг нэмсэн. */
    const chain = "1.2.3.4, 203.0.113.99, 10.0.0.5";
    expect(clientIp({ forwardedFor: chain, remoteAddress: "10.0.0.9", trustedProxyHops: 2 })).toBe("203.0.113.99");
  });

  it("handles IPv6 clients inside the chain", () => {
    expect(
      clientIp({ forwardedFor: "[2001:db8::1]:443, 10.0.0.5", remoteAddress: "10.0.0.9", trustedProxyHops: 2 }),
    ).toBe("2001:db8::1");
    /* Нэг proxy: сүүлчийн утга нь клиент өөрөө. */
    expect(
      clientIp({ forwardedFor: "[2001:db8::1]:443", remoteAddress: "10.0.0.9", trustedProxyHops: 1 }),
    ).toBe("2001:db8::1");
  });

  it("falls back to the socket address when the chain is short or invalid", () => {
    expect(clientIp({ forwardedFor: "not-an-ip", remoteAddress: "10.0.0.5", trustedProxyHops: 1 })).toBe("10.0.0.5");
    expect(clientIp({ forwardedFor: "", remoteAddress: "10.0.0.5", trustedProxyHops: 1 })).toBe("10.0.0.5");
    expect(clientIp({ forwardedFor: "203.0.113.99", remoteAddress: "10.0.0.5", trustedProxyHops: 3 })).toBe("10.0.0.5");
  });

  it("uses x-real-ip only behind a trusted proxy", () => {
    expect(clientIp({ realIp: "203.0.113.99", remoteAddress: "10.0.0.5", trustedProxyHops: 0 })).toBe("10.0.0.5");
    expect(clientIp({ realIp: "203.0.113.99", remoteAddress: "10.0.0.5", trustedProxyHops: 1 })).toBe("203.0.113.99");
  });

  it("accepts header arrays and never returns an empty key", () => {
    expect(clientIp({ forwardedFor: ["203.0.113.99"], remoteAddress: "10.0.0.5", trustedProxyHops: 1 })).toBe("203.0.113.99");
    expect(clientIp({})).toBe(UNKNOWN_IP);
    expect(clientIp({ remoteAddress: "nonsense" })).toBe(UNKNOWN_IP);
  });
});
