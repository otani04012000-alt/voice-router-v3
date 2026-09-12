import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { WebSocket } = require("../server/node_modules/ws");
const waitFor = (socket, predicate) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", handler);
      reject(new Error("event timeout"));
    }, 5000);
    const handler = (raw) => {
      const e = JSON.parse(raw);
      if (predicate(e)) {
        clearTimeout(timer);
        socket.off("message", handler);
        resolve(e);
      }
    };
    socket.on("message", handler);
  });
const connect = async () => {
  const socket = new WebSocket("ws://127.0.0.1:3311");
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return socket;
};
const send = (socket, data) => socket.send(JSON.stringify(data));
test("two participants exchange translations with acknowledgement, deduplication, isolation and departure", async () => {
  const server = spawn(process.execPath, ["server/dist/index.js"], {
    env: { ...process.env, PORT: "3311" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const sockets = [];
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("error", reject);
      server.once("exit", (code) => reject(new Error(`server exited ${code}`)));
    });
    const a = await connect(),
      b = await connect(),
      outsider = await connect();
    sockets.push(a, b, outsider);
    for (const [socket, id, roomId] of [
      [a, "a", "test"],
      [b, "b", "test"],
      [outsider, "c", "other"],
    ]) {
      const ready = waitFor(socket, (e) => e.type === "room:ready");
      send(socket, { type: "room:join", roomId, memberId: id, memberName: id });
      await ready;
    }
    let received = 0,
      leaked = false;
    b.on("message", (raw) => {
      if (JSON.parse(raw).type === "room:message") received++;
    });
    outsider.on("message", (raw) => {
      if (JSON.parse(raw).type === "room:message") leaked = true;
    });
    const payload = {
      type: "room:message",
      roomId: "test",
      clientMessageId: "m1",
      body: "こんにちは",
      createdAt: 0,
      translation: {
        original: "こんにちは",
        translated: "Xin chào",
        source: "ja",
        target: "vi",
        provider: "openrouter",
        toneApplied: true,
      },
    };
    const acknowledged = waitFor(a, (e) => e.type === "room:message"),
      delivered = waitFor(b, (e) => e.type === "room:message");
    send(a, payload);
    const [ack, message] = await Promise.all([acknowledged, delivered]);
    assert.equal(message.message.translation.translated, "Xin chào");
    assert.ok(ack.message.createdAt > 0);
    const repeatAck = waitFor(a, (e) => e.type === "room:message");
    send(a, payload);
    await repeatAck;
    assert.equal(received, 1);
    assert.equal(leaked, false);
    const invalid = waitFor(a, (e) => e.type === "room:error");
    send(a, {
      ...payload,
      clientMessageId: "m2",
      translation: { ...payload.translation, source: "xx" },
    });
    await invalid;
    const forbidden = waitFor(outsider, (e) => e.type === "room:error");
    send(outsider, payload);
    await forbidden;
    const duplicate = await connect();
    sockets.push(duplicate);
    const duplicateError = waitFor(duplicate, (e) => e.type === "room:error");
    send(duplicate, {
      type: "room:join",
      roomId: "test",
      memberId: "a",
      memberName: "imposter",
    });
    await duplicateError;
    const typing = waitFor(b, (e) => e.type === "room:typing");
    send(a, { type: "room:typing", roomId: "test", active: true });
    assert.equal((await typing).active, true);
    const left = waitFor(
      a,
      (e) => e.type === "room:presence" && e.action === "left",
    );
    b.close();
    assert.equal((await left).member.id, "b");
  } finally {
    for (const socket of sockets) socket.terminate();
    server.kill();
  }
});
