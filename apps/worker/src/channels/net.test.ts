import { describe, expect, it } from "vitest";
import { BlockedAddress, isPrivateAddress, readLimited, safeFetch } from "./net";

describe("which addresses count as private", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1",
    "::1", "::", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "ff02::1",
  ])("%s is blocked", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("%s is allowed", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("fetching a customer's address safely", () => {
  it("refuses anything but https", async () => {
    await expect(safeFetch("http://example.com/")).rejects.toBeInstanceOf(BlockedAddress);
    await expect(safeFetch("file:///etc/passwd")).rejects.toBeInstanceOf(BlockedAddress);
    await expect(safeFetch("not a url")).rejects.toBeInstanceOf(BlockedAddress);
  });

  it("refuses addresses typed in directly", async () => {
    await expect(safeFetch("https://127.0.0.1/")).rejects.toBeInstanceOf(BlockedAddress);
    await expect(safeFetch("https://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(BlockedAddress);
    await expect(safeFetch("https://[::1]/")).rejects.toBeInstanceOf(BlockedAddress);
  });

  it("refuses a name that points inside", async () => {
    await expect(safeFetch("https://localhost/")).rejects.toBeInstanceOf(BlockedAddress);
  });
});

describe("reading a download with a size limit", () => {
  it("returns small bodies and stops large ones", async () => {
    expect(await readLimited(new Response("hello"), 100)).toEqual(new TextEncoder().encode("hello"));
    await expect(readLimited(new Response("x".repeat(500)), 100)).rejects.toThrow("too large");
  });
});
