# secret-room-ws-server

秘密の部屋 (`app/secret-room/[roomId]`) 用のRailway常駐WebSocketサーバーです。
原文と翻訳済みペイロードを検証して中継します。翻訳API自体はNext.js側で呼び出します。

- `room:join` → `room:ready` / `room:presence`(joined)
- `room:message` → `room:message`(他参加者へ配信し、送信者にも中継確認を返す)
- `room:typing` → `room:typing`(他参加者へ配信)
- 切断 → `room:presence`(left)
- 不正入力 → `room:error`

音声合成・AI返信・翻訳API呼び出し・メッセージの永続化はこのサーバーでは行いません。

翻訳ペイロードは省略可能でPR #7のクライアントとも互換性があります。32KiBのフレーム上限、重複ID抑制（接続ごとに直近1000件）、同一参加者IDの重複拒否、10秒150イベントの接続単位制限、heartbeatと入室期限を実装しています。送信日時はサーバー時刻を使用します。

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
