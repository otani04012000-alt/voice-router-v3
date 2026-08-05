/**
 * 各デモページの右下に置く、FLOW（業務可視化・自動化設計）への小さな導線。
 *
 * このリポジトリのデモを見に来るのは制作会社やエンジニアなので、
 * 価格ではなく「この演出を自社案件へ組み込めるか」を入口にする。
 * source は流入元の計測用。遷移先は別プロジェクトのため絶対URLで開く。
 */
const FLOW_URL = 'https://gate-v0-world-tree.vercel.app/flow'

export default function FlowLink({
  source,
  label = 'この演出を御社の案件へ',
}: {
  source: string
  label?: string
}) {
  const href = `${FLOW_URL}?from=${encodeURIComponent(source)}`

  return (
    <>
      <style>{FLOW_LINK_CSS}</style>
      <a className="flowlink" href={href} target="_blank" rel="noopener noreferrer">
        <span className="flowlink-dot" aria-hidden="true" />
        <span className="flowlink-label">{label}</span>
        <span className="flowlink-arrow" aria-hidden="true">
          →
        </span>
      </a>
    </>
  )
}

const FLOW_LINK_CSS = `
.flowlink{
  position:fixed; right:clamp(.75rem,2.5vw,1.5rem); bottom:clamp(.75rem,2.5vw,1.5rem);
  z-index:60; display:inline-flex; align-items:center; gap:.55rem;
  padding:.55rem .95rem; border-radius:999px;
  border:1px solid rgba(230,187,82,.28); background:rgba(10,10,14,.62);
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  font-size:.6rem; letter-spacing:.16em;
  color:rgba(232,237,247,.72); text-decoration:none; cursor:pointer;
  opacity:.62; transition:opacity .3s cubic-bezier(.16,1,.3,1),
    border-color .3s cubic-bezier(.16,1,.3,1), color .3s cubic-bezier(.16,1,.3,1);
}
.flowlink:hover,.flowlink:focus-visible{
  opacity:1; color:#e6bb52; border-color:rgba(230,187,82,.6);
}
.flowlink:focus-visible{outline:2px solid rgba(230,187,82,.5); outline-offset:2px}
.flowlink-dot{
  width:5px; height:5px; border-radius:50%; background:#e6bb52; flex:none;
  box-shadow:0 0 10px rgba(230,187,82,.8);
}
.flowlink-arrow{opacity:.7}
@media(max-width:560px){
  .flowlink-label{display:none}
  .flowlink{padding:.55rem .7rem}
}
@media(prefers-reduced-motion:reduce){
  .flowlink{transition:none}
}
`
