# voice-router-v3 · 翻訳王

## 翻訳王（2026-09-12）

トップと `/chat` を、実際に会話できる翻訳スタジオに刷新しました。

- 日本語・ベトナム語・クメール語・英語の双方向翻訳。OpenRouterキーがある環境では既存のClaudeモデルを使用し、キーがない環境ではMyMemory標準翻訳を使用します。
- 自然・丁寧・親しみの伝え方、戻し訳、音声入力、読み上げ、ゆっくり再生。
- 相手に見せる拡大表示、180度回転、相手の返事へ切り替え。
- 端末内フレーズ帳、任意の会話履歴保存、テキスト書き出し。
- `/secret-room/[roomId]` では原文＋訳文をWebSocket中継。翻訳後に本人が送信し、サーバーの中継確認で表示を更新します。招待URLは相手側の言語を設定済みです。
- 未接続・利用上限・翻訳失敗時に入力を保持。読み上げ音声がない言語は明示し、別言語の音声を代用しません。

### 開発・検証

```bash
npm ci
npm ci --prefix server
npm test
npm run typecheck
npm run build
npm run dev
```

両ロックファイルを更新しています。既存のpnpm環境も使用可能です。フォントは同梱配信し、ビルド時のGoogle Fonts接続に依存しません。

環境変数は `.env.example` を参照。既存Vercel/Railway構成を使用します。APIキーをブラウザへ渡すことはありません。

### データと制限

翻訳対象はOpenRouterとモデル提供者、またはMyMemoryへ送られます。キーがある状態でAI接続に失敗しても、勝手に別の提供者へ送信しません。MyMemoryは500 UTF-8バイト制限に合わせて分割し、日次上限をエラーとして表示します。標準翻訳は伝え方の指定に対応しません。

秘密の部屋はURLを知る人が参加する方式で、ログインによるアクセス制御やエンドツーエンド暗号化はありません。サーバーは原文・訳文を中継するだけで履歴を保存しません。閉じた画面へ履歴を復元する機能もありません。保存を選んだフレーズと書き出したファイルは別途残ります。会話履歴の保存は初期状態でオフです。

音声入力・音声合成はブラウザと端末の対応状況によります。特にクメール語の音声が端末にない場合は文字表示を利用します。戻し訳は同一サービスによる参考情報で、正確さの保証ではありません。入力は600文字まで。APIの同時実行・頻度制限はインスタンス単位であり、全環境を通じた課金上限ではありません。

### 既存機能

以下は翻訳王への刷新前からある独立した機能の説明です。`/voice-router` のAI振り分け先は引き続きモックです。翻訳王の実API接続とは別です。


話した内容の「意図」を判定して、どのAIに投げるべきかを振り分ける音声ルーティングUI。
音声の周波数特性とテキストのキーワードを併用してルートを決め、判定根拠と確信度を画面に出す。

Next.js アプリ1つに、3つの独立した画面が同居している。

| ルート | 画面 | 内容 |
| --- | --- | --- |
| `/` | モデル・機能 使い分けガイド | AIモデルと機能の早見表。用途・注意点・料金目安を一覧化 |
| `/voice-router` | VOICE ROUTER v3 | 音声入力 → 意図判定 → AI振り分け |
| `/world-tree` | WORLD TREE | 制作物を3D空間のノードとして配置する知識グラフUI |

## VOICE ROUTER の振り分けルート

判定先は6ルート。AI 5種に加えて、過去作品を呼び戻すための内部ルート `ARCHIVIST` を持つ。

| ルート | モード | 主な発火条件 | リスク |
| --- | --- | --- | --- |
| Gemini | 発散・高速生成 | 高tension、高域が強い、発散系キーワード（アイデア／企画／ブレスト等） | high |
| Claude | 構造化・文章整理 | 中域が安定、整理系キーワード（整理／文章／要約／構成／設計等） | mid |
| Perplexity | 調査・根拠確認 | 調査系キーワード（検索／調べ／根拠／引用／最新／比較等） | low |
| GPT | 実装・デバッグ | 実装系キーワード（コード／実装／修正／エラー／バグ等） | mid |
| NotebookLM | 静音・記録 | 低域中心、記録系キーワード（記録／メモ／保存／ログ等） | low |
| ARCHIVIST | 原典回収・呼び戻し | 原典回収系キーワード（渦巻き／昔の作品／探して／回収等） | low |

明確な一致がない場合は NotebookLM（記録ルート）へ落ちる。

### 判定のしくみ

1. **音声解析** — `getUserMedia` で取得した音声を `AnalyserNode` にかけ、低域・中域・高域の強さと tension を算出する
2. **文字起こし** — Web Speech API（`SpeechRecognition`）で発話をテキスト化する
3. **スコアリング** — 各ルートに初期値を置き、音声特徴とキーワード正規表現の一致ごとに加点する
4. **確信度** — 最高スコアと次点の差に55を加えた値を confidence として返す
5. **根拠表示** — どの条件がどのルートに何点入ったかを一覧で画面に出す

判定はすべてブラウザ内で完結し、音声データを外部へ送信しない。

## 現在の状態

- **振り分けロジックは動作する。** 音声解析・文字起こし・スコアリング・根拠表示まで実装済み
- **LLMへの接続は未実装。** `app/api/llm/route.ts` はモック応答（`MOCK {provider}: ...`）を返すだけで、外部AI APIへは接続していない。実際にAIから回答を得る段階には至っていない

MVP評価時（AI 4ルート構成、モック応答）の意図判定一致率は、NotebookLM 100% / Perplexity 97% / GPT 93% / Claude 91%。
`ARCHIVIST` を加えた現構成での再計測は未実施。

## WORLD TREE

制作物をノードとして3D空間に配置し、探索するための画面。

- ファイルのドラッグ＆ドロップでノードを投入
- 平面表示と立体表示の切り替え
- 検索によるノード絞り込み
- RECALL LOG（呼び戻し操作の記録）
- JSON / CSV でのエクスポート、および全消去

## 技術構成

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS v4
- Three.js + React Three Fiber + drei（WORLD TREE の3D描画）
- Web Speech API / Web Audio API（VOICE ROUTER の音声処理）

`/world-tree` は `ssr: false` の動的インポートでクライアント専用に読み込む。

## 開発

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
```

音声入力を試す場合は、マイク権限の付与と、Web Speech API 対応ブラウザ（Chrome系）が必要。

## 関連プロジェクト

| 日付 | プロジェクト | URL |
| --- | --- | --- |
| 2026-06-01 | azuma-kikaku — 初期のポートフォリオ／企画サイト | https://otani04012000-alt.github.io/azuma-kikaku |
| 2026-07-22 | WORLD TREE / SYNAPSE OS — 本リポジトリの `/world-tree` | https://model-comparison-app-1.vercel.app/world-tree |
| 2026-07-29 | GATE v0 / DUEL BUILD — SPA構造の検証、Playwrightでの動作チェック | https://gate-v0-world-tree.vercel.app |
| 2026-07-30 | Hyperbolic Julia — Vite + React 19 + Three.js + GLSL による超曲面レンダリング | https://julia-lab.vercel.app |
| 2026-08-01 | ENGI — 取引所縁起 | https://engi.pplx.app |
| 2026-08-01 | 10万ボルト LP | https://denkihpvar-tfnhezfh.manus.space |
| 2026-08-03 | 10万ボルト QUEST — 補助金をRPGクエスト形式で解説する特設サイト | https://10manvolt-quest.pplx.app/ |
