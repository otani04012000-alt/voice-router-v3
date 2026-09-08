# secret-room-ws-server

秘密の部屋 (`app/secret-room/[roomId]`) 用のRailway常駐WebSocketサーバーです。
初回段階の責務は次の5イベントの中継だけに限定しています。

- `room:join` → `room:ready` / `room:presence`(joined)
- `room:message` → `room:message`(他参加者へ配信)
- `room:typing` → `room:typing`(他参加者へ配信)
- 切断 → `room:presence`(left)
- 不正入力 → `room:error`

人格・音声合成・AI返信(Claude API等)・翻訳API呼び出し・メッセージの永続化は、
このサーバーの責務に含めていません。次段階で決定します。

## ローカル起動

```bash
cd server
npm install
npm run dev
```

デフォルトでは `PORT` 環境変数(未設定時は3001)でリッスンします。

## Railwayへのデプロイ

Railwayのサービス設定で以下を行います。

1. GitHubリポジトリ `voice-router-v3` を接続する
2. Root Directory を `server` に設定する（リポジトリ直下ではなくこのフォルダだけをビルド対象にする）
3. `railway.json` により `npm install && npm run build` → `npm run start` が自動適用される
4. デプロイ完了後、発行された公開ドメインを確認する（例: `xxxx.up.railway.app`）
5. Next.js(Vercel)側の環境変数 `NEXT_PUBLIC_SECRET_ROOM_WS_URL` に
   `wss://<Railwayの公開ドメイン>` を設定する

## ヘルスチェック

`GET /healthz` で稼働中のroom数・接続数をJSONで返します。Railwayの
`healthcheckPath` はこのエンドポイントを使用します。

## 環境変数

現時点では `PORT` 以外に必須の環境変数はありません。Claude APIキーや
翻訳APIキーなど秘密鍵は、AI返信の責務を決定する次段階まで設定不要です。
